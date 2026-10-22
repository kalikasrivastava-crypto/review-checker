import type { Metadata } from "next";
import { Fraunces, Geist, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import "./ui.css";

const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  axes: ["opsz"],
});

// Hindi text on screen and in the PDF report. Self-hosted by Next at build time, so nothing is fetched at runtime.
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari", "latin"],
  weight: ["400", "700"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DineTrust · Customer feedback insights for restaurants",
  description: "Upload your customer reviews, see the themes that keep coming up, and get practical next steps.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${geist.variable} ${devanagari.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
