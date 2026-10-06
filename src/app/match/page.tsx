import Link from "next/link";
import NostrMatcher from "@/components/NostrMatcher";

export default async function MatchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-32 dark:bg-black">
      <Link href="/" className="text-sm text-amber-600 hover:underline">
        ← Back to search
      </Link>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          🔍 Nostr × Lightning matcher
        </h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          Look up an npub or NIP-05 identifier and find its Lightning node,
          via the profile&apos;s published lightning address. Best-effort —
          not every profile resolves to a node.
        </p>
      </div>
      <NostrMatcher initialQuery={initialQuery} />
    </div>
  );
}
