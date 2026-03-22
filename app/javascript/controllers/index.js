import { application } from "./application"

import WalletController from "./wallet_controller"
application.register("wallet", WalletController)

import AutoRefreshController from "./auto_refresh_controller"
application.register("auto-refresh", AutoRefreshController)

import PiggyBankController from "./piggy_bank_controller"
application.register("piggy-bank", PiggyBankController)

import CountdownController from "./countdown_controller"
application.register("countdown", CountdownController)
