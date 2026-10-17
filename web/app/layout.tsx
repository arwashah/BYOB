import type { Metadata, Viewport } from "next";
import { Figtree, Quicksand } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
// Stand-in for Monolog (not on Google Fonts): round, even-stroke, wide geometric.
// To use the real file, swap this for next/font/local pointing at the .woff2.
const heading = Quicksand({ variable: "--font-heading", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "BYOB",
  description: "Bring Your Own Benefits: a safety net for one-person businesses",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${heading.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
