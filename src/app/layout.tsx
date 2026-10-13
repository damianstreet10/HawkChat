/**
 * Root HTML shell: fonts, global CSS, document metadata.
 * Debug here for missing fonts/CSS variables (`--font-sans`, `--font-display`)
 * or incorrect page title/description — not for auth or data fetching.
 */
import type { Metadata } from "next";
import { Inter, Rajdhani } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const display = Rajdhani({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "HawkChat — Hawk-Eye Innovations",
  description:
    "Grounded research assistant powered by Hawk-Eye Innovations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} ${display.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
