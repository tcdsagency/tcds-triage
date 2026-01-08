"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect /settings/profile to /my-settings
export default function SettingsProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/my-settings");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Redirecting to settings...</p>
    </div>
  );
}
