import type { Metadata } from "next";
import LegalPageLayout from "@/components/LegalPageLayout";

export const metadata: Metadata = {
  title: "Terms of Service — Outlay",
  description: "The terms for using Outlay, a free and open-source app.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service" updated="10 August 2026">
      <p>
        Outlay is a free, open-source expense-tracking app, provided as-is with no charge
        and no paid tiers. By creating an account, you agree to the terms below.
      </p>

      <h2>The service</h2>
      <p>
        Outlay lets you record expenses, categorize them, log major transactions, and view
        summaries and reports. It&apos;s free to use, and its source code is publicly available under
        the{" "}
        <a href="https://github.com/umang519/expense-tracker/blob/master/LICENSE" target="_blank" rel="noopener noreferrer">
          MIT License
        </a>.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You&apos;re responsible for keeping your login credentials secure.</li>
        <li>You&apos;re responsible for the accuracy of the data you enter — this app records what you tell it, it doesn&apos;t verify it against a bank.</li>
        <li>You may delete your account at any time from Settings, which permanently removes all associated data.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        Use the app for its intended purpose — tracking your own expenses. Don&apos;t attempt to
        access another user&apos;s data, abuse or overload the service (automated scraping, bulk
        account creation, etc.), or use it for anything illegal.
      </p>

      <h2>No warranty</h2>
      <p>
        The app is provided <strong>&quot;as is,&quot;</strong> without warranty of any kind. It is
        not a substitute for professional financial or accounting advice, and we make no guarantee
        that summaries, totals, or reports are error-free. Verify anything financially significant
        independently before relying on it.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, the maintainer of this project is not liable for any
        damages or losses arising from your use of the app, including data loss, downtime, or
        inaccuracies in recorded or summarized data.
      </p>

      <h2>Availability</h2>
      <p>
        This is a free, independently-run project — not a commercial service with an uptime
        guarantee. We aim to keep it running and your data safe, but availability isn&apos;t
        contractually guaranteed.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may be updated occasionally; the date at the top of this page reflects the most
        recent change, and — since the project is open source — the exact diff is always visible in
        the{" "}
        <a href="https://github.com/umang519/expense-tracker" target="_blank" rel="noopener noreferrer">
          public commit history
        </a>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href="mailto:heyitsme3519@gmail.com">heyitsme3519@gmail.com</a> or{" "}
        <a href="https://github.com/umang519/expense-tracker/issues" target="_blank" rel="noopener noreferrer">
          GitHub Issues
        </a>.
      </p>
    </LegalPageLayout>
  );
}
