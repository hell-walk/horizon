import type { Metadata } from "next";
import React from 'react'

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Horizon to see your accounts, balances and transactions.",
  robots: { index: true, follow: true },
};
import AuthForm from '../components/authForm'
const SignIn = () => {
  return (
    <section className="flex w-full justify-center">
      <AuthForm type="sign-in" />
    </section>
  )
}

export default SignIn 