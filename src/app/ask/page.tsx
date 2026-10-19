import type { Metadata } from "next";
import Link from "next/link";
import VoiceAsk from "@/components/VoiceAsk";

const ASK_TITLE = "Ask E-light: talk to the Lightning Network";
const ASK_DESCRIPTION =
  "Tap, ask out loud, and hear the answer. Try: \"How big is the Lightning Network?\" or \"Tell me about ACINQ\". Powered by E-light's MCP server for Alexa+.";

export const metadata: Metadata = {
  title: ASK_TITLE,
  description: ASK_DESCRIPTION,
  openGraph: { title: ASK_TITLE, description: ASK_DESCRIPTION, url: "/ask", siteName: "E-light", type: "website" },
  twitter: { card: "summary_large_image", title: ASK_TITLE, description: ASK_DESCRIPTION },
};

export default function AskPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <Link href="/" className="text-sm text-amber-600 hover:underline">
        ← Back to search
      </Link>

      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold">Ask E-light</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Ask the Lightning Network out loud. Every answer comes from E-light&apos;s MCP
          server, the same one Alexa+ connects to.
        </p>
      </div>

      <VoiceAsk />
    </div>
  );
}
