import Link from "next/link";
import { getNetworkStats } from "@/lib/amboss";
import { formatCapacity } from "@/lib/format";
import StatCard from "@/components/StatCard";
import TrendChart from "@/components/TrendChart";

export default async function StatsPage() {
  const stats = await getNetworkStats();

  const nodesTrend = stats.trend.map((p) => ({
    date: p.date,
    value: p.activeNodes,
  }));
  const channelsTrend = stats.trend.map((p) => ({
    date: p.date,
    value: p.activeChannels,
  }));
  const capacityTrend = stats.trend.map((p) => ({
    date: p.date,
    value: p.capacity,
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm text-amber-600 hover:underline">
        ← Back to search
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Network stats</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          An at-a-glance view of Lightning Network health, from Amboss.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Nodes"
          value={stats.totalNodes.toLocaleString()}
          sublabel={`${stats.activeNodes.toLocaleString()} active`}
        />
        <StatCard
          label="Active Nodes"
          value={stats.activeNodes.toLocaleString()}
        />
        <StatCard
          label="Total Channels"
          value={stats.totalChannels.toLocaleString()}
        />
        <StatCard
          label="Total Capacity"
          value={formatCapacity(stats.totalCapacity)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Growth trend (last {stats.trend.length || 30} days)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TrendChart label="Active nodes" points={nodesTrend} unit="count" />
          <TrendChart
            label="Active channels"
            points={channelsTrend}
            unit="count"
          />
          <TrendChart
            label="Network capacity"
            points={capacityTrend}
            unit="sats"
          />
        </div>
      </div>
    </div>
  );
}
