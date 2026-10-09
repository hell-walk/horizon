import type { Metadata } from "next";
import React from 'react'

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a Horizon account and connect your first bank in minutes.",
  robots: { index: true, follow: true },
};
import AuthForm from '@/components/authForm'
const SignUp = async () => {
  return (
    <section className="flex w-full justify-center">
      <AuthForm type="sign-up" />
    </section>
  )
}

export default SignUp 