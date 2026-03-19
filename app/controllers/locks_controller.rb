class LocksController < ApplicationController
  def build_lock
    amount_sol = params[:amount].to_f
    duration_seconds = params[:duration].to_i

    if amount_sol <= 0
      return render json: { error: "Amount must be greater than 0" }, status: :unprocessable_entity
    end

    if duration_seconds <= 0
      return render json: { error: "Duration must be greater than 0" }, status: :unprocessable_entity
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

    blockhash_data = Solrengine::Rpc.client.get_latest_blockhash
    unless blockhash_data
      return render json: { error: "Failed to fetch blockhash" }, status: :service_unavailable
    end

    render json: {
      instruction_data: Base64.strict_encode64(ix.instruction_data),
      accounts: ix.send(:build_account_metas),
      program_id: PiggyBank::LockInstruction.program_id,
      blockhash: blockhash_data[:blockhash],
      last_valid_block_height: blockhash_data[:last_valid_block_height]
    }
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

    blockhash_data = Solrengine::Rpc.client.get_latest_blockhash
    unless blockhash_data
      return render json: { error: "Failed to fetch blockhash" }, status: :service_unavailable
    end

    render json: {
      instruction_data: Base64.strict_encode64(ix.instruction_data),
      accounts: ix.send(:build_account_metas),
      program_id: PiggyBank::UnlockInstruction.program_id,
      blockhash: blockhash_data[:blockhash],
      last_valid_block_height: blockhash_data[:last_valid_block_height]
    }
  end
end
