import AnimatedCounter from "../animatedCounter";
import DoughnutChart from "../DoughnutChartLazy";

const TotalBalanceBox = ({
  accounts = [],
  totalBanks,
  totalCurrentBalance,
  totalsByCurrency,
  primaryCurrency = "USD",
}: TotlaBalanceBoxProps) => {
  // One line per currency; balances in different currencies are never added together.
  const totals = Object.entries(totalsByCurrency ?? { [primaryCurrency]: totalCurrentBalance });

  return (
    <section className="total-balance">
      <div className="total-balance-chart">
        <DoughnutChart accounts={accounts} />
      </div>
      <div className="flex flex-col gap-6">
        <h2 className="header-2">Bank Accounts: {totalBanks}</h2>
        <div className="flex flex-col gap-2">
          <p className="total-balance-label">Total Current Balance</p>
          {totals.map(([currency, total]) => (
            <div key={currency} className="total-balance-amount flex-center gap-2">
              <AnimatedCounter amount={total} currency={currency} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TotalBalanceBox;
