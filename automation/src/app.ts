const config = require('../config.json')
import * as mqtt from 'mqtt'
import { OnlineOfflineChecker, RuleApplier, StatusEmitter } from './components'
import { LOG_ERR, LOG_INFO } from './logger'


const main = () => {
    LOG_INFO("starting")
    LOG_INFO("connecting to", config.mqtt.url)
    const client = mqtt.connect(config.mqtt.url, config.mqtt.options)

    const statusEmitter = new StatusEmitter(client)
    const checkerOnlineOffline = new OnlineOfflineChecker(client)
    const ruleApplier = new RuleApplier(client)

    return [statusEmitter, checkerOnlineOffline, ruleApplier]
}

main()
