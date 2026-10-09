"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PlaidLinkOnSuccess, PlaidLinkOptions, usePlaidLink } from "react-plaid-link";

import { createLinkToken, exchangePublicToken } from "@/lib/actions/user.action";
import { cn } from "@/lib/utils";

// Opens Plaid Link. `primary` is the full-width button on the post-sign-up step;
// `card` sits inside the provider card on the Connect Bank page.
const PlaidLink = ({ user, variant = "card" }: PlaidLinkProps) => {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    const getLinkToken = async () => {
      const data = await createLinkToken(user);
      setToken(data?.linkToken);
    };
    getLinkToken();
  }, [user]);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    (public_token: string | null) => {
      if (!public_token) return;
      setLinking(true);
      exchangePublicToken({ publicToken: public_token, user }).then(() => router.push("/"));
    },
    [user, router]
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
          <Loader2 className="size-4 animate-spin" /> Linking
        </>
      ) : !ready ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Preparing Plaid
        </>
      ) : (
        <>
          Connect via Plaid <ArrowRight className="size-4" />
        </>
      )}
    </button>
  );
};

export default PlaidLink;
