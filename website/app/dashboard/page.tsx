import { AuthGate } from "@/components/auth/AuthGate";
import { TarmacDashboard } from "@/components/tarmac/TarmacDashboard";

export default function DashboardPage() {
  return (
    <AuthGate>
      <TarmacDashboard />
    </AuthGate>
  );
}
