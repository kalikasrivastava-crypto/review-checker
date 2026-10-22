"use client";

import { usePathname } from "next/navigation";
import DemoBanner from "./DemoBanner";
import GuidedTour from "./GuidedTour";
import HelpDialog from "./HelpDialog";
import { useApp } from "./AppProvider";

/** The sample-data banner, the guided tour and the help dialog, shown over any page. */
export default function OnboardingLayer() {
  const { hydrated, mode, settings, tourOpen, helpOpen } = useApp();
  const pathname = usePathname();
  return (
    <>
      {hydrated && mode === "demo" && settings && <DemoBanner />}
      {tourOpen && pathname === "/" && <GuidedTour />}
      {helpOpen && <HelpDialog />}
    </>
  );
}
