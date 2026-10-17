/** A spending bucket's name as it sits in a URL: "UPI payments" is "upi-payments". Small on purpose: the browser imports it. */
export const spendSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
