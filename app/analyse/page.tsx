import type { Metadata } from "next";
import AnalyseApp from "@/components/AnalyseApp";

export const metadata: Metadata = {
  title: "Analyse reviews · DineTrust",
  description: "Upload customer reviews and see the themes that keep coming up, with practical next steps.",
};

export default function AnalysePage() {
  return <AnalyseApp />;
}
