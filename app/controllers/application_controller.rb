class ApplicationController < ActionController::Base
  allow_browser versions: :modern

  before_action :authenticate!

  helper_method :current_user, :logged_in?

  private

  def current_user
    @current_user ||= User.find_by(id: session[:user_id]) if session[:user_id]
  end

  def logged_in?
    current_user.present?
  end

  def authenticate!
    redirect_to login_path unless logged_in?
  end
end
