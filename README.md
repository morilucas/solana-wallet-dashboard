# Wallet Lens

A polished, read-only Solana portfolio dashboard. Paste any public key or connect Phantom/Solflare to see native SOL, SPL Token and Token-2022 balances, USD valuation, allocation, recent transactions, and real daily history.

## Architecture

- **Client:** React 19 + TypeScript + Vite, responsive CSS, Recharts.
- **Server:** Express 5 + `@solana/web3.js`. All RPC and Jupiter requests happen server-side.
- **Data:** Solana mainnet RPC for balances and parsed transactions; Jupiter Lite Token API and Price API v3 for metadata/pricing.
- **History:** Atomic JSON file (`data/snapshots.json`), one upserted snapshot per wallet/day, capped at 365 days. Tracking explicitly starts on first view.
- **Deployment:** one non-root, multi-stage Docker image serving the built SPA and API.

## Run locally

Requires Node.js 20+.

```bash
cp .env.example .env
npm install
npm run dev
```

Vite runs on http://localhost:5173 and proxies API requests to Express on port 3000. For a production build:

```bash
npm test
npm run build
npm start
```

Open http://localhost:3000. Environment variables are read from the process environment (use your shell, container platform, or `node --env-file=.env dist/server/index.js`; the application intentionally has no runtime dotenv dependency).

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Mainnet RPC; use a dedicated provider for production reliability |
| `PORT` | `3000` | HTTP port |
| `RATE_LIMIT_PER_MINUTE` | `30` | Per-IP API request ceiling |
| `SNAPSHOT_FILE` | `./data/snapshots.json` | Durable daily snapshot file |

No API key is required. The public RPC is usable for light traffic but routinely returns HTTP 429 under load; errors are surfaced as retryable UI states rather than hidden or fabricated.

## Docker

```bash
docker build -t wallet-lens .
docker run --rm -p 3000:3000 -v wallet-lens-data:/app/data \
  -e SOLANA_RPC_URL=https://api.mainnet-beta.solana.com wallet-lens
```

Or use the included Compose deployment, which publishes the app on
`127.0.0.1:3200` for a local reverse proxy:

```bash
docker compose up -d --build
```

For production, put the container behind TLS, mount `/app/data` persistently, set a private/mainnet RPC URL as a secret, and retain proxy rate limiting. The app's health check is `GET /health`.

## API

- `GET /health` — service status (does not expose the RPC URL).
- `GET /api/portfolio/:address` — live holdings, prices, 24h estimate, activity and snapshots.
- `GET /api/history/:address` — snapshots recorded by Wallet Lens.

Addresses are parsed as canonical 32-byte Solana public keys. API traffic is rate-limited. Security headers, restrictive CSP, compressed responses, upstream timeouts, in-memory TTL caches, escaped React rendering, and generic server errors are enabled. No secrets are sent to the browser.

## Security and wallet behavior

Wallet Lens is strictly **read-only**. Connecting requests the extension's standard public-address permission only. The code has no signing, transaction construction, seed phrase, or private-key path. Never enter a seed phrase or private key into this or any portfolio viewer. Public addresses and daily valuations are persisted; no browser-wallet credential is stored.

Remote token logos are untrusted display content and are constrained to image elements by CSP. Token names and symbols are rendered by React, not injected as HTML.

## Data limitations

- USD values and 24h changes only cover assets currently priced by Jupiter. Coverage is displayed; unpriced balances remain visible and do not silently become `$0`.
- “24h change” is an **estimate** reconstructed from each asset's current amount, current price, and `priceChange24h`. It does not account for deposits, withdrawals, trades, or intraday balance changes.
- Transaction labels are best-effort classifications of parsed instructions. Fees/status/timestamps come from RPC. The list is limited to the 12 latest signatures.
- Parsed token accounts include nonzero classic SPL and Token-2022 balances. Scam/spam tokens can appear and metadata is not an endorsement.
- Daily history is local to this installation. It begins on first view and never backfills invented values. JSON storage is appropriate for a single-container prototype; use PostgreSQL/SQLite with transactional multi-instance coordination before horizontally scaling.
- Jupiter or RPC outages may leave metadata/pricing/activity incomplete. Jupiter results are cached (metadata 24h, price 30s), batched, bounded, retried on transient failures, and fetched with upstream timeouts.

## Tests

`npm test` covers canonical address validation, raw token amount normalization, portfolio value/coverage/change calculations, parsed activity classification, and server-module startup.
