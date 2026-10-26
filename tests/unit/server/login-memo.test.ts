import { afterEach, describe, expect, it } from "vitest";

import type { SessionUser } from "@/lib/server/auth";
import { forgetLogin, profiles, sessions } from "@/lib/server/loginMemo";

const login = (id: string) => ({ value: { id } as SessionUser, expires: Date.now() + 60_000 });

describe("forgetting a login", () => {
  afterEach(() => {
    sessions.clear();
    profiles.clear();
  });

  it("drops its sessions on every device and its profile, and nobody else's", () => {
    sessions.set("phone", login("ada"));
    sessions.set("laptop", login("ada"));
    sessions.set("other", login("grace"));
    sessions.set("signed-out", { value: null, expires: Date.now() + 60_000 });
    profiles.set("ada", { value: null, expires: Date.now() + 60_000 });
    profiles.set("grace", { value: null, expires: Date.now() + 60_000 });

    forgetLogin("ada");

    expect([...sessions.keys()]).toEqual(["other", "signed-out"]);
    expect([...profiles.keys()]).toEqual(["grace"]);
  });
});
