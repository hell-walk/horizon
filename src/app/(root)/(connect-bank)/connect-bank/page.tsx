import type { Metadata } from "next";
import { FileSpreadsheet, Landmark, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import AccountsTable from "@/components/accountsTable";
import ImportStatement from "@/components/importStatement";
import PlaidLink from "@/components/plaidLink";
import SetuLink from "@/components/setuLink";
import HeaderBox from "@/components/ui/headerBox";
import { getAccounts } from "@/lib/server/accounts";
import { getLoggedInUser } from "@/lib/actions/user.action";
import { ownerIdOf } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: "Connect a bank",
  description: "Link a bank through Plaid or Setu, or import a statement export.",
};

const ConnectBank = async () => {
  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const accounts = await getAccounts({ userId: ownerIdOf(loggedIn) });
  const accountsData: Account[] = accounts?.data ?? [];
  const count = (provider: string) => accountsData.filter((a) => (a.provider ?? "plaid") === provider).length;

  return (
    <section className="page">
      <HeaderBox
        eyebrow="Gateway // connect institutions"
        title="Connect a bank"
        subtext="Three ways in: a US bank through Plaid, an Indian bank through the Account Aggregator network, or a statement export from net banking."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <ProviderCard
          index="01"
          icon={Landmark}
          title="Plaid"
          region="United States · sandbox"
          linked={count("plaid")}
          description="Checking and savings at US banks with instant sign-in. Uses the Plaid sandbox, so pick any institution and sign in with the test credentials."
          facts={[
            ["Sync", "Real time"],
            ["Transfers", "Supported"],
          ]}
        >
          <PlaidLink user={loggedIn} />
        </ProviderCard>

        <ProviderCard
          index="02"
          icon={ShieldCheck}
          title="Setu Account Aggregator"
          region="India · sandbox"
          linked={count("setu")}
          description="Indian bank accounts through the RBI-regulated Account Aggregator consent flow. You approve sharing on the AA, then return here."
          facts={[
            ["Consent", "Read only"],
            ["Validity", "Renewable"],
          ]}
          accent
        >
          <SetuLink user={loggedIn} />
        </ProviderCard>

        <ProviderCard
          index="03"
          icon={FileSpreadsheet}
          title="Statement import"
          region="Any bank · real data"
          linked={count("manual")}
          description="Upload a CSV or XLSX export from your net banking. Columns are detected automatically and you confirm before anything is saved."
          facts={[
            ["Formats", "CSV, XLSX"],
            ["Storage", "This app only"],
          ]}
        >
          <a href="#statement" className="btn-secondary w-full">
            Upload a statement
          </a>
        </ProviderCard>
      </div>

      <section id="statement" className="panel scroll-mt-6">
        <header className="panel-head">
          <div className="flex items-center gap-2">
            <span className="eyebrow">Statement import</span>
            <span className="eyebrow text-ink">{"// preview, then import"}</span>
          </div>
          <span className="chip">
            <span className="dot bg-lime" />
            Parser ready
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
  index,
  icon: Icon,
  title,
  region,
  linked,
  description,
  facts,
  accent = false,
  children,
}: {
  index: string;
  icon: typeof Landmark;
  title: string;
  region: string;
  linked: number;
  description: string;
  facts: [string, string][];
  accent?: boolean;
  children: React.ReactNode;
}) => (
  <article className="panel flex flex-col">
    <header className="panel-head">
      <span className="eyebrow">Method {"// "}{index}</span>
      <span className={linked > 0 ? "chip-lime" : "chip"}>{linked > 0 ? `${linked} linked` : "Not linked"}</span>
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
