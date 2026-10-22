import type { Metadata } from "next";
import AppProvider from "@/components/AppProvider";
import OnboardingLayer from "@/components/OnboardingLayer";

export const metadata: Metadata = {
  title: "DineTrust · Restaurant",
  description: "The owner's area: check bad Google reviews against your own records.",
};

export default function RestaurantLayout({ children }: LayoutProps<"/restaurant">) {
  return (
    <AppProvider>
      <OnboardingLayer />
      {children}
    </AppProvider>
  );
}
