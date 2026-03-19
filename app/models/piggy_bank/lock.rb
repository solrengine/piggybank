class PiggyBank::Lock < Solrengine::Programs::Account
  program_id "ZaU8j7XCKSxmmkMvg7NnjrLNK6eiLZbHsJQAc2rFzEN"
  account_name "Lock"

  borsh_field :dst, "pubkey"
  borsh_field :exp, "u64"

  def self.for_wallet(wallet_address)
    query(filters: [
      { "memcmp" => { "offset" => 8, "bytes" => wallet_address } }
    ])
  end

  def expired?
    exp < Time.now.to_i
  end

  def time_remaining
    remaining = exp - Time.now.to_i
    return "Expired" if remaining <= 0

    if remaining < 60
      "#{remaining}s"
    elsif remaining < 3600
      "#{remaining / 60}m #{remaining % 60}s"
    else
      "#{remaining / 3600}h #{(remaining % 3600) / 60}m"
    end
  end
end
