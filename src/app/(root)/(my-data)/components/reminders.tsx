"use client";

import { BellRing, CalendarClock, Loader2, Mail, Send, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { useT } from "@/components/i18nProvider";
import ReminderLanguage from "@/components/reminderLanguage";
import type { Locale } from "@/lib/i18n/config";
import { removePushDevice, savePushDevice, sendTestReminder, setEmailReminders, setWeeklyReminder } from "@/lib/actions/notify.action";
import { cn } from "@/lib/utils";

type Props = {
  /** The site's public push key; empty when push is not set up on the server. */
  vapidKey: string;
  /** Brevo is set up on the server. */
  emailReady: boolean;
  emailOn: boolean;
  /** Monday's statement nudge is on. */
  weeklyOn: boolean;
  address: string;
  /** The language reminders are written in now. */
  reminderLocale: Locale;
};

type DeviceState = "checking" | "notReady" | "unsupported" | "needsHomeScreen" | "blocked" | "off" | "on";

// The push key is base64url text; the browser wants its bytes.
const keyBytes = (base64url: string) => {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

/**
 * Reminders before money leaves an account: on this device (web push) and by
 * email. Both off until switched on. A device is a browser: each phone or
 * computer is turned on separately.
 */
const Reminders = ({ vapidKey, emailReady, emailOn, weeklyOn, address, reminderLocale }: Props) => {
  const t = useT();
  const [device, setDevice] = useState<DeviceState>("checking");
  const [email, setEmail] = useState(emailOn);
  const [weekly, setWeekly] = useState(weeklyOn);
  const [busy, setBusy] = useState<"device" | "email" | "weekly" | "test" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // What this browser can do, and whether it already has reminders on.
  useEffect(() => {
    const check = async () => {
      // The site has no push keys yet: say so, rather than blame the browser.
      if (!vapidKey) return setDevice("notReady");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // An iPhone offers push only to a site opened from the home screen.
        const iPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
        setDevice(iPhone ? "needsHomeScreen" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setDevice("blocked");
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        setDevice((await registration.pushManager.getSubscription()) ? "on" : "off");
      } catch {
        setDevice("unsupported");
      }
    };
    void check();
  }, [vapidKey]);

  const turnDeviceOn = async () => {
    setBusy("device");
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDevice(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) }));
      const result = await savePushDevice({ subscription: subscription.toJSON() });
      if (result.ok) {
        setDevice("on");
        setMessage({ ok: true, text: t("remind.deviceOnDone") });
      } else {
        await subscription.unsubscribe();
        setMessage({ ok: false, text: result.error });
      }
    } catch {
      setMessage({ ok: false, text: t("remind.errDevice") });
    } finally {
      setBusy(null);
    }
  };

  const turnDeviceOff = async () => {
    setBusy("device");
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushDevice({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setDevice("off");
    } catch {
      setMessage({ ok: false, text: t("common.notReachable") });
    } finally {
      setBusy(null);
    }
  };

  const toggleEmail = async () => {
    setBusy("email");
    setMessage(null);
    try {
      const result = await setEmailReminders({ on: !email });
      if (result.ok) setEmail(!email);
      else setMessage({ ok: false, text: result.error });
    } catch {
      setMessage({ ok: false, text: t("common.notReachable") });
    } finally {
      setBusy(null);
    }
  };

  const toggleWeekly = async () => {
    setBusy("weekly");
    setMessage(null);
    try {
      const result = await setWeeklyReminder({ on: !weekly });
      if (result.ok) setWeekly(!weekly);
      else setMessage({ ok: false, text: result.error });
    } catch {
      setMessage({ ok: false, text: t("common.notReachable") });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    setMessage(null);
    try {
      const result = await sendTestReminder();
      if (!result.ok) setMessage({ ok: false, text: result.error });
      else if (result.push === 0 && !result.email) setMessage({ ok: false, text: t("remind.testNone") });
      else setMessage({ ok: true, text: t("remind.testSent") });
    } catch {
      setMessage({ ok: false, text: t("common.notReachable") });
    } finally {
      setBusy(null);
    }
  };

  const deviceNote: Record<DeviceState, string> = {
    checking: "",
    notReady: t("remind.errOff"),
    unsupported: t("remind.deviceUnsupported"),
    needsHomeScreen: t("remind.deviceHomeScreen"),
    blocked: t("remind.deviceBlocked"),
    off: t("remind.deviceOff"),
    on: t("remind.deviceOn"),
  };

  return (
    <section id="reminders" className="panel scroll-mt-20" aria-labelledby="reminders-title">
      <div className="panel-body flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="reminders-title" className="flex items-center gap-2 font-display text-18 font-semibold text-ink">
            <BellRing className="size-4" aria-hidden /> {t("remind.panelTitle")}
          </h2>
          <p className="text-14 text-ink-muted">{t("remind.panelBody")}</p>
        </div>

        <Option
          icon={Smartphone}
          title={t("remind.deviceTitle")}
          note={deviceNote[device]}
          on={device === "on"}
          disabled={busy !== null || !(device === "on" || device === "off")}
          working={busy === "device"}
          onToggle={device === "on" ? turnDeviceOff : turnDeviceOn}
          label={t("remind.deviceTitle")}
        />

        <Option
          icon={Mail}
          title={t("remind.emailTitle")}
          note={emailReady ? t("remind.emailNote", { address }) : t("remind.emailNotReady")}
          on={email}
          disabled={busy !== null || (!emailReady && !email)}
          working={busy === "email"}
          onToggle={toggleEmail}
          label={t("remind.emailTitle")}
        />

        <Option
          icon={CalendarClock}
          title={t("remind.weeklyTitle")}
          note={t("remind.weeklyNote")}
          on={weekly}
          disabled={busy !== null}
          working={busy === "weekly"}
          onToggle={toggleWeekly}
          label={t("remind.weeklyTitle")}
        />

        <ReminderLanguage current={reminderLocale} />

        <p className="text-12 text-ink-muted">{t("remind.privacyNote")}</p>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={test} disabled={busy !== null || (device !== "on" && !email)} className="btn-secondary w-fit">
            {busy === "test" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            {t("remind.testButton")}
          </button>
          <p role="status" className={cn("text-13", message?.ok ? "text-success" : "text-danger")}>
            {message?.text ?? ""}
          </p>
        </div>
      </div>
    </section>
  );
};

const Option = ({
  icon: Icon,
  title,
  note,
  on,
  disabled,
  working,
  onToggle,
  label,
}: {
  icon: typeof Mail;
  title: string;
  note: string;
  on: boolean;
  disabled: boolean;
  working: boolean;
  onToggle: () => void;
  label: string;
}) => (
  <div className="flex items-start gap-3 rounded-md border border-line bg-card p-3">
    <Icon className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <p className="text-14 font-semibold text-ink">{title}</p>
      {note && <p className="text-13 text-ink-muted">{note}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
        on ? "border-lime bg-lime" : "border-line bg-surface-container",
      )}
    >
      {working ? (
        <Loader2 className={cn("mx-auto size-3.5 animate-spin", on ? "text-lime-foreground" : "text-ink")} aria-hidden />
      ) : (
        // On: the dark "on lime" colour, so the knob shows against the lime in both themes.
        <span className={cn("inline-block size-4 rounded-full transition-transform", on ? "translate-x-6 bg-lime-foreground" : "translate-x-1 bg-ink")} />
      )}
    </button>
  </div>
);

export default Reminders;
