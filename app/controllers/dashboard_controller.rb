class DashboardController < ApplicationController
  def show
    @locks = Rails.cache.fetch("wallet/#{current_user.wallet_address}/locks", expires_in: 15.seconds) do
      PiggyBank::Lock.for_wallet(current_user.wallet_address)
    end
  rescue => e
    Rails.logger.error("Failed to fetch locks: #{e.message}")
    @locks = []
  end
end
