import Link from "next/link";
import { redirect } from "next/navigation";

import HeaderBox from "@/components/ui/headerBox";
import { getLoggedInUser } from "@/lib/actions/user.action";
import { completeSetuConsent } from "@/lib/actions/setu.action";

// The Account Aggregator sends the customer back here after they approve or
// reject the consent. On approval the linked accounts become bank rows.
const SetuCallback = async ({ searchParams }: SearchParamProps) => {
  const params = await searchParams;
  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const consentId = [params.id, params.consentId, params.consent_id, params.consentid]
    .map((v) => (Array.isArray(v) ? v[0] : v))
    .find(Boolean);

  const result = await completeSetuConsent({ consentId, user: loggedIn });

  if (result.status === "ACTIVE") redirect("/");

  const message =
    result.status === "PENDING"
      ? "The consent is still pending approval. Finish the approval with your Account Aggregator and try again."
      : result.status === "REJECTED"
        ? "The consent request was rejected, so no accounts were linked."
        : result.status === "MISSING"
          ? "We could not find the consent you started. Please start the connection again."
          : result.status === "ERROR"
            ? `Something went wrong while finishing the connection: ${"error" in result ? result.error : ""}`
            : `The consent is ${result.status}. No accounts were linked.`;

  return (
    <section className="flex w-full flex-col gap-8 p-8 xl:py-12">
      <HeaderBox title="Connect Indian bank" subtext="Account Aggregator consent" />
      <p className="text-16 text-gray-700">{message}</p>
      <Link href="/" className="view-all-btn w-fit">
        Back to home
      </Link>
    </section>
  );
};

export default SetuCallback;
