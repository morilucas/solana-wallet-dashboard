export class TtlCache<T> {
  private entries = new Map<string, { value: T; expires: number }>();
  constructor(private maxSize = 1000) {}
  get(key: string): T | undefined { const x=this.entries.get(key); if (!x) return; if (x.expires < Date.now()) { this.entries.delete(key); return; } return x.value; }
  set(key: string, value: T, ttlMs: number) { if (this.entries.size >= this.maxSize) this.entries.delete(this.entries.keys().next().value!); this.entries.set(key,{value,expires:Date.now()+ttlMs}); }
}
