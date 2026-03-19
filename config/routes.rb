Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # Authentication
  get  "login",       to: "sessions#new",     as: :login
  get  "auth/nonce",  to: "sessions#nonce",   as: :auth_nonce
  post "auth/verify", to: "sessions#create",  as: :auth_verify
  delete "logout",    to: "sessions#destroy",  as: :logout

  # Dashboard
  get "dashboard", to: "dashboard#show", as: :dashboard

  # Lock/Unlock instructions
  post "locks/build",        to: "locks#build_lock"
  post "locks/build_unlock", to: "locks#build_unlock"

  root "pages#landing"
end
