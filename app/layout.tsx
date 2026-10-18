import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono, Outfit } from "next/font/google";
import { SiteHeader } from "@/components/shell/site-header";
import "./globals.css";

// Brand type: Outfit for the wordmark and headings, IBM Plex Mono for data
// and labels (see public/planti-logo/README.md). Geist for body text.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: {
    default: "Planti · Less guessing. More growing.",
    template: "%s · Planti",
  },
  description:
    "An intelligent plant-care agent that learns from your plant's history, combines real-time sensor data with trusted horticultural research, and helps you understand what your plants need. Planti tracks changing conditions, recommends evidence-based care, and learns from the results over time.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${outfit.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10">
          {children}
        </main>
      </body>
    </html>
  );
}
