import type { Metadata } from "next";
import { Suspense } from "react";
import GuestPage from "@/components/GuestPage";

export const metadata: Metadata = {
  title: "How was your visit?",
  description: "Tell the restaurant about your visit.",
  robots: { index: false },
};

export default function Page() {
  return (
    <Suspense fallback={<div className="guest" />}>
      <GuestPage />
    </Suspense>
  );
}
