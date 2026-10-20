"use client";

import { useEffect } from "react";

import { accountShown } from "@/lib/accountFlip";
import { rememberAccount } from "@/lib/selectedAccount";

// Rendered by pages that show one account: whatever account the page opened on
// (an explicit link included) becomes the app-wide active account, and a
// switch waiting for this page (lib/accountFlip) can finish its animation.
const RememberAccount = ({ id }: { id?: string }) => {
  useEffect(() => {
    rememberAccount(id);
    accountShown(id);
  }, [id]);
  return null;
};

export default RememberAccount;
