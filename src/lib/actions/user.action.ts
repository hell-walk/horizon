'use server';

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../server/appwrite";
import { cookies } from "next/headers";
import { encryptId, extractCustomerIdFromUrl, parseStringify } from "../utils";
import { AccountType, CountryCode, ProcessorTokenCreateRequest, ProcessorTokenCreateRequestProcessorEnum, Products } from "plaid";
import { plaidClient } from "../plaid";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import { cached, invalidate, TTL } from "../cache";
import { addFundingSource, createDwollaCustomer } from "./dwolla.action";

const {
    APPWRITE_DATABASE_ID: DATABASE_ID,
    APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
    APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

export const getUserInfo = async ({ userId }: getUserInfoProps) => {
    try {
        const { database } = await createAdminClient();

        const user = await database.listDocuments(
            DATABASE_ID!,
            USER_COLLECTION_ID!,
            [Query.equal("userId", [userId])]
        );

        const info = user.documents[0];
        return info ? parseStringify(info) : null;
    } catch (error) {
        console.error("Error fetching user info", error);
    }
};

export const signIn = async ({ email, password }: signInProps) => {
    try {
        const { account } = await createAdminClient();
        const session = await account.createEmailPasswordSession(email, password);

        (await cookies()).set("banking-session", session.secret, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: true,
        });
        const user = await getUserInfo({userId : session.userId})

        return parseStringify(user);
    } catch (error) {
        console.error('Error', error)
    }
}

const US_STATES = new Set(("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC").split(" "));
const isUsAddress = (state: string, postalCode: string) =>
    US_STATES.has(state.trim().toUpperCase()) && /^\d{5}(-\d{4})?$/.test(postalCode.trim());

export const signUp = async (userData: SignUpParams) => {
    const { email, password, firstName, lastName, ...profile } = userData
    let newUserAccount;
    try {

        const { account ,  database} = await createAdminClient();

        newUserAccount = await account.create(
            ID.unique(),
            email,
            password,
            `${firstName} ${lastName}`,
        );

        if(!newUserAccount) throw Error('Error In Creating User')

        // Dwolla (US transfers) only accepts US addresses. Everyone else signs up
        // without a Dwolla customer: they can still link banks and import
        // statements, only transfers stay unavailable.
        const dwolla: { dwollaCustomerId?: string; dwollaCustomerUrl?: string } = {};
        if (isUsAddress(profile.state, profile.postalCode)) {
            try {
                const dwollaCustomerUrl = await createDwollaCustomer({ ...userData, type: 'personal' });
                if (dwollaCustomerUrl) {
                    dwolla.dwollaCustomerUrl = dwollaCustomerUrl;
                    dwolla.dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl);
                }
            } catch (dwollaError) {
                console.warn('Dwolla customer not created; continuing without transfers', dwollaError);
            }
        }

            const newUser=await database.createDocument(
                DATABASE_ID!,
                USER_COLLECTION_ID!,
                ID.unique(),
                {
                    ...profile,
                    email,
                    firstName,
                    lastName,
                    userId: newUserAccount.$id,
                    ...dwolla,
                }
            )

        const session = await account.createEmailPasswordSession(email, password);
        (await cookies()).set("banking-session", session.secret, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: true,
        });

        return parseStringify(newUser)
    } catch (error) {
        console.error('Error', error)

        // Roll back the auth account so a failed sign-up can be retried with the same email.
        if (newUserAccount) {
            try {
                const { user } = await createAdminClient();
                await user.delete(newUserAccount.$id);
            } catch (cleanupError) {
                console.error('Could not remove the partially created user', cleanupError);
            }
        }
    }
}

// ... your initilization functions

// React cache() dedupes this within one request: the layout and the page both call it.
const loadLoggedInUser = cache(async () => {
    try {
        const { account } = await createSessionClient();
        const result = await account.get();

        // Merge the auth account (name, email) with the profile document
        // (firstName, lastName, dwolla ids). $id becomes the profile document id.
        const user = await getUserInfo({ userId: result.$id });

        return parseStringify({ ...result, ...user });
    } catch (error) {
        return null;
    }
});

export async function getLoggedInUser() {
    return loadLoggedInUser();
}

export const logoutAccount = async () => {
    try {
        const { account } = await createSessionClient();
        await account.deleteSession('current');
    } catch (error) {
        // The session may already be invalid; clearing the cookie below still logs the user out.
        console.error('Error deleting the Appwrite session', error);
    }

    (await cookies()).delete('banking-session');

    return true;
}

export const createLinkToken = async (user: User) => {
    try {
        const tokenParam = {
            user: {
                client_user_id: user.$id
            },
            client_name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name,
            products: ['auth', 'transactions'] as Products[],
            language: 'en',
            country_codes: ['US'] as CountryCode[],

        }
        console.log("[createLinkToken] calling Plaid for", tokenParam.client_name);
        const response = await plaidClient.linkTokenCreate(tokenParam)
        console.log("[createLinkToken] Plaid responded");

        return parseStringify({ linkToken: response.data.link_token })
    } catch (error: any) {
        console.error("[createLinkToken] failed:", error?.code, error?.message, error?.response?.data ?? "");
    }
}

export const exchangePublicToken = async ({ publicToken, user }: exchangePublicTokenProps) => {
    try {
        // Exchange the short-lived public token for a permanent access token
        const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
        const accessToken = response.data.access_token;
        const itemId = response.data.item_id;

        // Get the account linked through Plaid Link
        const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
        const accountData = accountsResponse.data.accounts[0];

        // Attach the bank to the user's Dwolla customer as a funding source so it
        // can send and receive transfers. Users without a Dwolla customer (non-US
        // address) still get the bank, just without transfers.
        let fundingSourceUrl = "";
        if (user.dwollaCustomerId) {
            const request: ProcessorTokenCreateRequest = {
                access_token: accessToken,
                account_id: accountData.account_id,
                processor: "dwolla" as ProcessorTokenCreateRequestProcessorEnum,
            };
            const processorTokenResponse = await plaidClient.processorTokenCreate(request);
            const processorToken = processorTokenResponse.data.processor_token;

            fundingSourceUrl =
                (await addFundingSource({
                    dwollaCustomerId: user.dwollaCustomerId,
                    processorToken,
                    bankName: accountData.name,
                })) ?? "";

            if (!fundingSourceUrl) throw Error("Funding source was not created");
        }

        await createBankAccount({
            userId: user.$id,
            bankId: itemId,
            accountId: accountData.account_id,
            accessToken,
            fundingSourceUrl,
            sharableId: encryptId(accountData.account_id),
        });

        revalidatePath("/");

        return parseStringify({ publicTokenExchange: "complete" });
    } catch (error) {
        console.error("An error occurred while exchanging the public token", error);
    }
};

export const createBankAccount = async ({
    userId,
    bankId,
    accountId,
    accessToken,
    fundingSourceUrl,
    sharableId,
    provider = "plaid",
    currency,
    dataSessionId,
    institutionName,
    accountMask,
    currentBalance,
}: createBankAccountProps) => {
    try {
        const { database } = await createAdminClient();

        const bankAccount = await database.createDocument(
            DATABASE_ID!,
            BANK_COLLECTION_ID!,
            ID.unique(),
            {
                userId,
                bankId,
                accountId,
                accessToken,
                fundingSourceUrl: fundingSourceUrl ?? "",
                sharableId,
                provider,
                ...(currency ? { currency } : {}),
                ...(dataSessionId ? { dataSessionId } : {}),
                ...(institutionName ? { institutionName } : {}),
                ...(accountMask ? { accountMask } : {}),
                ...(currentBalance !== undefined ? { currentBalance } : {}),
            }
        );

        invalidate("banks:");

        return parseStringify(bankAccount);
    } catch (error) {
        console.error("An error occurred while creating the bank account", error);
    }
};

export const getBanks = async ({ userId }: getBanksProps) => {
    try {
        const banks = await cached(`banks:${userId}`, TTL.short, async () => {
            const { database } = await createAdminClient();
            const result = await database.listDocuments(
                DATABASE_ID!,
                BANK_COLLECTION_ID!,
                [Query.equal('userId', [userId])]
            );
            return result.documents;
        });

        return parseStringify(banks);
        
    } catch (error) {
        console.error(error)
    }
}



export const getBank  = async({documentId} : getBankProps)=>{
  try {
     const { database }= await createAdminClient()

        const bank = await database.listDocuments(
            DATABASE_ID!,
            BANK_COLLECTION_ID!,
            [Query.equal('$id',[documentId])]
        )

        return parseStringify(bank.documents[0]);
   } catch (error) {
    console.error(error)
  }
}

export const getBankByAccountId = async({accountId} : getBankByAccountIdProps)=>{
  try {
     const { database }= await createAdminClient()

        const bank = await database.listDocuments(
            DATABASE_ID!,
            BANK_COLLECTION_ID!,
            [Query.equal('accountId',[accountId])]
        )
if(bank.total != 1) return null
        return parseStringify(bank.documents[0]);
   } catch (error) {
    console.error(error)
  }
}
