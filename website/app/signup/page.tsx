"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AuthLoading, AuthShell } from "@/components/auth/AuthShell";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { useAuth } from "@/lib/auth-context";
import { sanitizeReturnTo } from "@/lib/auth-redirect";

function SignupContent() {
  const {
    session,
    loading,
    signUpWithPassword,
    resendSignupConfirmation,
    isAdminBypass,
  } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get("next"));
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (session || isAdminBypass)) {
      router.replace(returnTo);
    }
  }, [loading, session, isAdminBypass, router, returnTo]);

  if (loading) return <AuthLoading />;
  if (session || isAdminBypass) return null;

  return (
    <AuthShell
      title="Create your account"
      subtitle="Choose your role and create an account with your work email and password."
      footer={
        <>
          Already registered?{" "}
          <Link href={`/login/?next=${encodeURIComponent(returnTo)}`}>Sign in</Link>
        </>
      }
    >
      {confirmationEmail ? (
        <div className="auth-confirmation">
          <strong>Check your work email</strong>
          <p>
            Confirm {confirmationEmail}, then sign in to set up Microsoft
            Authenticator.
          </p>
          <button
            type="button"
            className="auth-btn"
            onClick={() =>
              void resendSignupConfirmation(confirmationEmail).then(() =>
                setConfirmationMessage("A new confirmation email was sent."),
              )
            }
          >
            Resend confirmation
          </button>
          {confirmationMessage ? <p>{confirmationMessage}</p> : null}
        </div>
      ) : (
        <EmailAuthForm
          mode="signup"
          onSubmit={async (email, password, signup, captchaToken) => {
            if (!signup) throw new Error("Complete your account details.");
            const result = await signUpWithPassword(
              email,
              password,
              signup,
              captchaToken,
            );
            if (result === "confirmation-required") {
              setConfirmationEmail(email.trim().toLowerCase());
            } else {
              router.replace(returnTo);
            }
          }}
        />
      )}
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <SignupContent />
    </Suspense>
  );
}
