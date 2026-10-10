// Horizon's password rules, in one place: the sign-up and reset forms show
// them as a live checklist, and the server enforces exactly the same ones
// (user.action.ts), so the form can never promise something the server refuses.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const COMMON_PASSWORDS = new Set(["password", "password1", "password123", "12345678", "123456789", "1234567890", "qwerty123", "qwertyuiop", "iloveyou", "11111111", "00000000", "abcd1234", "admin123", "letmein1", "welcome1"]);

export type PasswordCheck = {
  /** 8 to 128 characters. */
  length: boolean;
  /** Not a well-known password, not one character repeated. */
  notCommon: boolean;
  /** Does not contain the part of the email before the @ (when it is 4+ characters). */
  noEmail: boolean;
};

export function checkPassword(password: string, email = ""): PasswordCheck {
  const lower = password.toLowerCase();
  const name = email.split("@")[0]?.toLowerCase() ?? "";
  return {
    length: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    notCommon: password.length > 0 && !COMMON_PASSWORDS.has(lower) && !/^(.)\1+$/.test(password),
    noEmail: password.length > 0 && !(name.length >= 4 && lower.includes(name)),
  };
}

/** The first rule a password breaks, as a message key, or null when it keeps them all. */
export function passwordProblemKey(password: string, email = ""): string | null {
  if (password.length < PASSWORD_MIN) return "auth.passwordTooShort";
  if (password.length > PASSWORD_MAX) return "auth.passwordTooLong";
  const check = checkPassword(password, email);
  if (!check.notCommon) return "auth.passwordCommon";
  if (!check.noEmail) return "auth.passwordHasEmail";
  return null;
}
