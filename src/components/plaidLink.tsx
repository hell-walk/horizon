"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  PlaidLinkOnSuccess,
  PlaidLinkOptions,
  usePlaidLink,
} from "react-plaid-link";

import { Button } from "./ui/button";
import { createLinkToken, exchangePublicToken } from "@/lib/actions/user.action";

const PlaidLink = ({ user, variant }: PlaidLinkProps) => {
  const router = useRouter();
  const [token, setToken] = useState("");

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

      exchangePublicToken({
        publicToken: public_token,
        user,
      }).then(() => router.push("/"));
    },
    [user, router]
  );

  const config: PlaidLinkOptions = {
    token,
    onSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  return (
    <>
      {variant === "primary" ? (
        <Button
          onClick={() => open()}
          disabled={!ready}
          className="plaidlink-primary"
        >
          Connect Bank
        </Button>
      ) : variant === "add" ? (
        <Button
          onClick={() => open()}
          disabled={!ready}
          variant="ghost"
          className="flex h-auto gap-2 p-0 hover:bg-transparent"
        >
          <Image src="/icons/plus.svg" alt="" width={20} height={20} />
          <h2 className="text-14 font-semibold text-gray-600">Add Bank</h2>
        </Button>
      ) : variant === "ghost" ? (
        <Button
          onClick={() => open()}
          variant="ghost"
          className="plaidlink-ghost"
        >
          <Image
            src="/icons/connect-bank.svg"
            alt="connect bank"
            width={24}
            height={24}
          />
          <p className="hidden text-[16px] font-semibold text-black-2 xl:block">
            Connect bank
          </p>
        </Button>
      ) : (
        <Button onClick={() => open()} className="plaidlink-default">
          <Image
            src="/icons/connect-bank.svg"
            alt="connect bank"
            width={24}
            height={24}
          />
          <p className="text-[16px] font-semibold text-black-2">Connect bank</p>
        </Button>
      )}
    </>
  );
};

export default PlaidLink;
