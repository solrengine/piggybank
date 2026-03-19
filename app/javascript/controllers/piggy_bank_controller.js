import { Controller } from "@hotwired/stimulus"
import { getWallets } from "@wallet-standard/app"
import { SolanaSignAndSendTransaction } from "@solana/wallet-standard-features"
import {
  pipe,
  createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash,
  setTransactionMessageFeePayer,
  appendTransactionMessageInstruction,
  compileTransaction,
  getBase64EncodedWireTransaction,
  address,
  generateKeyPair,
  getAddressFromPublicKey,
  signTransaction
} from "@solana/kit"

export default class extends Controller {
  static targets = ["amount", "duration", "lockBtn", "status"]
  static values = {
    buildLockUrl: String,
    buildUnlockUrl: String,
    chain: { type: String, default: "solana:devnet" }
  }

  connect() {
    this.wallet = null
    this.discoverWallet()
  }

  discoverWallet() {
    const { get, on } = getWallets()
    for (const wallet of get()) {
      if (wallet.features[SolanaSignAndSendTransaction]) {
        this.wallet = wallet
        return
      }
    }
    on("register", (...newWallets) => {
      for (const wallet of newWallets) {
        if (wallet.features[SolanaSignAndSendTransaction]) {
          this.wallet = wallet
          return
        }
      }
    })
  }

  setAmount(event) {
    this.amountTarget.value = event.currentTarget.dataset.amount
  }

  setDuration(event) {
    this.durationTarget.value = event.currentTarget.dataset.duration
  }

  async lock() {
    if (!this.wallet) {
      this.showStatus("No wallet found", "error")
      return
    }

    const amount = parseFloat(this.amountTarget.value)
    const duration = parseInt(this.durationTarget.value)

    if (!amount || amount <= 0) {
      this.showStatus("Enter a valid amount", "error")
      return
    }
    if (!duration || duration <= 0) {
      this.showStatus("Enter a valid duration", "error")
      return
    }

    try {
      this.showStatus("Building transaction...", "pending")
      this.lockBtnTarget.disabled = true

      // 1. Generate fresh keypair for lock account
      const lockKeyPair = await generateKeyPair()
      const lockAddress = await getAddressFromPublicKey(lockKeyPair.publicKey)

      // 2. Get instruction data from server
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
      const response = await fetch(this.buildLockUrlValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify({
          amount: amount,
          duration: duration * 60 // convert minutes to seconds
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to build instruction")
      }

      const { instruction_data, accounts, program_id, blockhash, last_valid_block_height } = await response.json()

      // 3. Get wallet account
      const walletAccount = this.wallet.accounts.find(a => a.chains.includes(this.chainValue))
      if (!walletAccount) throw new Error("No wallet account for chain: " + this.chainValue)

      // 4. Build instruction with lock keypair as additional signer
      const instructionBytes = Uint8Array.from(atob(instruction_data), c => c.charCodeAt(0))

      // Build account metas - inject the lock keypair address
      const accountMetas = accounts.map(a => {
        // Replace the lock account pubkey placeholder if needed
        let pubkeyStr = a.pubkey
        return {
          address: address(pubkeyStr),
          role: this.accountRole(a)
        }
      })

      // Add lock account as writable signer (it's already in accounts from server,
      // but we need to set its address to our generated keypair)
      // The server sends accounts with payer, dst, lock, system_program
      // We need to replace "lock" account address with our generated one
      // Account order from IDL: payer(0), dst(1), lock(2), system_program(3)
      accountMetas[2] = {
        address: lockAddress,
        role: 0x03 // WRITABLE_SIGNER
      }

      // Set payer and dst to wallet address
      accountMetas[0] = {
        address: address(walletAccount.address),
        role: 0x03 // WRITABLE_SIGNER
      }
      accountMetas[1] = {
        address: address(walletAccount.address),
        role: 0x00 // READONLY
      }

      const instruction = {
        programAddress: address(program_id),
        accounts: accountMetas,
        data: instructionBytes
      }

      // 5. Build transaction
      const txMessage = pipe(
        createTransactionMessage({ version: "legacy" }),
        m => setTransactionMessageFeePayer(address(walletAccount.address), m),
        m => setTransactionMessageLifetimeUsingBlockhash(
          { blockhash: blockhash, lastValidBlockHeight: BigInt(last_valid_block_height) },
          m
        ),
        m => appendTransactionMessageInstruction(instruction, m)
      )

      // 6. Compile and sign with lock keypair first
      const compiled = compileTransaction(txMessage)
      const lockSigned = await signTransaction([lockKeyPair], compiled)

      // 7. Send to wallet for final signature
      const wireTransaction = getBase64EncodedWireTransaction(lockSigned)

      const feature = this.wallet.features[SolanaSignAndSendTransaction]
      const [{ signature }] = await feature.signAndSendTransaction(walletAccount, [
        { transaction: wireTransaction, chain: this.chainValue }
      ])

      const sigStr = typeof signature === "string" ? signature : new TextDecoder().decode(signature)

      this.showStatus(
        `Locked! <a href="https://explorer.solana.com/tx/${sigStr}?cluster=devnet" target="_blank" class="underline">View on Explorer</a>`,
        "success"
      )

      // Refresh page after a delay to show new lock
      setTimeout(() => window.location.reload(), 3000)

    } catch (error) {
      this.showStatus(error.message, "error")
    } finally {
      this.lockBtnTarget.disabled = false
    }
  }

  async unlock(event) {
    if (!this.wallet) {
      this.showStatus("No wallet found", "error")
      return
    }

    const lockPubkey = event.currentTarget.dataset.lockPubkey
    if (!lockPubkey) return

    try {
      event.currentTarget.disabled = true
      event.currentTarget.textContent = "Unlocking..."
      this.showStatus("Building unlock transaction...", "pending")

      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
      const response = await fetch(this.buildUnlockUrlValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ lock_pubkey: lockPubkey })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to build unlock instruction")
      }

      const { instruction_data, accounts, program_id, blockhash, last_valid_block_height } = await response.json()

      const walletAccount = this.wallet.accounts.find(a => a.chains.includes(this.chainValue))
      if (!walletAccount) throw new Error("No wallet account for chain")

      const instructionBytes = Uint8Array.from(atob(instruction_data), c => c.charCodeAt(0))

      const accountMetas = accounts.map(a => ({
        address: address(a.pubkey),
        role: this.accountRole(a)
      }))

      const instruction = {
        programAddress: address(program_id),
        accounts: accountMetas,
        data: instructionBytes
      }

      const txMessage = pipe(
        createTransactionMessage({ version: "legacy" }),
        m => setTransactionMessageFeePayer(address(walletAccount.address), m),
        m => setTransactionMessageLifetimeUsingBlockhash(
          { blockhash: blockhash, lastValidBlockHeight: BigInt(last_valid_block_height) },
          m
        ),
        m => appendTransactionMessageInstruction(instruction, m)
      )

      const compiled = compileTransaction(txMessage)
      const wireTransaction = getBase64EncodedWireTransaction(compiled)

      const feature = this.wallet.features[SolanaSignAndSendTransaction]
      const [{ signature }] = await feature.signAndSendTransaction(walletAccount, [
        { transaction: wireTransaction, chain: this.chainValue }
      ])

      const sigStr = typeof signature === "string" ? signature : new TextDecoder().decode(signature)

      this.showStatus(
        `Unlocked! <a href="https://explorer.solana.com/tx/${sigStr}?cluster=devnet" target="_blank" class="underline">View on Explorer</a>`,
        "success"
      )

      setTimeout(() => window.location.reload(), 3000)

    } catch (error) {
      this.showStatus(error.message, "error")
      event.currentTarget.disabled = false
      event.currentTarget.textContent = "Unlock"
    }
  }

  accountRole(account) {
    if (account.is_signer && account.is_writable) return 0x03
    if (account.is_signer) return 0x02
    if (account.is_writable) return 0x01
    return 0x00
  }

  showStatus(message, type) {
    if (!this.hasStatusTarget) return
    const colors = {
      error: "bg-red-900/50 border border-red-800 text-red-400",
      success: "bg-green-900/50 border border-green-800 text-green-400",
      pending: "bg-purple-900/50 border border-purple-800 text-purple-400"
    }
    this.statusTarget.className = `mt-4 p-3 rounded-lg text-sm text-center ${colors[type] || ""}`
    this.statusTarget.innerHTML = message
  }
}
