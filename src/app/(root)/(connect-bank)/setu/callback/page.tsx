import Link from "next/link";
import { redirect } from "next/navigation";

import HeaderBox from "@/components/ui/headerBox";
import { completeSetuConsent } from "@/lib/actions/setu.action";
import { getT } from "@/lib/i18n/server";
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

  const t = await getT();
  const message =
    result.status === "PENDING"
      ? t("connect.cbPending")
      : result.status === "REJECTED"
        ? t("connect.cbRejected")
        : result.status === "MISSING"
          ? t("connect.cbMissing")
          : result.status === "ERROR"
            ? t("connect.cbError", { error: "error" in result ? (result.error ?? "") : "" })
            : t("connect.cbOther", { status: result.status });
  const statusLabel =
    result.status === "PENDING"
      ? t("connect.cbStatusPending")
      : result.status === "REJECTED"
        ? t("connect.cbStatusRejected")
        : result.status === "MISSING"
          ? t("connect.cbStatusMissing")
          : result.status === "ERROR"
            ? t("connect.cbStatusError")
            : result.status;

  return (
    <section className="page">
      <HeaderBox eyebrow={t("connect.cbEyebrow")} title={t("connect.cbTitle")} subtext={t("connect.cbSubtext")} />
      <div className="panel max-w-2xl">
        <header className="panel-head">
          <span className="eyebrow">{t("connect.cbStatus")}</span>
          <span className={result.status === "PENDING" ? "chip-warn" : "chip-danger"}>{statusLabel}</span>
        </header>
        <div className="panel-body flex flex-col gap-4">
          <p className="text-14 text-ink">{message}</p>
          <div className="flex gap-2">
            <Link href="/connect-bank" className="btn-primary">
              {t("connect.tryAgain")}
            </Link>
            <Link href="/" className="btn-secondary">
              {t("connect.backHome")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SetuCallback;
