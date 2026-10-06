import { nip05, nip19 } from "nostr-tools";
import { SimplePool } from "nostr-tools/pool";
import type { Event, Filter } from "nostr-tools";

// Relays that support NIP-50 full-text search (checked live Oct 2026).
const SEARCH_RELAYS = ["wss://search.nos.today", "wss://relay.ditto.pub"];

// General relays used for hashtags, profiles by pubkey and single events.
const CONTENT_RELAYS = [
  "wss://hasky.chat",
  "wss://nos.lol",
  "wss://relay.damus.io",
  "wss://relay.primal.net",
];

// Profile (kind 0) lookups: purplepag.es specialises in profiles.
const PROFILE_RELAYS = [
  "wss://purplepag.es",
  "wss://relay.ditto.pub",
  "wss://relay.primal.net",
  "wss://hasky.chat",
];

const QUERY_WAIT_MS = 3500;
const NOTE_LIMIT = 20;
const PEOPLE_LIMIT = 12;

export type QueryKind =
  | "hashtag"
  | "npub"
  | "note"
  | "nip05"
  | "node"
  | "text"
  | "empty";

export interface Person {
  pubkey: string;
  npub: string;
  name: string | null;
  displayName: string | null;
  picture: string | null;
  about: string | null;
  nip05: string | null;
  lud16: string | null;
}

export interface Note {
  id: string;
  nevent: string;
  pubkey: string;
  content: string;
  createdAt: number;
  tags: string[];
  author: Person | null;
}

export interface NostrSearchResult {
  query: string;
  kind: QueryKind;
  people: Person[];
  notes: Note[];
}

const LN_NODE_REGEX = /^0[23][0-9a-f]{64}$/i;

export function classifyQuery(raw: string): { kind: QueryKind; value: string } {
  const q = raw.trim();
  if (!q) return { kind: "empty", value: "" };
  if (/^#[^\s#]+/.test(q)) {
    return { kind: "hashtag", value: q.slice(1).split(/\s/)[0].toLowerCase() };
  }
  if (LN_NODE_REGEX.test(q)) return { kind: "node", value: q.toLowerCase() };
  if (/^(nostr:)?(npub1|nprofile1)[0-9a-z]+$/i.test(q)) {
    return { kind: "npub", value: q.replace(/^nostr:/i, "") };
  }
  if (/^(nostr:)?(note1|nevent1)[0-9a-z]+$/i.test(q)) {
    return { kind: "note", value: q.replace(/^nostr:/i, "") };
  }
  if (nip05.isNip05(q)) return { kind: "nip05", value: q.toLowerCase() };
  return { kind: "text", value: q };
}

function toPerson(event: Event): Person | null {
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(event.content);
  } catch {
    return null;
  }
  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null;
  return {
    pubkey: event.pubkey,
    npub: nip19.npubEncode(event.pubkey),
    name: str(c.name),
    displayName: str(c.display_name) ?? str(c.displayName),
    picture: str(c.picture),
    about: str(c.about),
    nip05: str(c.nip05),
    lud16: str(c.lud16),
  };
}

function toNote(event: Event, authors: Map<string, Person>): Note {
  return {
    id: event.id,
    nevent: nip19.neventEncode({ id: event.id, author: event.pubkey }),
    pubkey: event.pubkey,
    content: event.content.slice(0, 1200),
    createdAt: event.created_at,
    tags: [
      ...new Set(
        event.tags
          .filter((t) => t[0] === "t" && t[1])
          .map((t) => t[1].toLowerCase())
      ),
    ].slice(0, 6),
    author: authors.get(event.pubkey) ?? null,
  };
}

async function query(
  pool: SimplePool,
  relays: string[],
  filter: Filter
): Promise<Event[]> {
  try {
    return await pool.querySync(relays, filter, { maxWait: QUERY_WAIT_MS });
  } catch {
    return [];
  }
}

function dedupe(events: Event[]): Event[] {
  const seen = new Set<string>();
  return events.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

// Keep only the newest kind-0 per pubkey, preserving first-seen (relevance) order.
function latestProfiles(events: Event[]): Person[] {
  const best = new Map<string, Event>();
  const order: string[] = [];
  for (const e of events) {
    const prev = best.get(e.pubkey);
    if (!prev) order.push(e.pubkey);
    if (!prev || e.created_at > prev.created_at) best.set(e.pubkey, e);
  }
  return order
    .map((pk) => toPerson(best.get(pk)!))
    .filter((p): p is Person => p !== null);
}

async function profilesFor(
  pool: SimplePool,
  pubkeys: string[]
): Promise<Map<string, Person>> {
  const unique = [...new Set(pubkeys)].slice(0, 50);
  const map = new Map<string, Person>();
  if (!unique.length) return map;
  const events = await query(pool, PROFILE_RELAYS, {
    kinds: [0],
    authors: unique,
  });
  for (const p of latestProfiles(events)) map.set(p.pubkey, p);
  return map;
}

async function notesWithAuthors(
  pool: SimplePool,
  events: Event[]
): Promise<Note[]> {
  const sorted = dedupe(events)
    .filter((e) => e.kind === 1)
    .slice(0, NOTE_LIMIT * 2);
  const authors = await profilesFor(
    pool,
    sorted.map((e) => e.pubkey)
  );
  return sorted.slice(0, NOTE_LIMIT).map((e) => toNote(e, authors));
}

async function pubkeyFromQuery(kind: QueryKind, value: string) {
  if (kind === "npub") {
    const d = nip19.decode(value);
    if (d.type === "npub") return d.data;
    if (d.type === "nprofile") return d.data.pubkey;
  }
  if (kind === "nip05") {
    const pointer = await nip05.queryProfile(value).catch(() => null);
    return pointer?.pubkey ?? null;
  }
  return null;
}

export async function searchNostr(raw: string): Promise<NostrSearchResult> {
  const { kind, value } = classifyQuery(raw);
  const result: NostrSearchResult = { query: raw, kind, people: [], notes: [] };
  if (kind === "empty" || kind === "node") return result;

  const pool = new SimplePool();
  try {
    if (kind === "hashtag") {
      const events = await query(pool, CONTENT_RELAYS, {
        kinds: [1],
        "#t": [value],
        limit: NOTE_LIMIT,
      });
      events.sort((a, b) => b.created_at - a.created_at);
      result.notes = await notesWithAuthors(pool, events);
      return result;
    }

    if (kind === "npub" || kind === "nip05") {
      const pubkey = await pubkeyFromQuery(kind, value);
      if (!pubkey) return result;
      const [profiles, notes] = await Promise.all([
        profilesFor(pool, [pubkey]),
        query(pool, [...CONTENT_RELAYS, "wss://relay.ditto.pub"], {
          kinds: [1],
          authors: [pubkey],
          limit: NOTE_LIMIT,
        }),
      ]);
      const person = profiles.get(pubkey);
      if (person) result.people = [person];
      notes.sort((a, b) => b.created_at - a.created_at);
      result.notes = dedupe(notes)
        .slice(0, NOTE_LIMIT)
        .map((e) => toNote(e, profiles));
      return result;
    }

    if (kind === "note") {
      const d = nip19.decode(value);
      const id =
        d.type === "note" ? d.data : d.type === "nevent" ? d.data.id : null;
      if (!id) return result;
      const events = await query(pool, CONTENT_RELAYS, { ids: [id] });
      result.notes = await notesWithAuthors(pool, events);
      return result;
    }

    // Plain words: full-text search for people and notes in parallel.
    const [people, notes] = await Promise.all([
      query(pool, SEARCH_RELAYS, {
        kinds: [0],
        search: value,
        limit: PEOPLE_LIMIT,
      }),
      query(pool, SEARCH_RELAYS, {
        kinds: [1],
        search: value,
        limit: NOTE_LIMIT,
      }),
    ]);
    result.people = latestProfiles(people).slice(0, PEOPLE_LIMIT);
    result.notes = await notesWithAuthors(pool, notes);
    return result;
  } finally {
    pool.destroy();
  }
}
