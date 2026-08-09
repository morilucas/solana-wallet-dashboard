import { TtlCache } from './cache.js';
import type { TokenMetadata } from '../shared/types.js';
const META='https://lite-api.jup.ag/tokens/v2/search';
const PRICE='https://lite-api.jup.ag/price/v3';
const metaCache=new TtlCache<TokenMetadata>(2000), priceCache=new TtlCache<PriceInfo>(2000);
export interface PriceInfo { priceUsd: number | null; priceChange24h: number | null; }
async function jsonFetch(url:string, timeout=7000) {
  for(let attempt=0;attempt<3;attempt++){
    const res=await fetch(url,{signal:AbortSignal.timeout(timeout),headers:{accept:'application/json','user-agent':'wallet-lens/0.1'}});
    if(res.ok)return res.json();
    if(attempt===2 || (res.status!==429 && res.status<500))throw new Error(`upstream ${res.status}`);
    const retryAfter=Number(res.headers.get('retry-after'));
    await new Promise(resolve=>setTimeout(resolve,Number.isFinite(retryAfter)?retryAfter*1000:500*(attempt+1)));
  }
  throw new Error('upstream unavailable');
}
export async function getMetadata(mints:string[]):Promise<Map<string,TokenMetadata>> {
  const out=new Map<string,TokenMetadata>();
  const missing=mints.filter(mint=>{const cached=metaCache.get(mint);if(cached)out.set(mint,cached);return !cached;});
  // Jupiter accepts comma-separated mint searches. Batching avoids hundreds of
  // simultaneous requests for wallets that contain large amounts of spam dust.
  for(let i=0;i<missing.length;i+=20){const ids=missing.slice(i,i+20);try{
    const list=await jsonFetch(`${META}?query=${encodeURIComponent(ids.join(','))}`) as any[];
    for(const token of list){const mint=token.id??token.address;if(!ids.includes(mint))continue;const m={symbol:token.symbol||mint.slice(0,4),name:token.name||'Unknown token',logoURI:token.icon??token.logoURI,decimals:Number(token.decimals??0)};metaCache.set(mint,m,86400000);out.set(mint,m);}
  }catch{/* caller uses an on-chain-address fallback */}}
  return out;
}
export async function getPrices(mints:string[]):Promise<Map<string,PriceInfo>> {
  const out=new Map<string,PriceInfo>(), missing=mints.filter(m=>{const c=priceCache.get(m);if(c)out.set(m,c);return !c;});
  for(let i=0;i<missing.length;i+=50){const ids=missing.slice(i,i+50);try{const data=await jsonFetch(`${PRICE}?ids=${ids.join(',')}`) as Record<string,any>;
    for(const mint of ids){const x=data[mint];const info={priceUsd:Number.isFinite(Number(x?.usdPrice))?Number(x.usdPrice):null,priceChange24h:Number.isFinite(Number(x?.priceChange24h))?Number(x.priceChange24h):null};priceCache.set(mint,info,30000);out.set(mint,info);}
  }catch{for(const mint of ids)out.set(mint,{priceUsd:null,priceChange24h:null});}}
  return out;
}
