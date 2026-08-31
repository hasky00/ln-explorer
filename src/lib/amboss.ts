const AMBOSS_ENDPOINT = "https://api.amboss.space/graphql";

// Public Amboss queries (search, getNode, network metrics) work without an
// API key. A key is only needed for account-scoped/protected queries, which
// v1 doesn't use. See PLANS/LN_EXPLORER_V1_PRD.md for the open question this
// answers.
const AMBOSS_API_KEY = process.env.AMBOSS_API_KEY;

class AmbossError extends Error {}

async function ambossRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(AMBOSS_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(AMBOSS_API_KEY ? { authorization: `Bearer ${AMBOSS_API_KEY}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new AmbossError(`Amboss API responded with ${res.status}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new AmbossError(json.errors[0]?.message ?? "Amboss API error");
  }

  return json.data as T;
}

export interface SearchNode {
  alias: string | null;
  pubkey: string;
  capacity: string;
  channel_amount: string;
}

interface SearchResponse {
  search: {
    node_results: {
      num_results: number;
      results: SearchNode[];
    } | null;
  };
}

const SEARCH_QUERY = `
  query Search($query: String!) {
    search(query: $query) {
      node_results {
        num_results
        results {
          alias
          pubkey
          capacity
          channel_amount
        }
      }
    }
  }
`;

export async function searchNodes(query: string): Promise<SearchNode[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const data = await ambossRequest<SearchResponse>(SEARCH_QUERY, {
    query: trimmed,
  });
  return data.search.node_results?.results ?? [];
}

export interface NodeDetail {
  pubKey: string;
  alias: string | null;
  color: string | null;
  lastUpdate: number | null;
  capacity: string | null;
  capacityRank: number | null;
  channels: number | null;
  channelsRank: number | null;
  isClaimed: boolean;
  uptime: {
    day: string | null;
    week: string | null;
    month: string | null;
    total: string | null;
  } | null;
  socials: {
    nostr: string | null;
    nostrUsername: string | null;
    lightningAddress: string | null;
    twitter: string | null;
    website: string | null;
  };
}

interface GetNodeResponse {
  getNode: {
    graph_info: {
      node: {
        pub_key: string;
        alias: string | null;
        color: string | null;
        last_update: number | null;
      } | null;
      metrics: {
        capacity: string | null;
        capacity_rank: number | null;
        channels: number | null;
        channels_rank: number | null;
      } | null;
    } | null;
    amboss: {
      is_claimed: boolean | null;
      monitoring: {
        healthcheck: {
          percent_uptime: {
            day: string | null;
            week: string | null;
            month: string | null;
            total: string | null;
          } | null;
        } | null;
      } | null;
    } | null;
    socials: {
      info: {
        nostr: string | null;
        nostr_username: string | null;
        lightning_address: string | null;
        twitter: string | null;
        website: string | null;
      } | null;
    } | null;
  } | null;
}

const GET_NODE_QUERY = `
  query GetNode($pubkey: String!) {
    getNode(pubkey: $pubkey) {
      graph_info {
        node {
          pub_key
          alias
          color
          last_update
        }
        metrics {
          capacity
          capacity_rank
          channels
          channels_rank
        }
      }
      amboss {
        is_claimed
        monitoring {
          healthcheck {
            percent_uptime {
              day
              week
              month
              total
            }
          }
        }
      }
      socials {
        info {
          nostr
          nostr_username
          lightning_address
          twitter
          website
        }
      }
    }
  }
`;

export interface NetworkStatsTrendPoint {
  date: string;
  activeNodes: number;
  activeChannels: number;
  capacity: number;
}

export interface NetworkStats {
  totalNodes: number;
  activeNodes: number;
  totalChannels: number;
  totalCapacity: string;
  /** Daily trend for the trailing window. Empty if Amboss has no history yet. */
  trend: NetworkStatsTrendPoint[];
}

interface GetNetworkStatsResponse {
  getNetworkMetrics: {
    historical_snapshots: {
      nodes: { active: number; total: number };
      channels: { channel_metrics: { sum: string; count: string } };
    };
    nodesSeries: [string, string][];
    channelsSeries: [string, string][];
    capacitySeries: [string, string][];
  };
}

const GET_NETWORK_STATS_QUERY = `
  query NetworkStats($from: String!) {
    getNetworkMetrics {
      historical_snapshots(timeRange: TODAY) {
        nodes {
          active
          total
        }
        channels {
          channel_metrics {
            sum
            count
          }
        }
      }
      nodesSeries: historical_series(from: $from, metric: active_nodes)
      channelsSeries: historical_series(from: $from, metric: active_channels)
      capacitySeries: historical_series(
        from: $from
        metric: channel_metrics
        submetric: sum
      )
    }
  }
`;

const TREND_WINDOW_DAYS = 30;

function daysAgoISODate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

// Amboss returns each series as hourly [timestamp, value] pairs, newest
// first. Keep one (the most recent) sample per calendar day so the trend
// chart shows a clean daily line instead of hundreds of hourly points.
function latestPerDay(series: [string, string][]): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const [timestamp, rawValue] of series) {
    const date = timestamp.slice(0, 10);
    const value = Number(rawValue);
    if (!byDate.has(date) && Number.isFinite(value)) {
      byDate.set(date, value);
    }
  }
  return byDate;
}

export async function getNetworkStats(): Promise<NetworkStats> {
  const data = await ambossRequest<GetNetworkStatsResponse>(
    GET_NETWORK_STATS_QUERY,
    { from: daysAgoISODate(TREND_WINDOW_DAYS) }
  );

  const metrics = data.getNetworkMetrics;
  const snapshot = metrics.historical_snapshots;
  const nodesByDate = latestPerDay(metrics.nodesSeries);
  const channelsByDate = latestPerDay(metrics.channelsSeries);
  const capacityByDate = latestPerDay(metrics.capacitySeries);

  const trend: NetworkStatsTrendPoint[] = [...nodesByDate.keys()]
    .filter((date) => channelsByDate.has(date) && capacityByDate.has(date))
    .sort()
    .map((date) => ({
      date,
      activeNodes: nodesByDate.get(date)!,
      activeChannels: channelsByDate.get(date)!,
      capacity: capacityByDate.get(date)!,
    }));

  return {
    totalNodes: snapshot.nodes.total,
    activeNodes: snapshot.nodes.active,
    totalChannels: Number(snapshot.channels.channel_metrics.count),
    totalCapacity: snapshot.channels.channel_metrics.sum,
    trend,
  };
}

export async function getNode(pubkey: string): Promise<NodeDetail | null> {
  let data: GetNodeResponse;
  try {
    data = await ambossRequest<GetNodeResponse>(GET_NODE_QUERY, { pubkey });
  } catch (err) {
    if (err instanceof AmbossError && /invalid public key/i.test(err.message)) {
      return null;
    }
    throw err;
  }

  const node = data.getNode;
  if (!node?.graph_info?.node) return null;

  return {
    pubKey: node.graph_info.node.pub_key,
    alias: node.graph_info.node.alias,
    color: node.graph_info.node.color,
    lastUpdate: node.graph_info.node.last_update,
    capacity: node.graph_info.metrics?.capacity ?? null,
    capacityRank: node.graph_info.metrics?.capacity_rank ?? null,
    channels: node.graph_info.metrics?.channels ?? null,
    channelsRank: node.graph_info.metrics?.channels_rank ?? null,
    isClaimed: node.amboss?.is_claimed ?? false,
    uptime: node.amboss?.monitoring?.healthcheck?.percent_uptime ?? null,
    socials: {
      nostr: node.socials?.info?.nostr ?? null,
      nostrUsername: node.socials?.info?.nostr_username ?? null,
      lightningAddress: node.socials?.info?.lightning_address ?? null,
      twitter: node.socials?.info?.twitter ?? null,
      website: node.socials?.info?.website ?? null,
    },
  };
}
