# Security rollout and recovery

## Required secrets

Set these separately in Supabase and Vercel; never commit their values:

- `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and
  `EXPO_PUBLIC_TURNSTILE_SITE_KEY`
- `RESEND_API_KEY` after verifying `auditur.app`
- `MFA_RECOVERY_PEPPER` and `RATE_LIMIT_PEPPER` as independent 32-byte random values
- Rotated `SUPABASE_SERVICE_ROLE_KEY`/secret key in Vercel only

## Supabase production settings

Before enforcing AAL2, mirror `supabase/config.toml` in the hosted project:

1. Require confirmed email, 12-character mixed passwords, leaked-password
   protection, secure password changes, and TOTP enrollment/verification.
2. Configure Turnstile for the production web hostname and the mobile WebView
   hostname `auditur.app`.
3. Configure Resend SMTP, verify the sender, and test confirmation and recovery
   delivery.
4. Use 15-minute access tokens, refresh-token rotation, an eight-hour absolute
   session limit, and a 30-minute inactivity limit.
5. Keep phone and anonymous sign-in disabled. Apply the conservative auth rate
   limits from `config.toml`.
6. Enable daily backups/PITR, SSL enforcement, database and organization audit
   logs, and MFA for every Supabase organization member.
7. Rotate production secrets after deployment and remove stale preview values.

## Deployment order

1. Deploy the API, web MFA UI, and a new mobile build.
2. Verify enrollment, challenge, recovery-code generation, and owner-assisted
   reset on production test accounts.
3. Apply `20260715130000_enforce_aal2_and_provenance.sql`.
4. Confirm AAL1 requests are denied and AAL2 requests remain tenant-scoped.

Do not apply the restrictive AAL2 migration before supported clients are live.

## Manual recovery

If a user has neither their authenticator nor a backup code:

1. Verify identity through the dealership's established offline process.
2. A different dealership owner signs in at AAL2 and uses **Team → Reset MFA**.
3. Confirm the security audit event and session revocation.
4. The member signs in again, enrolls a new factor, and stores new backup codes.

Owners cannot reset themselves through the team flow. A locked-out sole owner
requires a two-person, audited support procedure using the Supabase admin
console; support must never request an authenticator secret or recovery code.

## Residual risks

MFA does not prevent compromise of an unlocked device, malicious authorized
employees, phishing proxies, or social engineering during recovery. Minimize
these with device controls, least-privilege roles, audit review, and periodic
access recertification.
