const SATS_PER_BTC = 100_000_000;

export function formatCapacity(sats: string | number | null): string {
  if (sats === null) return "Unknown";
  const btc = Number(sats) / SATS_PER_BTC;
  return `${btc.toLocaleString(undefined, { maximumFractionDigits: 2 })} BTC`;
}

export function formatCompactNumber(value: number): string {
  return Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
