Solrengine::Auth.configure do |config|
  # The domain used in SIWS messages. Must match your app's domain.
  config.domain = ENV.fetch("APP_DOMAIN", "localhost")

  # How long a nonce is valid before expiring.
  config.nonce_ttl = 5.minutes

  # The model class used for wallet authentication (String or Class).
  # config.user_class = "User"

  # Where to redirect after sign-in (used by the JS wallet controller).
  config.after_sign_in_path = "/"

  # Where to redirect after sign-out.
  config.after_sign_out_path = "/"
end
