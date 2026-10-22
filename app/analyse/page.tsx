import type { Metadata } from "next";
import Link from "next/link";
import AnalyseApp from "@/components/AnalyseApp";

export const metadata: Metadata = {
  title: "DineTrust · Analyse reviews",
  description: "Upload customer reviews and see what guests keep mentioning.",
};

export default function AnalysePage() {
  return (
    <div className="shell narrow-shell">
      <header className="masthead">
        <h1>
          <Link href="/" className="masthead-title">
            DineTrust
          </Link>
        </h1>
        <p>Upload your customer reviews and see what guests keep mentioning.</p>
      </header>
      <AnalyseApp />
    </div>
  );
}
