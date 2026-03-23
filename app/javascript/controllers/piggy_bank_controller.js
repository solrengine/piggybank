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
  generateKeyPairSigner,
  AccountRole
} from "@solana/kit"

export default class extends Controller {
  static targets = ["amount", "duration", "lockBtn", "status"]
  static values = {
    buildLockUrl: String,
    buildUnlockUrl: String,
    walletAddress: String,
    chain: { type: String, default: "solana:devnet" },
    dashboardUrl: { type: String, default: "/dashboard" }
  }

  connect() {
    this.wallet = null
    this.walletAccount = null
  }

  // Find the wallet that owns the authenticated address.
  // Wallets may not expose accounts until connect() is called,
  // so we check all wallets and try to match by address.
  async ensureWallet() {
    if (this.walletAccount) return true

    const { get } = getWallets()
    const wallets = get()

    for (const wallet of wallets) {
      if (!wallet.features[SolanaSignAndSendTransaction]) continue

      const account = wallet.accounts.find(a =>
        a.address === this.walletAddressValue
      )
      if (account) {
        this.wallet = wallet
        this.walletAccount = account
        return true
      }
    }

    // No wallet had the account visible — try connecting each one
    for (const wallet of wallets) {
      if (!wallet.features[SolanaSignAndSendTransaction]) continue
      if (!wallet.features["standard:connect"]) continue

      try {
        await wallet.features["standard:connect"].connect()
        const account = wallet.accounts.find(a =>
          a.address === this.walletAddressValue
        )
        if (account) {
          this.wallet = wallet
          this.walletAccount = account
          return true
        }
      } catch(e) {
        // User rejected or wallet doesn't have this account
      }
    }

    return false
  }

  setAmount(event) {
    this.amountTarget.value = event.currentTarget.dataset.amount
  }

  setDuration(event) {
    this.durationTarget.value = event.currentTarget.dataset.duration
  }

  async lock() {
    if (!await this.ensureWallet()) {
      this.showStatus("No wallet found for " + this.walletAddressValue, "error")
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

      // 1. Generate fresh keypair signer for lock account
      const lockSigner = await generateKeyPairSigner()
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
          duration: duration * 60
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to build instruction")
      }

      const { instruction_data, program_id, blockhash, last_valid_block_height } = await response.json()

      // 3. Build instruction with correct accounts
      const instructionBytes = Uint8Array.from(atob(instruction_data), c => c.charCodeAt(0))

      // Account order from IDL: payer, dst, lock, system_program
      const walletAddr = address(this.walletAccount.address)
      const instruction = {
        programAddress: address(program_id),
        accounts: [
          { address: walletAddr, role: AccountRole.WRITABLE_SIGNER },      // payer
          { address: walletAddr, role: AccountRole.READONLY },              // dst
          { address: lockSigner.address, role: AccountRole.WRITABLE_SIGNER }, // lock
          { address: address("11111111111111111111111111111111"), role: AccountRole.READONLY } // system_program
        ],
        data: instructionBytes
      }

      // 4. Build transaction message
      const txMessage = pipe(
        createTransactionMessage({ version: "legacy" }),
        m => setTransactionMessageFeePayer(address(this.walletAccount.address), m),
        m => setTransactionMessageLifetimeUsingBlockhash(
          { blockhash: blockhash, lastValidBlockHeight: BigInt(last_valid_block_height) },
          m
        ),
        m => appendTransactionMessageInstruction(instruction, m)
      )

      // 5. Compile, sign with lock keypair, merge signature
      const compiled = compileTransaction(txMessage)
      const [lockSig] = await lockSigner.signTransactions([compiled])
      const withLockSig = {
        ...compiled,
        signatures: { ...compiled.signatures, ...lockSig }
      }

      // 6. Convert to bytes and send to wallet
      const base64Wire = getBase64EncodedWireTransaction(withLockSig)
      const txBytes = Uint8Array.from(atob(base64Wire), c => c.charCodeAt(0))

      this.showStatus("Approve in wallet...", "pending")

      const feature = this.wallet.features[SolanaSignAndSendTransaction]
      const [{ signature: sigBytes }] = await feature.signAndSendTransaction({
        account: this.walletAccount,
        transaction: txBytes,
        chain: this.chainValue
      })

      const sigStr = typeof sigBytes === "string" ? sigBytes : new TextDecoder().decode(sigBytes)
      const cluster = this.clusterFromChain()

      this.showStatus(`Locked! `, "success")
      this.appendExplorerLink(sigStr, cluster)

      setTimeout(() => { window.location.href = this.dashboardUrlValue }, 3000)

    } catch (error) {
      this.showStatus(error.message, "error")
    } finally {
      this.lockBtnTarget.disabled = false
    }
  }

  async unlock(event) {
    if (!await this.ensureWallet()) {
      this.showStatus("No wallet found for " + this.walletAddressValue, "error")
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

      const instructionBytes = Uint8Array.from(atob(instruction_data), c => c.charCodeAt(0))

      const instruction = {
        programAddress: address(program_id),
        accounts: accounts.map(a => ({
          address: address(a.pubkey),
          role: this.accountRole(a)
        })),
        data: instructionBytes
      }

      const txMessage = pipe(
        createTransactionMessage({ version: "legacy" }),
        m => setTransactionMessageFeePayer(address(this.walletAccount.address), m),
        m => setTransactionMessageLifetimeUsingBlockhash(
          { blockhash: blockhash, lastValidBlockHeight: BigInt(last_valid_block_height) },
          m
        ),
        m => appendTransactionMessageInstruction(instruction, m)
      )

      const compiled = compileTransaction(txMessage)
      const base64Wire = getBase64EncodedWireTransaction(compiled)
      const txBytes = Uint8Array.from(atob(base64Wire), c => c.charCodeAt(0))

      this.showStatus("Approve in wallet...", "pending")

      const feature = this.wallet.features[SolanaSignAndSendTransaction]
      const [{ signature: sigBytes }] = await feature.signAndSendTransaction({
        account: this.walletAccount,
        transaction: txBytes,
        chain: this.chainValue
      })

      const sigStr = typeof sigBytes === "string" ? sigBytes : new TextDecoder().decode(sigBytes)
      const cluster = this.clusterFromChain()

      this.showStatus(`Unlocked! `, "success")
      this.appendExplorerLink(sigStr, cluster)

      setTimeout(() => { window.location.href = this.dashboardUrlValue }, 3000)

    } catch (error) {
      this.showStatus(error.message, "error")
      event.currentTarget.disabled = false
      event.currentTarget.textContent = "Unlock"
    }
  }

  accountRole(account) {
    if (account.is_signer && account.is_writable) return AccountRole.WRITABLE_SIGNER
    if (account.is_signer) return AccountRole.READONLY_SIGNER
    if (account.is_writable) return AccountRole.WRITABLE
    return AccountRole.READONLY
  }

  clusterFromChain() {
    if (this.chainValue.includes("devnet")) return "devnet"
    if (this.chainValue.includes("testnet")) return "testnet"
    return "mainnet"
  }

  // Safely append an explorer link to the status element (no innerHTML with user data)
  appendExplorerLink(signature, cluster) {
    if (!this.hasStatusTarget) return
    const link = document.createElement("a")
    link.href = `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=${cluster}`
    link.target = "_blank"
    link.className = "underline"
    link.textContent = "View on Explorer"
    this.statusTarget.appendChild(link)
  }

  showStatus(message, type) {
    if (!this.hasStatusTarget) return
    const colors = {
      error: "bg-red-900/50 border border-red-800 text-red-400",
      success: "bg-green-900/50 border border-green-800 text-green-400",
      pending: "bg-purple-900/50 border border-purple-800 text-purple-400"
    }
    this.statusTarget.className = `mt-4 p-3 rounded-lg text-sm text-center ${colors[type] || ""}`
    this.statusTarget.textContent = message
  }
}
