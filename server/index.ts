import express from 'express';
import helmet from 'helmet'; import compression from 'compression'; import { rateLimit } from 'express-rate-limit';
import { Connection } from '@solana/web3.js'; import { z } from 'zod'; import { resolve } from 'node:path'; import { fileURLToPath } from 'node:url';
import { isValidSolanaAddress } from '../shared/utils.js'; import { fetchActivity, fetchPortfolio } from './solana.js'; import { SnapshotStore } from './snapshotStore.js';
const app=express(), port=Number(process.env.PORT||3000), rpc=process.env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com';
const connection=new Connection(rpc,{commitment:'confirmed',confirmTransactionInitialTimeout:10000}); const store=new SnapshotStore(process.env.SNAPSHOT_FILE||resolve(process.cwd(),'data/snapshots.json'));
app.disable('x-powered-by'); app.set('trust proxy',1); app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:','https:'],connectSrc:["'self'"]}}})); app.use(compression()); app.use('/api',rateLimit({windowMs:60_000,limit:Number(process.env.RATE_LIMIT_PER_MINUTE||30),standardHeaders:'draft-8',legacyHeaders:false}));
app.get('/health',(_req,res)=>res.json({status:'ok',network:'mainnet-beta',timestamp:new Date().toISOString()}));
const addressSchema=z.string().trim().refine(isValidSolanaAddress,'Invalid Solana address');
function withTimeout<T>(promise: Promise<T>, ms = 20_000): Promise<T> {
  return Promise.race([promise,new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error('RPC request timed out')),ms))]);
}
app.get('/api/portfolio/:address',async(req,res)=>{const parsed=addressSchema.safeParse(req.params.address);if(!parsed.success)return res.status(400).json({error:'Enter a valid Solana public address.'});try{const [portfolio,activities]=await withTimeout(Promise.all([fetchPortfolio(connection,parsed.data),fetchActivity(connection,parsed.data).catch(()=>[])]));const history=await store.record(parsed.data,portfolio.metrics.totalUsd);return res.json({address:parsed.data,fetchedAt:new Date().toISOString(),holdings:portfolio.holdings,...portfolio.metrics,activities,history,trackingSince:history[0].date,warnings:portfolio.warnings});}catch(e:any){console.error('portfolio request failed',e?.message);return res.status(502).json({error:'Solana data is temporarily unavailable. Public RPCs may be rate-limited; retry shortly or configure SOLANA_RPC_URL.'});}});
app.get('/api/history/:address',async(req,res)=>{const parsed=addressSchema.safeParse(req.params.address);if(!parsed.success)return res.status(400).json({error:'Invalid Solana address.'});return res.json({address:parsed.data,history:await store.get(parsed.data)});});
const here=resolve(fileURLToPath(new URL('.',import.meta.url)),'../public'); app.use(express.static(here,{maxAge:'1h',index:false})); app.get('/{*splat}',(_req,res)=>res.sendFile(resolve(here,'index.html')));
app.use((_err:any,_req:any,res:any,_next:any)=>res.status(500).json({error:'Unexpected server error.'}));
app.listen(port,()=>console.log(`Wallet Lens listening on http://localhost:${port}`));
