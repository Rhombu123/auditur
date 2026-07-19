"use client";

import { AuthProvider } from "@/lib/auth-context";
import { DealershipProvider } from "@/lib/dealership-context";
import { MfaProvider } from "@/lib/mfa-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MfaProvider>
        <DealershipProvider>{children}</DealershipProvider>
      </MfaProvider>
    </AuthProvider>
  );
}
