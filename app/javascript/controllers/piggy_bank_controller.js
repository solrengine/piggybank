import { Controller } from "@hotwired/stimulus"
import {
  findWalletByAddress,
  buildProgramInstruction,
  compileTransactionMessage,
  toWireBytes,
  signAndSend,
  explorerUrl,
  getCsrfToken,
} from "@solrengine/wallet-utils"
import {
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
    this._wallet = null
    this._account = null
  }

  async ensureWallet() {
    if (this._account) return
    const result = await findWalletByAddress(this.walletAddressValue)
    this._wallet = result.wallet
    this._account = result.account
  }

  setAmount(event) {
    this.amountTarget.value = event.currentTarget.dataset.amount
  }

  setDuration(event) {
    this.durationTarget.value = event.currentTarget.dataset.duration
  }

  async lock() {
    try {
      await this.ensureWallet()
    } catch {
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
      const response = await fetch(this.buildLockUrlValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({ amount, duration: duration * 60 })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to build instruction")
      }

      const { instruction_data, program_id, blockhash, last_valid_block_height } = await response.json()

      // 3. Build instruction with correct accounts
      // Account order from IDL: payer, dst, lock, system_program
      const walletAddr = address(this._account.address)
      const instructionBytes = Uint8Array.from(atob(instruction_data), c => c.charCodeAt(0))

      const instruction = {
        programAddress: address(program_id),
        accounts: [
          { address: walletAddr, role: AccountRole.WRITABLE_SIGNER },
          { address: walletAddr, role: AccountRole.READONLY },
          { address: lockSigner.address, role: AccountRole.WRITABLE_SIGNER },
          { address: address("11111111111111111111111111111111"), role: AccountRole.READONLY }
        ],
        data: instructionBytes
      }

      // 4. Compile and co-sign with lock keypair
      const compiled = compileTransactionMessage({
        feePayer: this._account.address,
        blockhash,
        lastValidBlockHeight: last_valid_block_height,
        instruction,
        version: "legacy"
      })

      const [lockSig] = await lockSigner.signTransactions([compiled])
      const withLockSig = {
        ...compiled,
        signatures: { ...compiled.signatures, ...lockSig }
      }

      // 5. Send to wallet for final signature
      this.showStatus("Approve in wallet...", "pending")
      const txBytes = toWireBytes(withLockSig)
      const signature = await signAndSend({
        wallet: this._wallet,
        account: this._account,
        transaction: txBytes,
        chain: this.chainValue
      })

      this.showStatus("Locked! ", "success")
      this.appendExplorerLink(signature)

      setTimeout(() => { window.location.href = this.dashboardUrlValue }, 3000)

    } catch (error) {
      this.showStatus(error.message, "error")
    } finally {
      this.lockBtnTarget.disabled = false
    }
  }

  async unlock(event) {
    try {
      await this.ensureWallet()
    } catch {
      this.showStatus("No wallet found for " + this.walletAddressValue, "error")
      return
    }

    const lockPubkey = event.currentTarget.dataset.lockPubkey
    if (!lockPubkey) return

    try {
      event.currentTarget.disabled = true
      event.currentTarget.textContent = "Unlocking..."
      this.showStatus("Building unlock transaction...", "pending")

      const response = await fetch(this.buildUnlockUrlValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({ lock_pubkey: lockPubkey })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to build unlock instruction")
      }

      const { instruction_data, accounts, program_id, blockhash, last_valid_block_height } = await response.json()

      const instruction = buildProgramInstruction({
        programId: program_id,
        instructionData: instruction_data,
        accounts
      })

      const compiled = compileTransactionMessage({
        feePayer: this._account.address,
        blockhash,
        lastValidBlockHeight: last_valid_block_height,
        instruction,
        version: "legacy"
      })

      this.showStatus("Approve in wallet...", "pending")
      const txBytes = toWireBytes(compiled)
      const signature = await signAndSend({
        wallet: this._wallet,
        account: this._account,
        transaction: txBytes,
        chain: this.chainValue
      })

      this.showStatus("Unlocked! ", "success")
      this.appendExplorerLink(signature)

      setTimeout(() => { window.location.href = this.dashboardUrlValue }, 3000)

    } catch (error) {
      this.showStatus(error.message, "error")
      event.currentTarget.disabled = false
      event.currentTarget.textContent = "Unlock"
    }
  }

  // Safely append an explorer link to the status element (no innerHTML with user data)
  appendExplorerLink(signature) {
    if (!this.hasStatusTarget) return
    const link = document.createElement("a")
    link.href = explorerUrl(signature, this.chainValue)
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
