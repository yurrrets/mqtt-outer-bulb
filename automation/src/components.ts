// components are microservices around mqtt client that performs mini functions

import * as mqtt from 'mqtt'
import { LOG_ERR, LOG_INFO, LOG_WARN } from './logger'
import { findRule, Rule } from './rules'
import { RuleStorage } from './rule_storage'
const config = require('../config')


// function informComponentEnabled(client: mqtt.Client, component: string) {
//     let c: any = client
//     c.customComponents = c.customComponents || []
//     c.customComponents.push(component)
// }

// function checkComponentEnabled(client: mqtt.Client, component: string) {
//     let c: any = client
//     if (!c.customComponents || !c.customComponents.includes(component)) {
//         LOG_ERR("depended component '", component, "' is not enabled")
//         throw Error("ggg, logic error");
//     }
// }

const DeviceStatus = {
    reqTopic: config.control_topic + "STATUS", // request to device
    respTopic: config.events_topic + "STATUS" // responce from device
}

class StatusEmitter {
    constructor(client: mqtt.Client, intervalMs?: number) {
        // informComponentEnabled(client, "statusEmitter")
        client.on('connect', function () {
            intervalMs = intervalMs || 1000 * 60
            LOG_INFO("start status emitter, interval =", intervalMs, "ms")

            const job = () => {
                client.publish(DeviceStatus.reqTopic, "")
            }
            setInterval(job, intervalMs)
            job()
        })
    }
}

const OnlineOffline = {
    topic: config.events_topic + "ONLINE_STATUS", // event topic
    reqTopic: config.events_topic + "ONLINE_STATUS_REQ", // request to get status online/offline
    respTopic: config.events_topic + "ONLINE_STATUS_RESP", // responce with status online/offline
    online: "YES",
    offline: "NO"
}

class OnlineOfflineChecker {
    client: mqtt.Client
    isOnline = false
    checkTmr?: NodeJS.Timeout

    constructor(client: mqtt.Client) {
        this.client = client
        client.on('connect', () => {
            LOG_INFO("start checking online/offline")
            
            const topics = [DeviceStatus.reqTopic, DeviceStatus.respTopic, OnlineOffline.reqTopic]
            client.subscribe(topics, (err) => {
                if (err) {
                    LOG_ERR("subscribe to topics '", topics, "' failed:", err)
                }
            })

            client.on('message', (topic: string, message: Buffer) => {
                this.onMessage(topic, message)
            })
        })
    }

    onMessage = (topic: string, message: Buffer) => {
        if (topic === DeviceStatus.respTopic) {
            // got responce, so we're online
            if (this.checkTmr) {
                clearTimeout(this.checkTmr)
            }
            if (!this.isOnline) {
                LOG_INFO("device became online")
                this.isOnline = true
                this.client.publish(OnlineOffline.topic, OnlineOffline.online)
            }
        }
        if (topic === DeviceStatus.reqTopic) {
            // req to device sent
            this.checkTmr = setTimeout(() => {
                // if we're here, then no responce to status request, otherwise timer is cancelled
                if (this.isOnline) {
                    LOG_INFO("device became offline")
                    this.isOnline = false
                    this.client.publish(OnlineOffline.topic, OnlineOffline.offline)
                }
            }, 20 * 1000)
        }
        if (topic === OnlineOffline.reqTopic) {
            this.client.publish(OnlineOffline.respTopic, this.isOnline ? OnlineOffline.online : OnlineOffline.offline)
        }
    }
}

const ActionOnOff = {
    reqTopic: config.control_topic + "POWER", // request to device
    respTopic: config.events_topic + "POWER", // state update from device
    on: "ON",
    off: "OFF"
}

class RuleApplier {
    ruleStorage: RuleStorage = new RuleStorage()
    client: mqtt.Client
    apply_job_context: {
        rule: Rule,
        apply_dt: Date,
        checkTmr: NodeJS.Timeout,
        checker: (topic: string, message: Buffer) => boolean|null
        resolver: (success: boolean) => void
    }|null = null

    constructor(client: mqtt.Client) {
        this.client = client
        client.on('connect', () => {
            client.subscribe(ActionOnOff.respTopic)
            client.on('message', (topic: string, message: Buffer) => {
                // POWER topic
                if (this.apply_job_context && this.apply_job_context.checker) {
                    const check_res = this.apply_job_context.checker(topic, message)
                    if (check_res === true) {
                        // rule successfully appiled
                        LOG_INFO("Rule", this.apply_job_context.rule.name, "successfully applied")
                        clearTimeout(this.apply_job_context.checkTmr)
                        this.ruleStorage.markRuleApplied(this.apply_job_context.rule,
                            this.apply_job_context.apply_dt)
                        this.apply_job_context.resolver(true)
                        this.apply_job_context = null
                        return
                    }
                    if (check_res === false) {
                        // rule apply failed
                        return
                    }
                }
                // Device ONLINE/OFFLINE
                if (topic === OnlineOffline.topic) {
                    LOG_INFO("Device online/offline status:", message.toString())
                    if (message.toString() === OnlineOffline.online) {
                        this.ruleApplierJob()
                    }
                }
            })
        })

        // let's check every min if we need to apply a job
        setInterval(() => {
            this.ruleApplierJob()
        }, 60000)
        // first check is applied after storage loading
        this.ruleStorage.init().then(() => {
            this.ruleApplierJob()
        })
    }

    doApply = (rule: Rule, dt_now: Date) : Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
            if (this.apply_job_context) {
                // some job is already running; inform it is failed, and start a new one
                LOG_WARN("Rule apply terminated (", this.apply_job_context.rule.name,
                    "). Starting new rule (", rule.name, ")")
                this.apply_job_context.resolver(false)
            }
            this.apply_job_context = {
                rule,
                apply_dt: dt_now,
                resolver: resolve,
                checker: (topic: string, message: Buffer) => {
                    if (topic !== config.events_topic + rule.action) {
                        return null
                    }
                    const payload = message.toString()
                    if (payload === rule.payload) {
                        return true
                    }
                    // theoretically we may return false here, but let's wait a little
                    // maybe there'll be one more message
                    return null
                },
                checkTmr: setTimeout(() => {
                    if (this.apply_job_context && this.apply_job_context.resolver) {
                        LOG_WARN("Rule apply timeout (", this.apply_job_context.rule.name, ")")
                        this.apply_job_context.resolver(false)
                    }
                    this.apply_job_context = null
                }, 10000)
            }
            this.client.publish(config.control_topic + rule.action, rule.payload)
        })
    }

    ruleApplierJob = () => {
        // find current rule
        const dt = new Date()
        const rule = findRule(config.rules, dt, config.location)
        if (!rule)
        {
            LOG_WARN("rule not found")
            return
        }
        // check if need apply current rule
        if (this.ruleStorage.isRuleApplied(rule)) {
            return
        }
        LOG_INFO("Time to apply rule", rule.name)
        this.doApply(rule, dt)
    }
}


export {
    StatusEmitter, OnlineOfflineChecker, RuleApplier
}