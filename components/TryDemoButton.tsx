"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { startDemoSession } from "@/lib/supabase-browser";

/** Opens a private copy of the Demo Restaurant, with no sign-up. */
export default function TryDemoButton({ label = "Try the demo", className = "btn btn-primary cta" }: { label?: string; className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          const err = await startDemoSession();
          if (err) {
            setError(err);
            setLoading(false);
            return;
          }
          router.push("/restaurant");
        }}
      >
        {loading ? "Opening the demo…" : label}
      </button>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
