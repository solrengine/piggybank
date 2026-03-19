class PiggyBank::UnlockInstruction < Solrengine::Programs::Instruction
  program_id "ZaU8j7XCKSxmmkMvg7NnjrLNK6eiLZbHsJQAc2rFzEN"
  instruction_name "unlock"

  account :lock, writable: true
  account :dst, writable: true
end
