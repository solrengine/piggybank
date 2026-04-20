Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # SIWS authentication — bundled controller from solrengine-auth.
  mount Solrengine::Auth::Engine => "/auth", as: :solrengine_auth

  # Dashboard
  get "dashboard", to: "dashboard#show", as: :dashboard

  # Lock/Unlock instructions
  post "locks/build",        to: "locks#build_lock"
  post "locks/build_unlock", to: "locks#build_unlock"

  root "pages#landing"
end
