import type { Metadata } from "next";
import Link from "next/link";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Support — Auditur",
  description: "Get help with Auditur accounts, MFA, inventory, and mobile access.",
};

export default function SupportPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">Auditur</Link>
          <Link className={styles.back} href="/">Back to Auditur</Link>
        </header>
        <article className={styles.card}>
          <p className={styles.eyebrow}>Help center</p>
          <h1>Auditur Support</h1>
          <p className={styles.lead}>
            Get help with account access, Microsoft Authenticator, dealership teams,
            inventory uploads, scanning, audits, and data requests.
          </p>

          <section>
            <h2>Account and MFA recovery</h2>
            <p>
              Use a one-time recovery code from the authenticator screen. If none are
              available, a different dealership owner can reset MFA from Team &amp;
              access after verifying your identity. Auditur support will never ask for
              your password, authenticator secret, or recovery code.
            </p>
          </section>

          <section>
            <h2>Account deletion</h2>
            <p>
              Open Profile in the mobile app and select “Delete account permanently.”
              Dealership owners must transfer ownership first. If you cannot access the
              app, contact support from your registered work email.
            </p>
          </section>

          <section>
            <h2>Contact support</h2>
            <p>
              Include a brief description and your Auditur ID when appropriate. Do not
              send passwords, recovery codes, customer PDFs, or full VIN lists by email.
            </p>
            <a className={styles.contact} href="mailto:support@auditur.app">
              support@auditur.app
            </a>
          </section>

          <section>
            <h2>Privacy</h2>
            <p>
              Review how Auditur handles account and dealership information in our{" "}
              <Link href="/privacy/"><u>Privacy Policy</u></Link>.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
