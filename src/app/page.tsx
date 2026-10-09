import Link from "next/link";
import UniversalSearch from "@/components/UniversalSearch";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";

  return (
    <div className="flex flex-1 flex-col items-center gap-8 bg-zinc-50 px-4 pb-24 pt-[14vh] dark:bg-black">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">⚡ E-light</h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          Search Nostr and the Lightning Network: people, notes, #hashtags and nodes.
        </p>
        <div className="flex gap-4 text-sm">
          <Link href="/match" className="text-amber-600 hover:underline">
            Nostr → Lightning node
          </Link>
          <Link href="/stats" className="text-amber-600 hover:underline">
            Network stats
          </Link>
          <Link href="/ask" className="text-amber-600 hover:underline">
            Ask by voice
          </Link>
        </div>
      </div>
      <UniversalSearch initialQuery={initialQuery} />
    </div>
  );
}
