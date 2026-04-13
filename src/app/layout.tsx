import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Hunch",
  description: "The number guessing game that reveals how well you know your friends.",
  metadataBase: new URL("https://guessing-the-guess.vercel.app"),
  openGraph: {
    title: "Hunch — How well do you know your friends?",
    description: "Guess your friends' numbers. Closest wins. Find out who really knows who.",
    url: "https://guessing-the-guess.vercel.app",
    siteName: "Hunch",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hunch — The number guessing game",
    description: "Guess your friends' numbers. Closest wins.",
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
