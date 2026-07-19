# Auditur App Store release

## What each EAS build is for

- `development`: installable development client; requires Metro for JavaScript.
- `preview`: installable on registered iPhones from an EAS link; JavaScript is
  bundled, so it works remotely without Metro or Xcode.
- `production`: App Store/TestFlight binary.

Internal iOS builds require an Apple Developer membership and registered device.
TestFlight builds do not require registering each tester device.

## One-time setup

1. Join the Apple Developer Program and create Auditur in App Store Connect with
   bundle ID `com.auditur.app`.
2. Authenticate and link the Expo project:

   ```sh
   npx eas-cli login
   npx eas-cli init
   ```

   `eas init` adds the real Expo owner and EAS project ID to the app config.
3. In the EAS project, create `preview` and `production` environment variables:

   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_UPLOAD_API_URL`
   - `EXPO_PUBLIC_AUTH_ENABLED=true`
   - `EXPO_PUBLIC_TURNSTILE_SITE_KEY`

   Do not add service-role, recovery-pepper, rate-limit-pepper, SMTP, or
   Turnstile secret values to EAS; those are server-only.

## Install remotely on an iPhone

```sh
npx eas-cli device:create
npx eas-cli build --platform ios --profile preview
```

Open the resulting EAS install link on the registered iPhone.

## TestFlight and App Store

```sh
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

EAS Submit uploads the binary to App Store Connect/TestFlight. In App Store
Connect, add the build to the App Store version and submit it for review.

## App Store Connect information

- Privacy Policy: `https://auditur-ruby.vercel.app/privacy/`
- Support URL: `https://auditur-ruby.vercel.app/support/`
- Category: Business
- Provide iPhone screenshots, description, keywords, age rating, and contact.
- Complete privacy labels for account identifiers, precise location used during
  scans, dealership inventory/VIN data, and security/diagnostic data.
- Explain that camera access scans VINs and location records scan evidence.
- Provide a fresh owner review account. The reviewer should enroll their own
  Microsoft Authenticator factor; never disable MFA for review.
- Explain account deletion under Profile and that dealership owners must
  transfer ownership first.

## Release gate

1. Deploy the website and API with production secrets.
2. Verify privacy/support URLs and account deletion in production.
3. Enable hosted Supabase confirmation, Turnstile, SMTP, password, session, and
   TOTP settings.
4. Complete MFA and recovery testing through TestFlight.
5. Release the supported mobile version.
6. Apply `20260715130000_enforce_aal2_and_provenance.sql` only after supported
   web and mobile clients are available.
