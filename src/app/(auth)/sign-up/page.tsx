import type { Metadata } from "next";
import React from 'react'

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a Horizon account and connect your first bank in minutes.",
  robots: { index: true, follow: true },
};
import AuthForm from '@/components/authForm'
import { getLoggedInUser } from '@/lib/actions/user.action';
const SignUp = async () => {
  return (
    <section className="flex-center size-full max-sm:px-6">
      <AuthForm type="sign-up" />
    </section>
  )
}

export default SignUp 