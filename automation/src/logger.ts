// logging

enum LOG_LEVEL {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

const LOG_LEVELS_STR = {
    0: "DEBUG",
    1: "INFO",
    2: "WARN",
    3: "ERROR"
}

let min_log_level = LOG_LEVEL.INFO
const __LOG = (level: LOG_LEVEL, ...args: any) => {
    const pad = (num: number, d: number, c: string = '0') => {
        const suffix = "" + num
        let prefix = ""
        while (prefix.length < d - suffix.length) {
            prefix = prefix + c
        }
        return prefix + suffix
    }
    const fmtDate = (dt: Date) => {
        const Y = dt.getFullYear()
        const M = pad(dt.getMonth()+1, 2)
        const D = pad(dt.getDate(), 2)
        const h = pad(dt.getHours(), 2)
        const m = pad(dt.getMinutes(), 2)
        const s = pad(dt.getSeconds(), 2)
        const ms = pad(dt.getMilliseconds(), 3)
        return `${Y}-${M}-${D} ${h}:${m}:${s}.${ms}`
    }
    if (level >= min_log_level) {
        console.log(fmtDate(new Date()), LOG_LEVELS_STR[level], ...args)
    }
}

const LOG_DBG = (...args: any) => { __LOG(LOG_LEVEL.DEBUG, ...args) }
const LOG_INFO = (...args: any) => { __LOG(LOG_LEVEL.INFO, ...args) }
const LOG_WARN = (...args: any) => { __LOG(LOG_LEVEL.WARN, ...args) }
const LOG_ERR = (...args: any) => { __LOG(LOG_LEVEL.ERROR, ...args) }

export {
    LOG_DBG, LOG_INFO, LOG_WARN, LOG_ERR
}