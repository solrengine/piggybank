# PiggyBank

A time-locked SOL savings dapp built with Ruby on Rails 8. Lock SOL in an on-chain vault for a set duration, watch a live countdown, and unlock when the timer expires — all using the Rails default stack.

Part of the [SolRengine](https://github.com/solrengine) project.

## Stack

- Ruby on Rails 8 (Hotwire, Turbo, Stimulus, Solid Queue/Cache/Cable)
- [SolRengine](https://github.com/solrengine/solrengine) — Rails framework for Solana dapps
- SQLite (primary + cache + queue + cable)
- Tailwind CSS 4 + esbuild
- [@solana/kit](https://github.com/anza-xyz/kit) for client-side transaction building
- [Wallet Standard](https://github.com/anza-xyz/wallet-standard) for wallet discovery
- Custom Anchor program on Solana Devnet

## Features

- **Wallet Authentication** — Sign in with Phantom, Solflare, or Backpack via SIWS (Sign In With Solana)
- **Lock SOL** — Choose an amount and duration, sign a transaction, and lock SOL in an on-chain program account
- **Live Countdown** — Each lock shows a real-time countdown with a progress bar that persists across page refreshes
- **Unlock** — When the timer expires, unlock and your SOL returns to your wallet
- **Non-custodial** — Your SOL stays in a program-derived account. The app never holds your funds.
- **Anchor IDL in Ruby** — The solrengine-programs gem parses the Anchor IDL and generates Ruby models for on-chain accounts with Borsh encoding

## Setup

```sh
bin/setup
bin/rails db:prepare
```

## Development

```sh
bin/dev
```

Starts 4 processes: web server, JS bundler, CSS compiler, and Solid Queue worker.

Open `http://localhost:3000` with a Solana wallet extension installed (Phantom, Solflare, or Backpack).

## Testing on Devnet

1. Set `SOLANA_NETWORK=devnet` in `.env` (default)
2. Get free SOL from the [Solana Faucet](https://faucet.solana.com)
3. Connect your wallet and lock some SOL

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SOLANA_NETWORK` | `devnet` | Network to run on (`mainnet`, `devnet`, `testnet`) |
| `SOLANA_RPC_DEVNET_URL` | — | Devnet HTTP RPC endpoint |
| `SOLANA_WS_DEVNET_URL` | — | Devnet WebSocket RPC endpoint |
| `APP_DOMAIN` | `localhost` | Domain for SIWS message (production) |

Copy `.env.example` to `.env` and fill in your RPC endpoints.

## Architecture

```
app/
├── controllers/
│   ├── sessions_controller.rb       # SIWS auth (nonce → sign → verify → session)
│   ├── dashboard_controller.rb      # Lock list with cached RPC queries
│   ├── locks_controller.rb          # Build lock/unlock instruction data
│   └── pages_controller.rb          # Landing page
├── models/
│   ├── user.rb                      # wallet_address identity
│   └── piggy_bank/
│       └── lock.rb                  # On-chain account model (Borsh fields: dst, exp)
├── services/
│   └── piggy_bank/
│       ├── lock_instruction.rb      # Lock instruction builder (Anchor IDL)
│       └── unlock_instruction.rb    # Unlock instruction builder (Anchor IDL)
└── javascript/controllers/
    ├── wallet_controller.js          # Wallet Standard discovery + SIWS sign-in
    ├── piggy_bank_controller.js      # Build tx with @solana/kit + wallet-standard sign
    ├── countdown_controller.js       # Live countdown timer with progress bar
    └── auto_refresh_controller.js    # Idiomorph-based invisible page refresh
```

## How It Works

### Authentication
1. Stimulus discovers wallets via Wallet Standard
2. User clicks "Connect Wallet" → wallet popup opens
3. Rails generates a SIWS message with a nonce
4. Wallet signs the message (Ed25519)
5. Rails verifies the signature and creates a session

### Locking SOL
1. Client generates a fresh keypair for the lock account
2. Rails builds Borsh-encoded instruction data via the Anchor IDL
3. Stimulus assembles the transaction with @solana/kit
4. Lock keypair signs first, then wallet signs and sends via `signAndSendTransaction`
5. Dashboard updates with a live countdown

### Unlocking SOL
1. Rails builds the unlock instruction using the lock account address
2. Stimulus assembles and sends via wallet-standard
3. SOL returns to the user's wallet

## Program

- **ID:** `ZaU8j7XCKSxmmkMvg7NnjrLNK6eiLZbHsJQAc2rFzEN` (Devnet)
- **IDL:** `config/idl/piggy_bank.json`
- **Account:** `PiggyBank::Lock` — 8-byte discriminator + 32-byte pubkey (dst) + 8-byte u64 (expiration)
- **Instructions:** `lock(amt, exp)` and `unlock()`
