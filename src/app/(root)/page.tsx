import HeaderBox from "@/components/ui/headerBox";
import TotalBalanceBox from "@/components/ui/totalBalanceBox";
import RightSideBar from "@/components/rightSideBar";
import { getLoggedInUser } from "@/lib/actions/user.action";
import { redirect } from "next/navigation";
import { getAccount, getAccounts } from "@/lib/actions/bank.actions";

const Home = async ({ searchParams: { id, page } }: SearchParamProps) => {
  const loggedIn = await getLoggedInUser();
  if (!loggedIn) redirect("/sign-in");

  const accounts = await getAccounts({ userId: loggedIn.$id });
  if (!accounts) return;

  const accountsData = accounts?.data;
  const appwriteItemId = (id as string) || accountsData[0]?.appwriteItemId;
  const account = appwriteItemId ? await getAccount({ appwriteItemId }) : null;

  return (
    <section className="home">
      <div className="home-content">
        <header className="home-header">
          <HeaderBox
            type="greeting"
            title="Welcome"
            user={loggedIn?.name || "Guest"}
            subtext="Access and manage your account transactions effeciently"
          />
          <TotalBalanceBox
            accounts={accountsData}
            totalBanks={accounts?.totalBanks}
            totalCurrentBalance={accounts?.totalCurrentBalance}
          />
        </header>
        recent transactions
      </div>
      <RightSideBar
        user={loggedIn}
        transactions={[accounts?.transactions]}
        banks={accountsData?.slice(0, 2)}
      />
    </section>
  );
};

export default Home;
