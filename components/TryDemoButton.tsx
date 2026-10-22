"use client";

import { useRouter } from "next/navigation";
import { useApp } from "./AppProvider";
import { DEMO_SETTINGS } from "@/lib/settings";

/** Loads the demo restaurant (or just opens the app if one is already set up) and goes to the dashboard. */
export default function TryDemoButton({ label = "Try the demo" }: { label?: string }) {
  const router = useRouter();
  const { settings, setSettings, toast } = useApp();

  return (
    <button
      type="button"
      className="btn btn-primary cta"
      onClick={() => {
        if (!settings) {
          setSettings(DEMO_SETTINGS);
          toast("Demo restaurant loaded. Have a look around.", "info");
        }
        router.push("/");
      }}
    >
      {settings ? "Open DineTrust" : label}
    </button>
  );
}
