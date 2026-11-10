import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import "../styles/transitions.css";
import { PwaRegister } from "@/components/pwa-register";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Hall Ledger | Classroom Availability",
  description: "Free rooms, timetable conflicts, and a published weekly schedule for each school.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Hall Ledger" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={figtree.variable}>
      <body className="antialiased"><PwaRegister />{children}</body>
    </html>
  );
}
