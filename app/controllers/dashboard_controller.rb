class DashboardController < ApplicationController
  def show
    @locks = PiggyBank::Lock.for_wallet(current_user.wallet_address)
  rescue => e
    Rails.logger.error("Failed to fetch locks: #{e.message}")
    @locks = []
  end
end
