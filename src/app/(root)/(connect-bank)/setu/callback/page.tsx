import Link from "next/link";
import { redirect } from "next/navigation";

import HeaderBox from "@/components/ui/headerBox";
import { completeSetuConsent } from "@/lib/actions/setu.action";
import { getLoggedInUser } from "@/lib/server/auth";

// The Account Aggregator sends the customer back here after they approve or
// reject the consent. On approval the linked accounts become bank rows.
const SetuCallback = async ({ searchParams }: SearchParamProps) => {
  const params = await searchParams;
  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const consentId = [params.id, params.consentId, params.consent_id, params.consentid]
    .map((v) => (Array.isArray(v) ? v[0] : v))
    .find(Boolean);

  const result = await completeSetuConsent({ consentId });

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
    <section className="page">
      <HeaderBox eyebrow="Gateway // Setu AA" title="Connect Indian bank" subtext="Account Aggregator consent result." />
      <div className="panel max-w-2xl">
        <header className="panel-head">
          <span className="eyebrow">Consent status</span>
          <span className={result.status === "PENDING" ? "chip-warn" : "chip-danger"}>{result.status}</span>
        </header>
        <div className="panel-body flex flex-col gap-4">
          <p className="text-14 text-ink">{message}</p>
          <div className="flex gap-2">
            <Link href="/connect-bank" className="btn-primary">
              Try again
            </Link>
            <Link href="/" className="btn-secondary">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SetuCallback;
