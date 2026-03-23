class PiggyBank::UnlockInstruction < Solrengine::Programs::Instruction
  program_id PiggyBank::PROGRAM_ID
  instruction_name "unlock"

  account :lock, writable: true
  account :dst, writable: true
end
