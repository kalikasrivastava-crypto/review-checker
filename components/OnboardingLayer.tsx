"use client";

import DemoBanner from "./DemoBanner";
import GuidedTour from "./GuidedTour";
import HelpDialog from "./HelpDialog";
import { useApp } from "./AppProvider";

/** The sample-data banner, the guided tour and the help dialog, shown over the owner's area. */
export default function OnboardingLayer() {
  const { hydrated, isDemo, restaurant, tourOpen, helpOpen } = useApp();
  return (
    <>
      {hydrated && isDemo && restaurant && <DemoBanner />}
      {tourOpen && <GuidedTour />}
      {helpOpen && <HelpDialog />}
    </>
  );
}
