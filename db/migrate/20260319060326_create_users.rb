class CreateUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :users do |t|
      t.string :wallet_address, null: false
      t.string :nonce
      t.datetime :nonce_expires_at
      t.timestamps
    end
    add_index :users, :wallet_address, unique: true
  end
end
