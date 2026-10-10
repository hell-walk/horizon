// Who runs Horizon and how to reach them: shown on the contact, legal and
// pricing pages and in the footer. Set these in the hosting provider's
// environment variables (they are public, so NEXT_PUBLIC_ is fine). Razorpay
// checks that the contact page shows a working email, and usually an address
// and phone number, before it activates live payments.

/** The address people write to. The default is a placeholder: set NEXT_PUBLIC_CONTACT_EMAIL to a mailbox you read. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@horizon.app";
export const CONTACT_EMAIL_IS_PLACEHOLDER = !process.env.NEXT_PUBLIC_CONTACT_EMAIL;

/** The legal name of the person or business behind Horizon (as on the Razorpay account). */
export const BUSINESS_NAME = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Horizon";
/** Postal address for the contact page; left out when not set. */
export const BUSINESS_ADDRESS = process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || "";
/** Phone number for the contact page; left out when not set. */
export const CONTACT_PHONE = process.env.NEXT_PUBLIC_CONTACT_PHONE || "";
