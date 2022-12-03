import { Rule } from './rules'
import { Storage } from './storage'

class RuleStorage {
    storage: Storage = new Storage('applied_rules')
    applied_rules: { rule_name: string, apply_date: string}[] = []

    init = async () => {
        this.applied_rules = await this.storage.load() || []
    }

    isRuleApplied = (rule: Rule) => {
        for (const applied_rule of this.applied_rules) {
            if (applied_rule.rule_name === rule.name) {
                // check if dt is within rule's boundaries
                const dt = new Date(applied_rule.apply_date)
                if (dt >= rule.begin && dt < rule.end) {
                    return true
                }
            }
        }
        return false
    }

    markRuleApplied = async (rule: Rule, dt: Date) => {
        this.applied_rules.push({ rule_name: rule.name, apply_date: dt.toISOString() })
        await this.storage.save(this.applied_rules)
    }
}


export { RuleStorage }