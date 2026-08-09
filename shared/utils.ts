import { PublicKey } from '@solana/web3.js';
import type { Holding } from './types.js';

export function isValidSolanaAddress(value: string): boolean {
  try { const key = new PublicKey(value.trim()); return key.toBase58() === value.trim() && key.toBytes().length === 32; } catch { return false; }
}
export function normalizeTokenAmount(raw: string, decimals: number): number {
  if (!/^\d+$/.test(raw) || !Number.isInteger(decimals) || decimals < 0 || decimals > 30) return 0;
  const padded = raw.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals || undefined);
  const fraction = decimals ? padded.slice(-decimals) : '';
  const value = Number(fraction ? `${whole}.${fraction}` : whole);
  return Number.isFinite(value) ? value : 0;
}
export function calculatePortfolio(holdings: Pick<Holding, 'amount'|'priceUsd'|'priceChange24h'>[]) {
  let totalUsd = 0, previousUsd = 0, comparableNow = 0, priced = 0;
  for (const h of holdings) {
    if (h.priceUsd == null || !Number.isFinite(h.priceUsd)) continue;
    priced++; const current = h.amount * h.priceUsd; totalUsd += current;
    if (h.priceChange24h != null && Number.isFinite(h.priceChange24h) && h.priceChange24h > -100) {
      comparableNow += current; previousUsd += current / (1 + h.priceChange24h / 100);
    }
  }
  const change24hUsd = previousUsd > 0 ? comparableNow - previousUsd : null;
  const change24hPercent = previousUsd > 0 ? (change24hUsd! / previousUsd) * 100 : null;
  return { totalUsd, change24hUsd, change24hPercent, pricedAssetRatio: holdings.length ? priced / holdings.length : 1 };
}
export function classifyTransaction(tx: any): string {
  const types = new Set<string>();
  for (const ix of tx?.transaction?.message?.instructions ?? []) {
    const parsedType = ix?.parsed?.type;
    const program = ix?.program;
    if (parsedType === 'swap') types.add('Swap');
    else if (parsedType?.includes('transfer')) types.add('Transfer');
    else if (program === 'stake') types.add('Stake');
  }
  return types.size ? [...types].join(' · ') : 'Program interaction';
}
