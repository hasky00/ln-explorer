"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SearchNode } from "@/lib/amboss";
import type { Note, NostrSearchResult, Person } from "@/lib/nostr-search";

type Tab = "all" | "people" | "notes" | "lightning";

const SATS_PER_BTC = 100_000_000;
const LN_NODE_REGEX = /^0[23][0-9a-f]{64}$/i;
const EXAMPLES = ["#bitcoin", "jack", "jb55@jb55.com", "ACINQ"];

function formatCapacity(sats: string): string {
  const btc = Number(sats) / SATS_PER_BTC;
  return `${btc.toLocaleString(undefined, { maximumFractionDigits: 2 })} BTC`;
}

function timeAgo(unix: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - unix);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  return new Date(unix * 1000).toLocaleDateString();
}

// Words and node aliases go to Amboss too; Nostr-only formats don't.
function wantsLightning(q: string): boolean {
  return !/^(#|npub1|nprofile1|note1|nevent1|nostr:)/i.test(q) && !q.includes("@");
}

function Avatar({ person, size }: { person: Person | null; size: number }) {
  const label = (person?.displayName || person?.name || "?").slice(0, 1);
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full bg-amber-500/15 text-center font-medium text-amber-600"
      style={{ width: size, height: size, lineHeight: `${size}px` }}
    >
      {person?.picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.picture}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      ) : (
        label.toUpperCase()
      )}
    </div>
  );
}

const card =
  "rounded-2xl border border-black/[.08] bg-white dark:border-white/[.145] dark:bg-zinc-900";

function PersonCard({ person }: { person: Person }) {
  return (
    <li className={`${card} flex gap-4 p-4`}>
      <Avatar person={person} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {person.displayName || person.name || "Unnamed"}
          {person.name && person.displayName && person.name !== person.displayName && (
            <span className="ml-2 text-sm font-normal text-zinc-500">@{person.name}</span>
          )}
        </p>
        {person.nip05 && (
          <p className="truncate text-xs text-amber-600">{person.nip05}</p>
        )}
        {person.about && (
          <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
            {person.about}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <a
            href={`https://njump.me/${person.npub}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-amber-600"
          >
            Open profile ↗
          </a>
          {person.lud16 && (
            <Link
              href={`/match?q=${person.npub}`}
              className="text-zinc-500 hover:text-amber-600"
            >
              ⚡ {person.lud16}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

function NoteCard({ note, onTag }: { note: Note; onTag: (t: string) => void }) {
  const name = note.author?.displayName || note.author?.name || note.pubkey.slice(0, 10) + "…";
  return (
    <li className={`${card} p-4`}>
      <div className="flex items-center gap-3">
        <Avatar person={note.author} size={32} />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{name}</p>
        <span className="shrink-0 text-xs text-zinc-500">{timeAgo(note.createdAt)}</span>
      </div>
      <p className="mt-3 line-clamp-6 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
        {note.content}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {note.tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTag(t)}
            className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-600 hover:bg-amber-500/20"
          >
            #{t}
          </button>
        ))}
        <a
          href={`https://njump.me/${note.nevent}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-zinc-500 hover:text-amber-600"
        >
          View note ↗
        </a>
      </div>
    </li>
  );
}

function NodeCard({ node }: { node: SearchNode }) {
  return (
    <li>
      <a
        href={`/node/${node.pubkey}`}
        className={`${card} flex items-center justify-between gap-4 px-5 py-3 hover:border-amber-500/50`}
      >
        <div className="min-w-0">
          <p className="truncate font-medium">⚡ {node.alias || "Unnamed node"}</p>
          <p className="truncate font-mono text-xs text-zinc-500">{node.pubkey}</p>
        </div>
        <div className="shrink-0 text-right text-sm text-zinc-500">
          <p>{formatCapacity(node.capacity)}</p>
          <p>{node.channel_amount} channels</p>
        </div>
      </a>
    </li>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </h2>
  );
}

export default function UniversalSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<Tab>("all");
  const [nostr, setNostr] = useState<NostrSearchResult | null>(null);
  const [nodes, setNodes] = useState<SearchNode[]>([]);
  const [loading, setLoading] = useState(initialQuery.trim() !== "");
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      window.history.replaceState(null, "", "/");
      return;
    }
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      window.history.replaceState(null, "", `/?q=${encodeURIComponent(trimmed)}`);
      const enc = encodeURIComponent(trimmed);
      const [n, l] = await Promise.allSettled([
        LN_NODE_REGEX.test(trimmed)
          ? Promise.resolve(null)
          : fetch(`/api/nostr?q=${enc}`).then((r) => r.json()),
        wantsLightning(trimmed)
          ? fetch(`/api/search?q=${enc}`).then((r) => r.json())
          : Promise.resolve({ results: [] }),
      ]);
      if (id !== requestId.current) return; // a newer search started
      const nostrData = n.status === "fulfilled" && n.value && !n.value.error ? n.value : null;
      const lnData = l.status === "fulfilled" && !l.value?.error ? l.value.results ?? [] : [];
      setNostr(nostrData);
      setNodes(lnData);
      setError(n.status === "rejected" && l.status === "rejected" ? "Search failed. Try again in a moment." : null);
      setLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [query]);

  function search(value: string) {
    setQuery(value);
    setTab("all");
    if (value.trim()) setLoading(true);
    else {
      setNostr(null);
      setNodes([]);
      setError(null);
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (LN_NODE_REGEX.test(trimmed)) router.push(`/node/${trimmed}`);
    else if (nodes.length === 1 && !nostr?.people.length && !nostr?.notes.length)
      router.push(`/node/${nodes[0].pubkey}`);
  }

  const people = nostr?.people ?? [];
  const notes = nostr?.notes ?? [];
  const hasQuery = query.trim() !== "";
  const nothing = !loading && hasQuery && !people.length && !notes.length && !nodes.length;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All", count: people.length + notes.length + nodes.length },
    { key: "people", label: "People", count: people.length },
    { key: "notes", label: "Notes", count: notes.length },
    { key: "lightning", label: "Lightning", count: nodes.length },
  ];

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={handleSubmit} role="search">
        <input
          type="search"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search names, #hashtags, npubs, nodes…"
          aria-label="Search Nostr and Lightning"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-full border border-black/[.08] bg-white px-5 py-3 text-base outline-none focus:border-amber-500 dark:border-white/[.145] dark:bg-zinc-900"
          autoFocus
        />
      </form>

      {!hasQuery && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => search(ex)}
              className="rounded-full border border-black/[.08] px-3 py-1 text-sm text-zinc-500 hover:border-amber-500 hover:text-amber-600 dark:border-white/[.145]"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {hasQuery && (
        <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-black/[.08] dark:border-white/[.145]">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm ${
                tab === t.key
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
              {!loading && t.count > 0 && <span className="ml-1 text-xs opacity-70">{t.count}</span>}
            </button>
          ))}
          <Link href="/stats" className="ml-auto shrink-0 px-3 py-2 text-sm text-zinc-500 hover:text-amber-600">
            Network
          </Link>
        </nav>
      )}

      {loading && <p className="mt-4 text-sm text-zinc-500">Searching relays…</p>}
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      {nothing && !error && <p className="mt-4 text-sm text-zinc-500">No results. Try another word or a #hashtag.</p>}

      {!loading && (
        <>
          {(tab === "all" || tab === "people") && people.length > 0 && (
            <section>
              {tab === "all" && <SectionTitle>People</SectionTitle>}
              <ul className={`flex flex-col gap-2 ${tab !== "all" ? "mt-4" : ""}`}>
                {(tab === "all" ? people.slice(0, 4) : people).map((p) => (
                  <PersonCard key={p.pubkey} person={p} />
                ))}
              </ul>
              {tab === "all" && people.length > 4 && (
                <button type="button" onClick={() => setTab("people")} className="mt-2 text-sm text-amber-600 hover:underline">
                  All {people.length} people →
                </button>
              )}
            </section>
          )}

          {(tab === "all" || tab === "lightning") && nodes.length > 0 && (
            <section>
              {tab === "all" && <SectionTitle>Lightning nodes</SectionTitle>}
              <ul className={`flex flex-col gap-2 ${tab !== "all" ? "mt-4" : ""}`}>
                {(tab === "all" ? nodes.slice(0, 3) : nodes).map((n) => (
                  <NodeCard key={n.pubkey} node={n} />
                ))}
              </ul>
              {tab === "all" && nodes.length > 3 && (
                <button type="button" onClick={() => setTab("lightning")} className="mt-2 text-sm text-amber-600 hover:underline">
                  All {nodes.length} nodes →
                </button>
              )}
            </section>
          )}

          {(tab === "all" || tab === "notes") && notes.length > 0 && (
            <section>
              {tab === "all" && <SectionTitle>Notes</SectionTitle>}
              <ul className={`flex flex-col gap-2 ${tab !== "all" ? "mt-4" : ""}`}>
                {notes.map((n) => (
                  <NoteCard key={n.id} note={n} onTag={(t) => search(`#${t}`)} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
