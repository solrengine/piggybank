class PiggyBank::Lock < Solrengine::Programs::Account
  program_id PiggyBank::PROGRAM_ID
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
end
