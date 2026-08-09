import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { Activity, Holding } from '../shared/types.js';
import { calculatePortfolio, classifyTransaction } from '../shared/utils.js';
import { getMetadata, getPrices } from './jupiter.js';
const NATIVE='So11111111111111111111111111111111111111112';
const PROGRAMS=[{id:new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),name:'spl-token' as const},{id:new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),name:'token-2022' as const}];
export async function fetchPortfolio(connection:Connection,address:string){
 const owner=new PublicKey(address), warnings:string[]=[];
 const [lamports,...tokenResults]=await Promise.all([connection.getBalance(owner,'confirmed'),...PROGRAMS.map(p=>connection.getParsedTokenAccountsByOwner(owner,{programId:p.id},'confirmed').catch(e=>{warnings.push(`${p.name} balances unavailable`);return {value:[]};}))]);
 const raw=new Map<string,{amount:number;decimals:number;program:'spl-token'|'token-2022'}>();
 tokenResults.forEach((res:any,i)=>res.value.forEach((acc:any)=>{const x=acc.account.data.parsed.info;const amount=Number(x.tokenAmount.uiAmountString);if(amount>0){const old=raw.get(x.mint);raw.set(x.mint,{amount:(old?.amount??0)+amount,decimals:x.tokenAmount.decimals,program:PROGRAMS[i].name});}}));
 const mints=[NATIVE,...raw.keys()];
 const prices=await getPrices(mints);
 // Enrich every priced asset. For very large dust/spam wallets, cap unpriced
 // metadata work; ordinary wallets still have all of their tokens enriched.
 const metadataTargets=mints.filter((mint,index)=>prices.get(mint)?.priceUsd!=null || index<=50);
 const metadata=await getMetadata(metadataTargets);
 const nativePrice=prices.get(NATIVE), nativeMeta=metadata.get(NATIVE);
 const holdings:Holding[]=[{mint:NATIVE,amount:lamports/LAMPORTS_PER_SOL,decimals:9,symbol:'SOL',name:'Solana',logoURI:nativeMeta?.logoURI,priceUsd:nativePrice?.priceUsd??null,valueUsd:nativePrice?.priceUsd!=null?(lamports/LAMPORTS_PER_SOL)*nativePrice.priceUsd:null,priceChange24h:nativePrice?.priceChange24h??null,isNative:true,program:'native'}];
 for(const [mint,x] of raw){const meta=metadata.get(mint),price=prices.get(mint);holdings.push({mint,amount:x.amount,decimals:x.decimals,symbol:meta?.symbol??`${mint.slice(0,4)}…${mint.slice(-4)}`,name:meta?.name??'Unverified token',logoURI:meta?.logoURI,priceUsd:price?.priceUsd??null,valueUsd:price?.priceUsd!=null?x.amount*price.priceUsd:null,priceChange24h:price?.priceChange24h??null,program:x.program});}
 holdings.sort((a,b)=>(b.valueUsd??-1)-(a.valueUsd??-1)); return {holdings,metrics:calculatePortfolio(holdings),warnings};
}
export async function fetchActivity(connection:Connection,address:string):Promise<Activity[]> { const key=new PublicKey(address); const sigs=await connection.getSignaturesForAddress(key,{limit:12},'confirmed'); if(!sigs.length)return[]; const txs=await connection.getParsedTransactions(sigs.map(s=>s.signature),{maxSupportedTransactionVersion:0,commitment:'confirmed'}).catch(()=>sigs.map(()=>null)); return sigs.map((s,i)=>({signature:s.signature,timestamp:s.blockTime??null,status:s.err?'Failed':'Success',feeSol:(txs[i]?.meta?.fee??0)/LAMPORTS_PER_SOL,type:txs[i]?classifyTransaction(txs[i]):'Transaction'})); }
