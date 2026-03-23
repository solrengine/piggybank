class LocksController < ApplicationController
  def build_lock
    amount_sol = BigDecimal(params[:amount].to_s)
    duration_seconds = params[:duration].to_i

    if amount_sol <= 0
      return render json: { error: "Amount must be greater than 0" }, status: :unprocessable_entity
    end

    if amount_sol > 1_000_000
      return render json: { error: "Amount too large" }, status: :unprocessable_entity
    end

    if duration_seconds <= 0
      return render json: { error: "Duration must be greater than 0" }, status: :unprocessable_entity
    end

    if duration_seconds > 31_536_000
      return render json: { error: "Duration cannot exceed 1 year" }, status: :unprocessable_entity
    end

    amount_lamports = (amount_sol * 1_000_000_000).to_i
    expiration = Time.now.to_i + duration_seconds

    ix = PiggyBank::LockInstruction.new(
      amt: amount_lamports,
      exp: expiration,
      payer: current_user.wallet_address,
      dst: current_user.wallet_address,
      lock: "11111111111111111111111111111111" # placeholder — client replaces with generated keypair
    )

    blockhash_data = cached_blockhash
    unless blockhash_data
      return render json: { error: "Failed to fetch blockhash" }, status: :service_unavailable
    end

    # Clear lock cache so dashboard shows fresh data after transaction
    Rails.cache.delete("wallet/#{current_user.wallet_address}/locks")

    instruction = ix.to_instruction
    render_instruction(instruction, blockhash_data)
  end

  def build_unlock
    lock_pubkey = params[:lock_pubkey]

    unless lock_pubkey.present?
      return render json: { error: "Lock account address required" }, status: :unprocessable_entity
    end

    ix = PiggyBank::UnlockInstruction.new(
      lock: lock_pubkey,
      dst: current_user.wallet_address
    )

    blockhash_data = cached_blockhash
    unless blockhash_data
      return render json: { error: "Failed to fetch blockhash" }, status: :service_unavailable
    end

    # Clear lock cache so dashboard shows fresh data after transaction
    Rails.cache.delete("wallet/#{current_user.wallet_address}/locks")

    instruction = ix.to_instruction
    render_instruction(instruction, blockhash_data)
  end

  private

  def cached_blockhash
    Rails.cache.fetch("solana/latest_blockhash", expires_in: 20.seconds) do
      Solrengine::Rpc.client.get_latest_blockhash
    end
  end

  def render_instruction(instruction, blockhash_data)
    render json: {
      instruction_data: Base64.strict_encode64(instruction[:data]),
      accounts: instruction[:accounts],
      program_id: instruction[:program_id],
      blockhash: blockhash_data[:blockhash],
      last_valid_block_height: blockhash_data[:last_valid_block_height]
    }
  end
end
