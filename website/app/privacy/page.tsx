import type { Metadata } from "next";
import Link from "next/link";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy — Auditur",
  description: "How Auditur collects, uses, protects, and deletes customer data.",
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">Auditur</Link>
          <Link className={styles.back} href="/">Back to Auditur</Link>
        </header>
        <article className={styles.card}>
          <p className={styles.eyebrow}>Legal</p>
          <h1>Privacy Policy</h1>
          <p className={styles.updated}>Effective July 15, 2026</p>
          <p className={styles.lead}>
            Auditur helps dealership teams reconcile vehicle inventory. This policy
            explains the information we process to provide and secure that service.
          </p>

          <section>
            <h2>Information we collect</h2>
            <ul>
              <li>Account details such as name, work email, Auditur ID, and team role.</li>
              <li>Dealership membership, role permissions, and security audit records.</li>
              <li>Inventory PDFs, VIN information, audit status, and vehicle scan records.</li>
              <li>Location and accuracy when a user chooses to record a vehicle scan.</li>
              <li>Device, session, MFA, abuse-prevention, and diagnostic information.</li>
            </ul>
            <p>
              Camera images are used to recognize VIN information. Auditur does not
              sell personal information or use dealership data for advertising.
            </p>
          </section>

          <section>
            <h2>How we use information</h2>
            <p>
              We use information to authenticate users, enforce dealership access,
              process inventory, map and verify scans, generate audits, provide support,
              prevent abuse, and maintain the security and reliability of Auditur.
            </p>
          </section>

          <section>
            <h2>Service providers</h2>
            <p>
              Auditur uses providers including Supabase for authentication and data,
              Vercel for web and API hosting, Cloudflare for bot protection, Resend for
              account email, Expo for mobile delivery, and Apple for App Store services.
              They process information only to provide their contracted services.
            </p>
          </section>

          <section>
            <h2>Retention and deletion</h2>
            <p>
              Users can permanently delete their account from the Profile screen.
              Sign-in details, profile data, team membership, MFA factors, and recovery
              codes are deleted. Dealership operational records may be retained for the
              dealership&apos;s legitimate audit and business needs, but are detached
              from the deleted user. Owners must transfer dealership ownership first.
            </p>
          </section>

          <section>
            <h2>Security and choices</h2>
            <p>
              Auditur uses mandatory authenticator MFA, encrypted transport, secure
              device storage, tenant isolation, least-privilege permissions, rate
              limits, and audit logging. Users can restrict camera or location access
              through device settings, although related features may stop working.
            </p>
          </section>

          <section>
            <h2>Children and changes</h2>
            <p>
              Auditur is a business service and is not directed to children under 13.
              We may update this policy as the product or legal requirements change and
              will post the revised effective date here.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>Contact us with privacy questions or requests.</p>
            <a className={styles.contact} href="mailto:privacy@auditur.app">
              privacy@auditur.app
            </a>
          </section>
        </article>
      </div>
    </main>
  );
}
