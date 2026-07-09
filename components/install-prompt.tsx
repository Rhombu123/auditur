"use client";

import { useEffect, useState } from "react";

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isInstalledPwa(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem("auditur:install-dismissed");
    if (!dismissed && isIosDevice() && !isInstalledPwa()) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    window.localStorage.setItem("auditur:install-dismissed", "1");
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="sticky bottom-0 z-50 border-t border-emerald-200 bg-emerald-50 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg sm:hidden">
      <div className="mx-auto flex max-w-lg items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-950">Install Auditur on iPhone</p>
          <p className="mt-1 text-sm leading-6 text-emerald-900">
            Tap the Share button in Safari, then choose <strong>Add to Home Screen</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-emerald-800"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
