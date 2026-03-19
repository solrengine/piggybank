# CLAUDE.md

## Project Overview

Rails 8 app demonstrating the solrengine-programs gem with an on-chain PiggyBank Anchor program. Lock SOL for a set duration, unlock after expiry.

## Key Commands

- `bin/dev` — start all 4 processes (web, js, css, jobs)
- `yarn build` — bundle JS with esbuild
- `yarn build:css` — compile Tailwind CSS
- `bin/rails db:prepare` — set up primary database
- `bin/rails db:schema:load:queue` — set up Solid Queue database
- `bin/rails db:schema:load:cache` — set up Solid Cache database
- `bin/rails db:schema:load:cable` — set up Solid Cable database

## Architecture

- **Wallet auth** via `solrengine-auth` (SIWS)
- **Program interaction** via `solrengine-programs` (Anchor IDL parsing, Borsh, account models)
- **RPC** via `solrengine-rpc` (Solana JSON-RPC client)
- **Lock/Unlock** — client-side keypair generation for lock account, server builds Borsh-encoded instruction data, wallet signs and sends

## Program

- **ID:** `ZaU8j7XCKSxmmkMvg7NnjrLNK6eiLZbHsJQAc2rFzEN` (devnet)
- **IDL:** `config/idl/piggy_bank.json`
- **Account:** `PiggyBank::Lock` — 8-byte discriminator + 32-byte dst pubkey + 8-byte u64 expiration
- **Instructions:** `lock(amt, exp)` and `unlock()`

## Key Files

- `app/models/piggy_bank/lock.rb` — Account model with `for_wallet` query
- `app/services/piggy_bank/lock_instruction.rb` — Lock instruction builder
- `app/services/piggy_bank/unlock_instruction.rb` — Unlock instruction builder
- `app/javascript/controllers/piggy_bank_controller.js` — Stimulus controller for lock/unlock
- `app/controllers/locks_controller.rb` — Server-side instruction data building
- `app/controllers/sessions_controller.rb` — SIWS wallet auth

## Environment Variables

- `SOLANA_NETWORK` — devnet (default)
- `SOLANA_RPC_DEVNET_URL` — Helius devnet RPC
- `SOLANA_WS_DEVNET_URL` — Helius devnet WebSocket
