import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  description: "Tippen bis zum Ende.",
  robots: { follow: false, index: false },
  title: "Mimi",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0a0a0a",
};

const RootLayout = ({ children }: LayoutProps<"/">) => (
  <html className={`${sans.variable} ${mono.variable}`} lang="de">
    <body>{children}</body>
  </html>
);

export default RootLayout;
