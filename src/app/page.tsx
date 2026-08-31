import NodeSearch from "@/components/NodeSearch";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-32 dark:bg-black">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          ⚡ Lightning Network Explorer
        </h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          Search the Lightning Network by node alias or pubkey.
        </p>
      </div>
      <NodeSearch />
    </div>
  );
}
