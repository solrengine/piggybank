import { Controller } from "@hotwired/stimulus"

// Live countdown timer for lock cards.
// Shows remaining time and progress bar, auto-transitions to "Ready" state on expiry.
export default class extends Controller {
  static targets = ["timer", "progress", "badge"]
  static values = {
    expiresAt: Number,
    expired: Boolean
  }

  connect() {
    if (this.expiredValue) return
    this.createdAt = null
    this.tick()
    this.interval = setInterval(() => this.tick(), 1000)
  }

  disconnect() {
    if (this.interval) clearInterval(this.interval)
  }

  tick() {
    const now = Math.floor(Date.now() / 1000)
    const remaining = this.expiresAtValue - now

    if (remaining <= 0) {
      clearInterval(this.interval)
      this.markExpired()
      return
    }

    // Update timer text
    if (this.hasTimerTarget) {
      const minutes = Math.floor(remaining / 60)
      const seconds = remaining % 60
      if (minutes > 0) {
        this.timerTarget.textContent = `Unlocks in ${minutes}m ${String(seconds).padStart(2, "0")}s`
      } else {
        this.timerTarget.textContent = `Unlocks in ${seconds}s`
      }
    }

    // Update progress bar — estimate total duration from remaining time
    // We don't know original duration, so we estimate progress based on how close to expiry
    if (this.hasProgressTarget) {
      // On first tick, record the starting remaining time to calculate progress
      if (!this.createdAt) {
        this.createdAt = remaining
      }
      const elapsed = this.createdAt - remaining
      const progress = Math.min((elapsed / this.createdAt) * 100, 100)
      this.progressTarget.style.width = `${progress}%`
    }
  }

  markExpired() {
    if (this.hasTimerTarget) {
      this.timerTarget.innerHTML = `<span class="text-green-400">Ready to unlock</span>`
    }

    if (this.hasProgressTarget) {
      this.progressTarget.style.width = "100%"
      this.progressTarget.className = "bg-green-500 h-1.5 rounded-full transition-all duration-1000"
    }

    if (this.hasBadgeTarget) {
      this.badgeTarget.textContent = "Ready"
      this.badgeTarget.className = "px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-400 border border-green-800"
    }

    // Refresh to show unlock button after a short delay
    setTimeout(() => window.location.reload(), 2000)
  }
}
