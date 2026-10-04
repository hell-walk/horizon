import HeaderBox from "@/components/ui/headerBox";
import TotalBalanceBox from "@/components/ui/totalBalanceBox";

const Home = () => {
  const loggedIn = {firstName:"Aaditya"};
  return (
    <section className="home">
      <div className="home-content">
        <header className="home-header"><HeaderBox
          type="greeting"
          title="Welcome"
          user={loggedIn?.firstName || "Guest"}
          subtext="Access and manage your account transactions effeciently"
        />
        </header>
        <TotalBalanceBox 
        accounts={[]}
        totalBanks={1}
        totalCurrentBalance={10000}
        />
      </div>
    </section>
  );
};

export default Home;
