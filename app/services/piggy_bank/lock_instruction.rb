class PiggyBank::LockInstruction < Solrengine::Programs::Instruction
  program_id PiggyBank::PROGRAM_ID
  instruction_name "lock"

  argument :amt, "u64"
  argument :exp, "u64"

  account :payer, signer: true, writable: true
  account :dst
  account :lock, signer: true, writable: true
  account :system_program, address: "11111111111111111111111111111111"
end
