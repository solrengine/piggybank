class PagesController < ApplicationController
  skip_before_action :authenticate!

  def landing
    redirect_to dashboard_path if logged_in?
  end
end
