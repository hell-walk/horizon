import HeaderBox from "@/components/ui/headerBox";
import TotalBalanceBox from "@/components/ui/totalBalanceBox";
import RightSideBar from "@/components/rightSideBar";
import { getLoggedInUser } from "@/lib/actions/userAction";

const Home = async() => {
  const loggedIn = await getLoggedInUser();
  return (
    <section className="home">
      <div className="home-content">
        <header className="home-header"><HeaderBox
          type="greeting"
          title="Welcome"
          user={loggedIn?.name || "Guest"}
          subtext="Access and manage your account transactions effeciently"
        />
          <TotalBalanceBox
            accounts={[]}
            totalBanks={1}
            totalCurrentBalance={10000}
          />
        </header>
         recent transactions
      </div>
       <RightSideBar 
         user={loggedIn}
         transactions={[]}
         banks={[{currentBalance: 100}, {currentBalance: 15000}]}
      />
    </section>
  );
};

export default Home;
