import { application } from "./application"

// Shared controllers from @solrengine/wallet-utils
import { WalletController, AutoRefreshController, CountdownController } from "@solrengine/wallet-utils/controllers"
application.register("wallet", WalletController)
application.register("auto-refresh", AutoRefreshController)
application.register("countdown", CountdownController)

// App-specific controllers
import PiggyBankController from "./piggy_bank_controller"
application.register("piggy-bank", PiggyBankController)
