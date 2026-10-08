import HeaderBox from '@/components/ui/headerBox'
import React from 'react'
import { /*getAccount*/ getAccounts } from "@/lib/actions/bank.actions";
import { getLoggedInUser } from "@/lib/actions/user.action";
import { redirect } from "next/navigation";
import BankCard from '@/components/bankCard';

const MyBanks = async() => {
  const loggedIn = await getLoggedInUser();


  const accounts = await getAccounts({ userId: loggedIn.$id });
  return (
    <section>
      <div className="my-banks">
        <HeaderBox title="My Bank Account" subtext="Effortlesly Manage Your Banking Activities" />
        <div className="space-y-4">
          <h2 className="header-2">Your Cards</h2>
          <div className="flex flex-wrap gap-6">
            {accounts && accounts.data.map((a: Account) => (
              <BankCard
                key={a.id}
                account={a}
                userName={loggedIn.firstName} />
            ))}

          </div>
        </div>
      </div>
    </section>
  )
}

export default MyBanks