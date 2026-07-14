import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
});

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className={jakarta.variable}>{children}</div>;
}
