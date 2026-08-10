import type { Metadata } from "next";
import LegalPageLayout from "@/components/LegalPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — Outlay",
  description: "What data Outlay collects, why, and how to get it deleted.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" updated="10 August 2026">
      <p>
        Outlay is a free, open-source expense-tracking app. This page explains what data
        we collect when you use it, why, and what control you have over it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account info:</strong> your email address, a bcrypt hash of your password (never the password itself), and an optional display name.</li>
        <li><strong>Financial data you enter:</strong> expenses, categories, major transactions, recurring templates, and budgets — this is the core data the app exists to store.</li>
        <li><strong>Optional profile picture:</strong> if you upload one, it&apos;s stored with our image host, Cloudinary.</li>
        <li><strong>Push notification subscription:</strong> only if you opt in to daily reminders — used solely to send that reminder.</li>
        <li><strong>Basic usage/error data:</strong> page views and crash reports via Vercel Analytics/Speed Insights and Sentry, to keep the app fast and working. These are not used to build an advertising profile of you.</li>
      </ul>

      <h2>Why we collect it</h2>
      <p>
        Solely to provide the service: storing and showing you your own expense data, authenticating
        you, and sending the reminders you opted into. We don&apos;t sell data, and we don&apos;t
        share it with anyone except the infrastructure providers required to run the app:
      </p>
      <ul>
        <li><strong>MongoDB Atlas</strong> — database hosting.</li>
        <li><strong>Vercel</strong> — application hosting.</li>
        <li><strong>Resend</strong> — transactional email (OTP verification, password reset, email change).</li>
        <li><strong>Cloudinary</strong> — profile picture storage, only if you upload one.</li>
        <li><strong>Sentry</strong> — error monitoring, so bugs can be found and fixed.</li>
      </ul>

      <h2>Where your data lives</h2>
      <p>
        Every query — reads and writes — is scoped to your account via a verified login token.
        There is no code path where another user can read or write your data.
      </p>

      <h2>How long we keep it</h2>
      <p>
        For as long as your account exists. You can permanently delete your account at any time from
        <strong> Settings → Delete Account</strong>. This immediately and irreversibly removes your
        expenses, categories, transactions, budgets, recurring templates, profile picture, and account
        record — nothing is retained afterward.
      </p>

      <h2>Cookies</h2>
      <p>
        We use two cookies, both <code>httpOnly</code> (invisible to page scripts) and used only to
        keep you signed in: a short-lived login token, and an optional longer-lived one if you check
        &quot;remember me&quot; at login. Neither is used for tracking or advertising.
      </p>

      <h2>Your rights</h2>
      <p>
        You can view, correct, or delete your data yourself at any time from Settings. For anything
        else — a question, a data request, or a concern about how your data is handled — reach us at{" "}
        <a href="mailto:heyitsme3519@gmail.com">heyitsme3519@gmail.com</a> or via{" "}
        <a href="https://github.com/umang519/expense-tracker/issues" target="_blank" rel="noopener noreferrer">
          GitHub Issues
        </a>.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If this policy changes meaningfully, we&apos;ll update the date at the top of this page. Since
        the project is open source, you can also see the exact change in the{" "}
        <a href="https://github.com/umang519/expense-tracker" target="_blank" rel="noopener noreferrer">
          public commit history
        </a>.
      </p>
    </LegalPageLayout>
  );
}
