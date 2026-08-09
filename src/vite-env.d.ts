/// <reference types="vite/client" />
interface WalletProvider { isPhantom?: boolean; isSolflare?: boolean; publicKey?: {toString():string}; connect(opts?:{onlyIfTrusted?:boolean}):Promise<{publicKey:{toString():string}}> }
interface Window { solana?: WalletProvider; solflare?: WalletProvider; }
