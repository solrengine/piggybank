class SessionsController < ApplicationController
  skip_before_action :authenticate!, only: [ :new, :nonce, :create ]

  def new
  end

  def nonce
    wallet_address = params[:wallet_address]

    unless wallet_address.match?(/\A[1-9A-HJ-NP-Za-km-z]{32,44}\z/)
      return render json: { error: "Invalid wallet address" }, status: :unprocessable_entity
    end

    user = User.find_or_initialize_by(wallet_address: wallet_address)
    user.generate_nonce! if user.persisted?
    user.save! unless user.persisted?

    domain = Solrengine::Auth.configuration.domain
    message = Solrengine::Auth::SiwsMessageBuilder.new(
      domain: domain,
      wallet_address: wallet_address,
      nonce: user.nonce,
      uri: request.base_url
    ).build

    render json: { message: message, nonce: user.nonce }
  end

  def create
    wallet_address = params[:wallet_address]
    message = params[:message]
    signature = params[:signature]

    user = User.find_by(wallet_address: wallet_address)

    unless user&.nonce_valid?
      return render json: { error: "Authentication expired. Please try again." }, status: :unprocessable_entity
    end

    verifier = Solrengine::Auth::SiwsVerifier.new(
      wallet_address: wallet_address,
      message: message,
      signature: signature
    )

    unless verifier.verify
      return render json: { error: "Signature verification failed" }, status: :unauthorized
    end

    user.generate_nonce!

    session[:user_id] = user.id
    render json: { success: true, wallet_address: user.wallet_address }
  end

  def destroy
    reset_session
    redirect_to root_path, notice: "Disconnected"
  end
end
