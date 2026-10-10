// A small HTTP client that talks to Horizon the way an attacker would: raw
// requests, server actions called by id, no browser and no UI checks.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const BASE = (process.env.HORIZON_URL ?? "http://localhost:3100").replace(/\/$/, "");
const ROOT = join(__dirname, "../..");

/** Server action ids from the production build the server is running. */
export function actionIds(): Record<string, string> {
  const manifest = join(ROOT, ".next/server/server-reference-manifest.json");
  if (!existsSync(manifest)) return {};
  const m = JSON.parse(readFileSync(manifest, "utf8")) as { node: Record<string, { exportedName: string }> };
  return Object.fromEntries(Object.entries(m.node).map(([id, v]) => [v.exportedName, id]));
}

export async function serverIsUp() {
  try {
    const res = await fetch(`${BASE}/sign-in`, { redirect: "manual" });
    return res.status < 500;
  } catch {
    return false;
  }
}

export type ActionResult = { status: number; value: unknown; raw: string; setCookies: string[] };

type CallOptions = { cookie?: string; origin?: string | null; headers?: Record<string, string>; path?: string };

async function send(name: string, body: BodyInit, contentType: string | null, opts: CallOptions = {}): Promise<ActionResult> {
  const id = actionIds()[name];
  if (!id) throw new Error(`No server action named ${name} in the build`);
  const headers: Record<string, string> = { "Next-Action": id, Accept: "text/x-component", ...opts.headers };
  if (contentType) headers["Content-Type"] = contentType;
  if (opts.origin !== null) headers.Origin = opts.origin ?? BASE;
  if (opts.cookie) headers.Cookie = opts.cookie;
  const res = await fetch(`${BASE}${opts.path ?? "/sign-in"}`, { method: "POST", headers, body, redirect: "manual" });
  const raw = await res.text();
  // The action's return value is the RSC row with id 1.
  const row = raw.split("\n").find((l) => l.startsWith("1:"));
  let value: unknown = undefined;
  if (row) {
    try {
      value = JSON.parse(row.slice(2));
    } catch {
      value = row.slice(2);
    }
  }
  return { status: res.status, value, raw, setCookies: res.headers.getSetCookie() };
}

/** Calls a server action with plain JSON arguments. */
export const callAction = (name: string, args: unknown[], opts?: CallOptions) =>
  send(name, JSON.stringify(args), "text/plain;charset=UTF-8", opts);

/** Calls a server action whose single argument is a FormData (as React encodes it). */
export function callFormAction(name: string, fields: Record<string, string | Blob>, opts?: CallOptions) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(`_1_${k}`, v instanceof Blob && !(v instanceof File) ? new File([v], "statement", { type: v.type }) : v);
  // The root goes last, as React sends it: the server resolves it as soon as it
  // arrives, so the parts it refers to must already be there.
  body.set("0", '["$K1"]');
  return send(name, body, null, opts);
}

export const sessionCookie = (setCookies: string[]) => setCookies.find((c) => c.startsWith("banking-session="))?.split(";")[0];

/** Signs in through the real action and returns the Cookie header to use afterwards. */
export async function signIn(email: string, password: string) {
  const result = await callAction("signIn", [{ email, password }]);
  const cookie = sessionCookie(result.setCookies);
  if (!cookie) throw new Error(`Sign-in failed for the test account: ${JSON.stringify(result.value)}`);
  return { cookie, result };
}

export async function getPage(path: string, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });
  return { status: res.status, location: res.headers.get("location"), headers: res.headers, html: await res.text() };
}

export const accounts = {
  a: { email: process.env.HORIZON_TEST_EMAIL ?? "", password: process.env.HORIZON_TEST_PASSWORD ?? "" },
  b: { email: process.env.HORIZON_TEST_EMAIL_2 ?? "", password: process.env.HORIZON_TEST_PASSWORD_2 ?? "" },
};
export const haveAccounts = Boolean(accounts.a.email && accounts.a.password && accounts.b.email && accounts.b.password);

/** Values from the local .env (Appwrite ids for the direct-access test); never printed. */
export function localEnv(): Record<string, string> {
  const file = join(ROOT, ".env");
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      })
  );
}
