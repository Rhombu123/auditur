"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Upload" },
  { href: "/scan", label: "Scan" },
  { href: "/map", label: "Map" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-sm font-semibold tracking-[0.18em] text-emerald-700"
          >
            AUDITUR
          </Link>

          <div className="hidden items-center gap-2 rounded-full bg-zinc-100 p-1 sm:flex">
            {links.map((link) => {
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur sm:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-3">
          {links.map((link) => {
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center px-2 py-3 text-xs font-semibold ${
                  isActive ? "text-emerald-700" : "text-zinc-500"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
