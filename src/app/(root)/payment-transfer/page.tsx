import HeaderBox from '@/components/ui/headerBox'
import React from 'react'
import { getLoggedInUser } from "@/lib/actions/user.action";
// import { redirect } from "next/navigation";
import {/* getAccount,*/ getAccounts } from "@/lib/actions/bank.actions";
import PaymentTransferForm from '@/components/PaymentTransferForm';

const PaymentTransfer = async () => {
   const loggedIn = await getLoggedInUser();
  
    const accounts = await getAccounts({ userId: loggedIn.$id });
    if (!accounts) return;
    const accountsData = accounts?.data;
  return (
    <section className="payment-transfer">
      <HeaderBox title="Payment Transfer" subtext="Please Provide any specific details or notes related to the payment transfer" />
      <section className="size-full pt-5">
        <PaymentTransferForm accounts={accountsData}/>
      </section>
    </section>
  )
}

export default PaymentTransfer 