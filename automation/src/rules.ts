const suncalc = require('suncalc')
import { LOG_INFO, LOG_ERR } from './logger'

interface RuleDesc {
  name: string,
  begin: string,
  end: string,
  next_day?: boolean,
  action: string,
  payload: string
}

interface Rule {
  name: string,
  begin: Date,
  end: Date,
  action: string,
  payload: string
}

interface Location {
  lat: number,
  lng: number
}

function convertToRule(ruleDesc: RuleDesc, dt_begin: Date, dt_end: Date) : Rule {
  return {
    name: ruleDesc.name,
    begin: dt_begin,
    end: dt_end,
    action: ruleDesc.action,
    payload: ruleDesc.payload
  }
}

function parseTime(date: Date, time_str: string, location: Location) {
  // LOG_DBG("parseTime", date, time_str)
  if (time_str == "sunrise" || time_str == "sunset") {
    const times = suncalc.getTimes(date, location.lat, location.lng)
    return times[time_str]
  }
  // form iso-date string and parse it
  // like 1970-01-01T03:34
  // don't forget about leading zeros in your time_str; 03:34 is correct, while 3:34 is not
  // note that time is local! not gmt
  const dt_str = '1970-01-01T' + time_str
  const ret = new Date(dt_str)
  const is_invalid = isNaN(ret.getTime())
  if (is_invalid) {
    LOG_ERR("error parsing datetime string '", dt_str, "', check that time is correct")
  }
  ret.setFullYear(date.getFullYear(), date.getMonth(), date.getDate())
  return ret
}

function withinDateRange(dt: Date, dt_begin: Date, dt_end: Date) {
  return (dt.getTime() >= dt_begin.getTime() && dt.getTime() < dt_end.getTime())
}

function findRule(ruleDescs: RuleDesc[], dt: Date, location: Location) : Rule|undefined {
  let dt_prevday = new Date(dt)
  dt_prevday.setDate(dt.getDate() - 1)
  let dt_nextday = new Date(dt)
  dt_nextday.setDate(dt.getDate() + 1)
  for (const ruleDesc of ruleDescs) {
    if (ruleDesc.next_day) {
      // need to check twice: (prev_day <= dt < this_day) or (this_day <= dt < next_day)
      const dt1 = parseTime(dt_prevday, ruleDesc.begin, location)
      const dt2 = parseTime(dt, ruleDesc.end, location)
      if (withinDateRange(dt, dt1, dt2)) {
        return convertToRule(ruleDesc, dt1, dt2)
      }
      const dt3 = parseTime(dt, ruleDesc.begin, location)
      const dt4 = parseTime(dt_nextday, ruleDesc.end, location)
      if (withinDateRange(dt, dt3, dt4)) {
        return convertToRule(ruleDesc, dt3, dt4)
      }
    }
    else {
      const dt1 = parseTime(dt, ruleDesc.begin, location)
      const dt2 = parseTime(dt, ruleDesc.end, location)
      if (withinDateRange(dt, dt1, dt2)) {
        return convertToRule(ruleDesc, dt1, dt2)
      }
    }
  }
}

function checkAllRulesCoversTheDay(ruleDescs: RuleDesc[], location: Location) {
  let dt = new Date()
  dt.setMinutes(0, 0, 0)
  for (let h = 0; h <= 24; h++) {
    for (let m = 0; m < 60; m++) {
      dt.setHours(h, m)
      const rule = findRule(ruleDescs, dt, location)
      if (!rule) {
        LOG_ERR("rule not found for datetime:", dt)
        return false
      }
    }
  }
  return true
}


export {
  RuleDesc, Rule, Location, findRule, checkAllRulesCoversTheDay
}