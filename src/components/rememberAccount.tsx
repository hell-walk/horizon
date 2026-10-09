"use client";

import { useEffect } from "react";

import { rememberAccount } from "@/lib/selectedAccount";

// Rendered by pages that show one account: whatever account the page opened on
// (an explicit link included) becomes the app-wide active account.
const RememberAccount = ({ id }: { id?: string }) => {
  useEffect(() => {
    rememberAccount(id);
  }, [id]);
  return null;
};

export default RememberAccount;
