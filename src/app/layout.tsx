import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Social Mirror",
  description: "See yourself through the eyes of everyone who knows you.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    title: "Social Mirror — See yourself through your friends' eyes",
    description: "Play a game with friends. Get a personality portrait powered by AI. Discover the gap between how you see yourself and how others see you.",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    siteName: "Social Mirror",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Social Mirror — Personality reveals, powered by friends",
    description: "Your friends rate you. AI reveals the truth. The gap is the game.",
  },
};

// Next.js 15+ moved themeColor (and viewport, colorScheme, etc) out of `metadata`
// into a separate `viewport` export. Leaving themeColor in `metadata` under Next 16
// can emit a dev-mode warning that disrupts hydration; moving it here is the fix.
export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-950 text-white" style={{ fontFamily: 'var(--font-plus-jakarta-sans), system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
