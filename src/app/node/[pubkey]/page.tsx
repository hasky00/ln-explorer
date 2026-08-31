import Link from "next/link";
import { notFound } from "next/navigation";
import { getNode } from "@/lib/amboss";
import { formatCapacity } from "@/lib/format";
import StatCard from "@/components/StatCard";

function formatPercent(value: string | null): string {
  if (value === null) return "No data";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export default async function NodePage({
  params,
}: PageProps<"/node/[pubkey]">) {
  const { pubkey } = await params;

  const node = await getNode(pubkey);
  if (!node) notFound();

  const hasNostrMatch = Boolean(node.socials.nostr || node.socials.nostrUsername);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm text-amber-600 hover:underline">
        ← Back to search
      </Link>

      <div className="flex items-center gap-4">
        <span
          className="h-4 w-4 shrink-0 rounded-full border border-black/[.08] dark:border-white/[.145]"
          style={{ backgroundColor: node.color ?? "#999" }}
        />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">
            {node.alias || "Unnamed node"}
          </h1>
          <p className="truncate font-mono text-xs text-zinc-500">
            {node.pubKey}
          </p>
        </div>
        {node.isClaimed && (
          <span className="ml-auto shrink-0 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">
            Claimed on Amboss
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Capacity" value={formatCapacity(node.capacity)} />
        <StatCard
          label="Capacity Rank"
          value={node.capacityRank ? `#${node.capacityRank}` : "Unranked"}
        />
        <StatCard
          label="Channels"
          value={node.channels?.toLocaleString() ?? "Unknown"}
        />
        <StatCard
          label="Channels Rank"
          value={node.channelsRank ? `#${node.channelsRank}` : "Unranked"}
        />
      </div>

      <div className="rounded-2xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Uptime
        </h2>
        {node.uptime ? (
          <div className="mt-3 grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold">
                {formatPercent(node.uptime.day)}
              </p>
              <p className="text-xs text-zinc-500">24h</p>
            </div>
            <div>
              <p className="text-lg font-semibold">
                {formatPercent(node.uptime.week)}
              </p>
              <p className="text-xs text-zinc-500">7d</p>
            </div>
            <div>
              <p className="text-lg font-semibold">
                {formatPercent(node.uptime.month)}
              </p>
              <p className="text-xs text-zinc-500">30d</p>
            </div>
            <div>
              <p className="text-lg font-semibold">
                {formatPercent(node.uptime.total)}
              </p>
              <p className="text-xs text-zinc-500">All time</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            Not monitored by Amboss.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Nostr &amp; Lightning identity
        </h2>
        {hasNostrMatch || node.socials.lightningAddress ? (
          <dl className="mt-3 space-y-2 text-sm">
            {node.socials.nostr && (
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-zinc-500">Nostr</dt>
                <dd className="truncate font-mono">{node.socials.nostr}</dd>
              </div>
            )}
            {node.socials.nostrUsername && (
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-zinc-500">Nostr handle</dt>
                <dd className="truncate">{node.socials.nostrUsername}</dd>
              </div>
            )}
            {node.socials.lightningAddress && (
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-zinc-500">
                  Lightning address
                </dt>
                <dd className="truncate">{node.socials.lightningAddress}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            No linked Nostr profile found on Amboss yet.
          </p>
        )}
      </div>
    </div>
  );
}
