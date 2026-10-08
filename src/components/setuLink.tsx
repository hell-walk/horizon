"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { createSetuConsent } from "@/lib/actions/setu.action";

type Props = {
  user: User;
  variant?: "primary" | "ghost" | "default";
};

/**
 * "Connect Indian bank" button. Asks for the customer's mobile number, starts a
 * Setu consent on the server and sends the browser to the AA approval page.
 * The AA redirects back to /setu/callback when the customer is done.
 */
const SetuLink = ({ user, variant = "default" }: Props) => {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await createSetuConsent({ mobile });
      if (result && "url" in result && result.url) {
        window.location.href = result.url;
        return;
      }
      setError((result && "error" in result && result.error) || "Could not start the bank connection.");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const label = "Connect Indian bank";

  const trigger =
    variant === "primary" ? (
      <Button onClick={() => setOpen((v) => !v)} className="plaidlink-primary">
        {label}
      </Button>
    ) : variant === "ghost" ? (
      <Button onClick={() => setOpen((v) => !v)} variant="ghost" className="plaidlink-ghost">
        <Image src="/icons/connect-bank.svg" alt="connect bank" width={24} height={24} />
        <p className="hidden text-[16px] font-semibold text-black-2 xl:block">{label}</p>
      </Button>
    ) : (
      <Button onClick={() => setOpen((v) => !v)} className="plaidlink-default">
        <Image src="/icons/connect-bank.svg" alt="connect bank" width={24} height={24} />
        <p className="text-[16px] font-semibold text-black-2">{label}</p>
      </Button>
    );

  return (
    <div className="flex w-full flex-col gap-2">
      {trigger}

      {open && (
        <form
          className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <label className="text-12 font-medium text-gray-700" htmlFor="setu-mobile">
            Mobile number registered with your bank
          </label>
          <Input
            id="setu-mobile"
            inputMode="numeric"
            placeholder="10-digit mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="input-class"
            autoComplete="tel-national"
          />
          {error && <p className="form-message">{error}</p>}
          <Button type="submit" disabled={loading || mobile.trim().length < 10} className="form-btn">
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> &nbsp;Starting...
              </>
            ) : (
              "Continue"
            )}
          </Button>
          <p className="text-12 text-gray-500">
            You will be taken to your Account Aggregator to approve sharing with {user.firstName ?? "Horizon"}.
          </p>
        </form>
      )}
    </div>
  );
};

export default SetuLink;
