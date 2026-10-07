'use server';

import { ID } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../server/appwrite";
import { cookies } from "next/headers";
import { encryptId, extractCustomerIdFromUrl, parseStringify } from "../utils";
import { AccountType, CountryCode, ProcessorTokenCreateRequest, ProcessorTokenCreateRequestProcessorEnum, Products } from "plaid";
import { plaidClient } from "../plaid";
import { revalidatePath } from "next/cache";
import { addFundingSource, createDwollaCustomer } from "./dwollaAction";

const {
    APPWRITE_DATABASE_ID: DATABASE_ID,
    APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
    APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

export const signIn = async ({ email, password }: signInProps) => {
    try {
        const { account } = await createAdminClient();
        const session = await account.createEmailPasswordSession(email, password);

        cookies().set("banking-session", session.secret, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: true,
        });

        return parseStringify(session);
    } catch (error) {
        console.error('Error', error)
    }
}

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

            const dwollaCustomerUrl = await createDwollaCustomer({
                ...userData,
                type:'personal'
            })
            if(!dwollaCustomerUrl) throw Error('Error Creating Dwolla Customer')

            const dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl)

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
                    dwollaCustomerId,
                    dwollaCustomerUrl
                }
            )

        const session = await account.createEmailPasswordSession(email, password);
        cookies().set("banking-session", session.secret, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: true,
        });

        return parseStringify(newUser)
    } catch (error) {
        console.error('Error', error)
    }
}

// ... your initilization functions

export async function getLoggedInUser() {
    try {
        const { account } = await createSessionClient();
        const user = await account.get();
        return parseStringify(user)
    } catch (error) {
        return null;
    }
}
export const logoutAccount = async () => {
    try {
        const { account } = await createSessionClient();
        cookies().delete('banking-session')
        await account.deleteSession('current')
    } catch (error) {
        return null
    }
}

export const createLinkToken = async (user: User) => {
    try {
        const tokenParam = {
            user: {
                client_user_id: user.$id
            },
            client_name: user.name,
            products: ['auth'] as Products[],
            language: 'en',
            country_codes: ['US'] as CountryCode[],

        }
        const response = await plaidClient.linkTokenCreate(tokenParam)

        return parseStringify({ linkToken: response.data.link_token })
    } catch (error) {
        console.log(error)
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

        // Create a processor token for Dwolla
        const request: ProcessorTokenCreateRequest = {
            access_token: accessToken,
            account_id: accountData.account_id,
            processor: "dwolla" as ProcessorTokenCreateRequestProcessorEnum,
        };
        const processorTokenResponse = await plaidClient.processorTokenCreate(request);
        const processorToken = processorTokenResponse.data.processor_token;

        // Attach the bank to the user's Dwolla customer as a funding source
        const fundingSourceUrl = await addFundingSource({
            dwollaCustomerId: user.dwollaCustomerId,
            processorToken,
            bankName: accountData.name,
        });

        if (!fundingSourceUrl) throw Error("Funding source was not created");

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
}: createBankAccountProps) => {
    try {
        const { database } = await createAdminClient();

        const bankAccount = await database.createDocument(
            DATABASE_ID!,
            BANK_COLLECTION_ID!,
            ID.unique(),
            { userId, bankId, accountId, accessToken, fundingSourceUrl, sharableId }
        );

        return parseStringify(bankAccount);
    } catch (error) {
        console.error("An error occurred while creating the bank account", error);
    }
};
