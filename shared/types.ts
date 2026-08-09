export interface TokenMetadata { symbol: string; name: string; logoURI?: string; decimals: number; }
export interface Holding extends TokenMetadata { mint: string; amount: number; priceUsd: number | null; valueUsd: number | null; priceChange24h: number | null; isNative?: boolean; program: 'native' | 'spl-token' | 'token-2022'; }
export interface Activity { signature: string; timestamp: number | null; status: 'Success' | 'Failed'; feeSol: number; type: string; }
export interface Snapshot { date: string; totalUsd: number; }
export interface PortfolioResponse { address: string; fetchedAt: string; holdings: Holding[]; totalUsd: number; change24hUsd: number | null; change24hPercent: number | null; pricedAssetRatio: number; activities: Activity[]; history: Snapshot[]; trackingSince: string; warnings: string[]; }
