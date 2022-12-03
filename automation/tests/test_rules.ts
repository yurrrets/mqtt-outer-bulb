import {LOG_ERR, LOG_INFO} from '../src/logger'
import {checkAllRulesCoversTheDay} from '../src/rules'
const config = require('../config.json')

LOG_INFO("test rules for coverage whole day")

const res = checkAllRulesCoversTheDay(config.rules, config.location)
const log_fn = res ? LOG_INFO : LOG_ERR
log_fn('checkAllRulesCoversTheDay:', res)
