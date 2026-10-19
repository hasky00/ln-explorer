import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import WebMcpTools from "@/components/WebMcpTools";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_DESCRIPTION =
  "Ask the Bitcoin Lightning Network out loud and hear the answer. A voice-first Lightning explorer with a remote MCP server for Alexa+.";

export const metadata: Metadata = {
  metadataBase: new URL("https://ln-explorer-hasky.netlify.app"),
  title: "E-light: ask the Lightning Network out loud",
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "E-light",
    title: "E-light: ask the Lightning Network out loud",
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "E-light: ask the Lightning Network out loud",
    description: SITE_DESCRIPTION,
  },
  alternates: {
    types: {
      "application/opensearchdescription+xml": [
        { url: "/opensearch.xml", title: "E-light" },
      ],
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WebMcpTools />
        {children}
        <footer className="mt-auto border-t border-zinc-200 px-6 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
          © {new Date().getFullYear()} Hasky Labs, Copenhagen. All rights reserved. Made by Hasky Labs.
        </footer>
      </body>
    </html>
  );
}
