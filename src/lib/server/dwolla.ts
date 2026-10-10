import "server-only";

import { Client } from "dwolla-v2";

const getEnvironment = (): "production" | "sandbox" => {
    const environment = process.env.DWOLLA_ENV as string;

    switch (environment) {
        case "sandbox":
            return "sandbox";
        case "production":
            return "production";
        default:
            throw new Error("Dwolla environment should either be set to `sandbox` or `production`");
    }
};

// Created on first use so a missing DWOLLA_* value only breaks Dwolla calls,
// not every page that imports the user actions.
let dwollaClientInstance: any;
const getDwollaClient = () => {
    if (!dwollaClientInstance) {
        dwollaClientInstance = new Client({
            environment: getEnvironment(),
            key: process.env.DWOLLA_KEY as string,
            secret: process.env.DWOLLA_SECRET as string,
        });
    }
    return dwollaClientInstance;
};

// Create a Dwolla Funding Source using a Plaid Processor Token
export const createFundingSource = async (options: CreateFundingSourceOptions) => {
    try {
        return await getDwollaClient()
            .post(`customers/${options.customerId}/funding-sources`, {
                name: options.fundingSourceName,
                plaidToken: options.plaidToken,
            })
            .then((res: any) => res.headers.get("location"));
    } catch (err) {
        console.error("Creating a Funding Source Failed: ", err);
    }
};

export const createOnDemandAuthorization = async () => {
    try {
        const onDemandAuthorization = await getDwollaClient().post("on-demand-authorizations");
        const authLink = onDemandAuthorization.body._links;
        return authLink;
    } catch (err) {
        console.error("Creating an On Demand Authorization Failed: ", err);
    }
};

export const createDwollaCustomer = async (newCustomer: NewDwollaCustomerParams) => {
    try {
        return await getDwollaClient()
            .post("customers", newCustomer)
            .then((res: any) => res.headers.get("location"));
    } catch (err: any) {
        // Dwolla never deletes customers, so a retried sign-up hits a duplicate.
        // The error embeds the existing customer URL; reuse it instead of failing.
        const duplicate = err?.body?._embedded?.errors?.find(
            (e: any) => e.code === "Duplicate" && e.path === "/email"
        );
        const existingUrl = duplicate?._links?.about?.href;
        if (existingUrl) {
            console.warn("Dwolla customer already exists for this email, reusing it");
            return existingUrl as string;
        }
        console.error("Creating a Dwolla Customer Failed: ", err);
    }
};

export const createTransfer = async ({
    sourceFundingSourceUrl,
    destinationFundingSourceUrl,
    amount,
}: TransferParams) => {
    try {
        const requestBody = {
            _links: {
                source: { href: sourceFundingSourceUrl },
                destination: { href: destinationFundingSourceUrl },
            },
            amount: { currency: "USD", value: amount },
        };
        return await getDwollaClient()
            .post("transfers", requestBody)
            .then((res: any) => res.headers.get("location"));
    } catch (err) {
        console.error("Transfer fund failed: ", err);
    }
};

export const addFundingSource = async ({
    dwollaCustomerId,
    processorToken,
    bankName,
}: AddFundingSourceParams) => {
    try {
        // create dwolla auth link
        const dwollaAuthLinks = await createOnDemandAuthorization();

        // add funding source to the dwolla customer & get the funding source url
        const fundingSourceOptions = {
            customerId: dwollaCustomerId,
            fundingSourceName: bankName,
            plaidToken: processorToken,
            _links: dwollaAuthLinks,
        };
        return await createFundingSource(fundingSourceOptions);
    } catch (err) {
        console.error("Transfer fund failed: ", err);
    }
};
