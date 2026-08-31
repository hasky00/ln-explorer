"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchNode } from "@/lib/amboss";

const SATS_PER_BTC = 100_000_000;

function formatCapacity(sats: string): string {
  const btc = Number(sats) / SATS_PER_BTC;
  return `${btc.toLocaleString(undefined, { maximumFractionDigits: 2 })} BTC`;
}

export default function NodeSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setResults(data.results ?? []);
        setError(null);
      } catch {
        setError("Search failed. Try again in a moment.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (/^0[23][0-9a-fA-F]{64}$/.test(trimmed)) {
      router.push(`/node/${trimmed}`);
      return;
    }
    if (results.length === 1) {
      router.push(`/node/${results[0].pubkey}`);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            if (!value.trim()) {
              setResults([]);
              setError(null);
              setLoading(false);
            } else {
              setLoading(true);
            }
          }}
          placeholder="Search by alias or pubkey…"
          className="w-full rounded-full border border-black/[.08] bg-white px-5 py-3 text-base outline-none focus:border-amber-500 dark:border-white/[.145] dark:bg-zinc-900"
          autoFocus
        />
      </form>

      {loading && (
        <p className="mt-3 text-sm text-zinc-500">Searching…</p>
      )}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {!loading && !error && results.length > 0 && (
        <ul className="mt-3 divide-y divide-black/[.06] overflow-hidden rounded-2xl border border-black/[.08] bg-white dark:divide-white/[.08] dark:border-white/[.145] dark:bg-zinc-900">
          {results.map((node) => (
            <li key={node.pubkey}>
              <a
                href={`/node/${node.pubkey}`}
                className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-amber-500/5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {node.alias || "Unnamed node"}
                  </p>
                  <p className="truncate font-mono text-xs text-zinc-500">
                    {node.pubkey}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm text-zinc-500">
                  <p>{formatCapacity(node.capacity)}</p>
                  <p>{node.channel_amount} channels</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && query.trim() && results.length === 0 && (
        <p className="mt-3 text-sm text-zinc-500">No nodes found.</p>
      )}
    </div>
  );
}
