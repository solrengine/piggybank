Solrengine::Rpc.configure do |config|
  config.network = ENV.fetch("SOLANA_NETWORK", "devnet")
end
