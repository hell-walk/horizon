import type { Metadata } from "next";
import { FileSpreadsheet, Landmark, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import AccountsTable from "@/components/accountsTable";
import ImportStatement from "@/components/importStatement";
import PlaidLink from "@/components/plaidLink";
import SetuLink from "@/components/setuLink";
import HeaderBox from "@/components/ui/headerBox";
import { getT } from "@/lib/i18n/server";
import { getAccounts } from "@/lib/server/accounts";
import { getLoggedInUser, ownerIdOf } from "@/lib/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("connect.metaTitle"), description: t("connect.metaDescription") };
}

const ConnectBank = async () => {
  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const accounts = await getAccounts({ userId: ownerIdOf(loggedIn) });
  const accountsData: Account[] = accounts?.data ?? [];
  const count = (provider: string) => accountsData.filter((a) => (a.provider ?? "plaid") === provider).length;
  const t = await getT();
  const linkedLabel = (linked: number) => (linked > 0 ? t("connect.linked", { count: linked }) : t("connect.notLinked"));

  return (
    <section className="page">
      <HeaderBox
        eyebrow={t("connect.eyebrow")}
        title={t("connect.title")}
        subtext={t("connect.subtext")}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <ProviderCard
          label={t("connect.plaidEyebrow")}
          icon={Landmark}
          title="Plaid"
          region={t("connect.plaidRegion")}
          linked={count("plaid")}
          linkedLabel={linkedLabel(count("plaid"))}
          description={t("connect.plaidDescription")}
          facts={[
            [t("connect.plaidFactUpdates"), t("connect.plaidFactUpdatesValue")],
            [t("connect.plaidFactSend"), t("connect.plaidFactSendValue")],
          ]}
        >
          <PlaidLink user={loggedIn} />
        </ProviderCard>

        <ProviderCard
          label={t("connect.setuEyebrow")}
          icon={ShieldCheck}
          title={t("connect.setuTitle")}
          region={t("connect.setuRegion")}
          linked={count("setu")}
          linkedLabel={linkedLabel(count("setu"))}
          description={t("connect.setuDescription")}
          facts={[
            [t("connect.setuFactAccess"), t("connect.setuFactAccessValue")],
            [t("connect.setuFactApproval"), t("connect.setuFactApprovalValue")],
          ]}
          accent
        >
          <SetuLink user={loggedIn} />
        </ProviderCard>

        <ProviderCard
          label={t("connect.fileEyebrow")}
          icon={FileSpreadsheet}
          title={t("connect.fileTitle")}
          region={t("connect.fileRegion")}
          linked={count("manual")}
          linkedLabel={linkedLabel(count("manual"))}
          description={t("connect.fileDescription")}
          facts={[
            [t("connect.fileFactFiles"), t("connect.fileFactFilesValue")],
            [t("connect.fileFactSaved"), t("connect.fileFactSavedValue")],
          ]}
        >
          <a href="#statement" className="btn-secondary w-full">
            {t("connect.uploadStatement")}
          </a>
        </ProviderCard>
      </div>

      <section id="statement" className="panel scroll-mt-6">
        <header className="panel-head">
          <div className="flex items-center gap-2">
            <span className="eyebrow">{t("connect.statementSection")}</span>
            <span className="eyebrow text-ink">{t("connect.statementSectionHint")}</span>
          </div>
          <span className="chip">
            <span className="dot bg-lime" />
            {t("connect.ready")}
          </span>
        </header>
        <div className="panel-body">
          <ImportStatement />
        </div>
      </section>

      <AccountsTable accounts={accountsData} />
    </section>
  );
};

const ProviderCard = ({
  label,
  icon: Icon,
  title,
  region,
  linked,
  linkedLabel,
  description,
  facts,
  accent = false,
  children,
}: {
  label: string;
  icon: typeof Landmark;
  title: string;
  region: string;
  linked: number;
  linkedLabel: string;
  description: string;
  facts: [string, string][];
  accent?: boolean;
  children: React.ReactNode;
}) => (
  <article className="panel flex flex-col">
    <header className="panel-head">
      <span className="eyebrow">{label}</span>
      <span className={linked > 0 ? "chip-lime" : "chip"}>{linkedLabel}</span>
    </header>
    <div className="panel-body flex flex-1 flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className={`flex-center size-10 shrink-0 rounded-md ${accent ? "bg-lime text-lime-foreground" : "bg-primary text-primary-foreground"}`}>
          <Icon className="size-5" />
        </span>
        <div className="flex flex-col">
          <h2 className="font-display text-16 font-semibold uppercase tracking-tight text-ink">{title}</h2>
          <p className="eyebrow">{region}</p>
        </div>
      </div>
      <p className="text-13 text-ink-muted">{description}</p>
      <dl className="grid grid-cols-2 gap-2 rounded-md bg-surface-low p-3">
        {facts.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="eyebrow">{label}</dt>
            <dd className="font-mono text-12 text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto pt-2">{children}</div>
    </div>
  </article>
);

export default ConnectBank;
