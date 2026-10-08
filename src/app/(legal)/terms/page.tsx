import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & conditions",
  description: "The terms that apply when you use Horizon.",
};

const UPDATED = "9 October 2026";

// Template text. Review it with a lawyer before publishing; edit freely.
export default function TermsPage() {
  return (
    <>
      <h1>Terms &amp; conditions</h1>
      <p className="text-gray-500">Last updated {UPDATED}</p>

      <p>By creating an account or using Horizon you agree to these terms.</p>

      <h2>The service</h2>
      <p>
        Horizon lets you view bank accounts you connect or import and, where supported, transfer money
        between them. Horizon is not a bank and does not hold your money. Transfers are executed by our
        payment partner on your instruction.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must provide accurate information and keep your login details private.</li>
        <li>You are responsible for activity carried out with your credentials.</li>
        <li>Only connect or import accounts that belong to you or that you are authorised to access.</li>
      </ul>

      <h2>Bank data</h2>
      <p>
        Balances and transactions are shown as reported by your bank or statement. They can lag behind
        your bank&apos;s own records. Always confirm with your bank before relying on a figure.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not attempt to access other users&apos; data or interfere with the service.</li>
        <li>Do not use Horizon for anything unlawful.</li>
      </ul>

      <h2>Liability</h2>
      <p>
        Horizon is provided as is. To the extent permitted by law, we are not liable for losses arising
        from reliance on the information shown, from delays at banks or payment partners, or from
        events outside our control.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. Continued use after an update means you accept the new terms. The
        date at the top shows the current version.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms go to <a href="mailto:support@horizon.app">support@horizon.app</a>.
      </p>
    </>
  );
}
