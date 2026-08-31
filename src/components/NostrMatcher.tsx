"use client";

import { useState } from "react";
import Link from "next/link";
import type { MatchResult } from "@/app/api/match/route";

const SATS_PER_BTC = 100_000_000;

function formatCapacity(sats: string | null): string {
  if (sats === null) return "Unknown";
  const btc = Number(sats) / SATS_PER_BTC;
  return `${btc.toLocaleString(undefined, { maximumFractionDigits: 2 })} BTC`;
}

export default function NostrMatcher() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/match?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data as MatchResult);
    } catch {
      setError("Matching failed. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="npub1… or name@domain.com"
          className="w-full rounded-full border border-black/[.08] bg-white px-5 py-3 text-base outline-none focus:border-amber-500 dark:border-white/[.145] dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="shrink-0 rounded-full bg-amber-500 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          Match
        </button>
      </form>

      {loading && <p className="mt-3 text-sm text-zinc-500">Resolving…</p>}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {result && !loading && !error && (
        <div className="mt-4 rounded-2xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-900">
          {result.status === "no_profile" && (
            <p className="text-sm text-zinc-500">
              No Nostr profile found for that identifier.
            </p>
          )}

          {result.status === "no_lightning_address" && (
            <p className="text-sm text-zinc-500">
              Found the Nostr profile
              {result.profile.displayName || result.profile.name
                ? ` for ${result.profile.displayName || result.profile.name}`
                : ""}
              , but it doesn&apos;t have a lightning address (
              <code>lud16</code>) set.
            </p>
          )}

          {result.status === "unresolvable_address" && (
            <p className="text-sm text-zinc-500">
              Found the lightning address{" "}
              <span className="font-mono">{result.lightningAddress}</span>,
              but it doesn&apos;t expose a backing LN node — this is common
              for custodial wallets.
            </p>
          )}

          {result.status === "matched" && (
            <div className="flex flex-col gap-3">
              <span className="w-fit rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">
                Matched via Nostr
              </span>
              <div className="flex items-center gap-4">
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-black/[.08] dark:border-white/[.145]"
                  style={{ backgroundColor: result.node.color ?? "#999" }}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {result.node.alias || "Unnamed node"}
                  </p>
                  <p className="truncate font-mono text-xs text-zinc-500">
                    {result.node.pubKey}
                  </p>
                </div>
                <p className="ml-auto shrink-0 text-sm text-zinc-500">
                  {formatCapacity(result.node.capacity)}
                </p>
              </div>
              <Link
                href={`/node/${result.node.pubKey}`}
                className="text-sm text-amber-600 hover:underline"
              >
                View node detail →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
