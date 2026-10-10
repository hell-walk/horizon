"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PlaidLinkOnSuccess, PlaidLinkOptions, usePlaidLink } from "react-plaid-link";

import { createLinkToken, exchangePublicToken } from "@/lib/actions/user.action";
import { cn } from "@/lib/utils";

import { useT } from "./i18nProvider";

// Opens Plaid Link. `primary` is the full-width button on the post-sign-up step;
// `card` sits inside the provider card on the Connect Bank page.
const PlaidLink = ({ variant = "card" }: PlaidLinkProps) => {
  const router = useRouter();
  const t = useT();
  const [token, setToken] = useState("");
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    const getLinkToken = async () => {
      const data = await createLinkToken();
      setToken(data?.linkToken ?? "");
    };
    getLinkToken();
  }, []);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    (public_token: string | null) => {
      if (!public_token) return;
      setLinking(true);
      exchangePublicToken({ publicToken: public_token }).then(() => router.push("/"));
    },
    [router]
  );

  const config: PlaidLinkOptions = { token, onSuccess };
  const { open, ready } = usePlaidLink(config);
  const busy = !ready || linking;

  return (
    <button
      type="button"
      onClick={() => open()}
      disabled={busy}
      className={cn(variant === "primary" ? "btn-primary h-12 w-full" : "btn-primary w-full")}
    >
      {linking ? (
        <>
          <Loader2 className="size-4 animate-spin" /> {t("connect.plaidLinking")}
        </>
      ) : !ready ? (
        <>
          <Loader2 className="size-4 animate-spin" /> {t("connect.plaidPreparing")}
        </>
      ) : (
        <>
          {t("connect.plaidConnect")} <ArrowRight className="size-4" />
        </>
      )}
    </button>
  );
};

export default PlaidLink;
