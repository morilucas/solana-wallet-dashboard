import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Snapshot } from '../shared/types.js';
type Database = Record<string, Snapshot[]>;
export class SnapshotStore {
  private writeQueue = Promise.resolve();
  constructor(private file: string) {}
  private async read(): Promise<Database> { try { return JSON.parse(await readFile(this.file,'utf8')) as Database; } catch (e:any) { if(e.code==='ENOENT') return {}; throw e; } }
  async get(address: string): Promise<Snapshot[]> { return (await this.read())[address] ?? []; }
  async record(address: string, totalUsd: number): Promise<Snapshot[]> {
    const operation = this.writeQueue.then(async () => {
      const db=await this.read(), date=new Date().toISOString().slice(0,10), rows=db[address]??[];
      const existing=rows.find(x=>x.date===date); if(existing) existing.totalUsd=totalUsd; else rows.push({date,totalUsd});
      db[address]=rows.sort((a,b)=>a.date.localeCompare(b.date)).slice(-365);
      await mkdir(dirname(this.file),{recursive:true}); const tmp=`${this.file}.${process.pid}.tmp`;
      await writeFile(tmp,JSON.stringify(db,null,2),{mode:0o600}); await rename(tmp,this.file); return db[address];
    }); this.writeQueue=operation.then(()=>undefined,()=>undefined); return operation;
  }
}
