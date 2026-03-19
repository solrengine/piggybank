class User < ApplicationRecord
  include Solrengine::Auth::Concerns::Authenticatable
end
