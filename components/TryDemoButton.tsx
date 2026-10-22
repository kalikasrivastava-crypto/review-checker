"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "./AppProvider";

/** Loads the sample restaurant and opens its first case report (or just opens the app if one is already set up). */
export default function TryDemoButton({ label = "Try with sample data" }: { label?: string }) {
  const router = useRouter();
  const { settings, startDemo } = useApp();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-primary cta"
      disabled={loading}
      onClick={async () => {
        if (settings) return router.push("/");
        setLoading(true);
        await startDemo();
      }}
    >
      {settings ? "Open DineTrust" : loading ? "Loading sample data…" : label}
    </button>
  );
}
