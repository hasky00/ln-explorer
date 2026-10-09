import type { Metadata } from "next";
import Link from "next/link";
import VoiceAsk from "@/components/VoiceAsk";

export const metadata: Metadata = {
  title: "Ask E-light",
  description: "Ask the Lightning Network out loud. A simulated Alexa+ experience powered by E-light's MCP server.",
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
