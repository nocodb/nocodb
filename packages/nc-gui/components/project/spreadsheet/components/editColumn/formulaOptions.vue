<template>
  <div>
    <!-- todo: autocomplete based on available functions and metadata -->
    <v-text-field
      v-model="formula.value"
      dense
      outlined
      class="caption"
      hide-details="auto"
      label="Formula"
      persistent-hint
      hint="Available formulas are ADD, AVG, CONCAT, +, -, /"
      :rules="[v => !!v || 'Required', v => parseAndValidateFormula(v)]"
    />
  </div>
</template>

<script>

import jsep from 'jsep'

export default {
  name: 'FormulaOptions',
  props: ['nodes', 'column', 'meta', 'isSQLite', 'alias', 'value'],
  data: () => ({
    formula: {},
    // formulas: ['AVERAGE()', 'COUNT()', 'COUNTA()', 'COUNTALL()', 'SUM()', 'MIN()', 'MAX()', 'AND()', 'OR()', 'TRUE()', 'FALSE()', 'NOT()', 'XOR()', 'ISERROR()', 'IF()', 'LEN()', 'MID()', 'LEFT()', 'RIGHT()', 'FIND()', 'CONCATENATE()', 'T()', 'VALUE()', 'ARRAYJOIN()', 'ARRAYUNIQUE()', 'ARRAYCOMPACT()', 'ARRAYFLATTEN()', 'ROUND()', 'ROUNDUP()', 'ROUNDDOWN()', 'INT()', 'EVEN()', 'ODD()', 'MOD()', 'LOG()', 'EXP()', 'POWER()', 'SQRT()', 'CEILING()', 'FLOOR()', 'ABS()', 'RECORD_ID()', 'CREATED_TIME()', 'ERROR()', 'BLANK()', 'YEAR()', 'MONTH()', 'DAY()', 'HOUR()', 'MINUTE()', 'SECOND()', 'TODAY()', 'NOW()', 'WORKDAY()', 'DATETIME_PARSE()', 'DATETIME_FORMAT()', 'SET_LOCALE()', 'SET_TIMEZONE()', 'DATESTR()', 'TIMESTR()', 'TONOW()', 'FROMNOW()', 'DATEADD()', 'WEEKDAY()', 'WEEKNUM()', 'DATETIME_DIFF()', 'WORKDAY_DIFF()', 'IS_BEFORE()', 'IS_SAME()', 'IS_AFTER()', 'REPLACE()', 'REPT()', 'LOWER()', 'UPPER()', 'TRIM()', 'SUBSTITUTE()', 'SEARCH()', 'SWITCH()', 'LAST_MODIFIED_TIME()', 'ENCODE_URL_COMPONENT()', 'REGEX_EXTRACT()', 'REGEX_MATCH()', 'REGEX_REPLACE()']
    availableFunctions: ['AVG', 'ADD', 'CONCAT'],
    availableBinOps: ['+', '-', '*', '/']
  }),
  created() {
    this.formula = this.value ? { ...this.value } : {}
  },
  methods: {
    async save() {
      try {
        await this.$store.dispatch('meta/ActLoadMeta', {
          dbAlias: this.nodes.dbAlias,
          env: this.nodes.env,
          tn: this.meta.tn,
          force: true
        })
        const meta = JSON.parse(JSON.stringify(this.$store.state.meta.metas[this.meta.tn]))

        meta.v.push({
          _cn: this.alias,
          formula: {
            ...this.formula,
            tree: jsep(this.formula.value)
          }
        })

        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcModelSet', {
          tn: this.nodes.tn,
          meta
        }])

        this.$toast.success('Formula column saved successfully').goAway(3000)
        return this.$emit('saved', this.alias)
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    },
    async update() {
      try {
        const meta = JSON.parse(JSON.stringify(this.$store.state.meta.metas[this.meta.tn]))

        const col = meta.v.find(c => c._cn === this.column._cn && c.formula)

        Object.assign(col, {
          _cn: this.alias,
          formula: {
            ...this.formula,
            tree: jsep(this.formula.value),
            error: undefined
          }
        })

        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcModelSet', {
          tn: this.nodes.tn,
          meta
        }])
        this.$toast.success('Formula column updated successfully').goAway(3000)
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    },
    // todo: validate formula based on meta
    parseAndValidateFormula(formula) {
      try {
        const pt = jsep(formula)
        const err = this.validateAgainstMeta(pt)
        if (err.length) {
          return err.join(', ')
        }
      } catch (e) {
        return e.message
      }
    },
    validateAgainstMeta(pt, arr = []) {
      if (pt.type === 'CallExpression') {
        if (!this.availableFunctions.includes(pt.callee.name)) {
          arr.push(`'${pt.callee.name}' function is not available`)
        }
        pt.arguments.map(arg => this.validateAgainstMeta(arg, arr))
      } else if (pt.type === 'Identifier') {
        if (this.meta.columns.every(c => c.cn !== pt.name)) {
          arr.push(`Column with name '${pt.name}' is not available`)
        }
      } else if (pt.type === 'BinaryExpression') {
        if (!this.availableBinOps.includes(pt.operator)) {
          arr.push(`'${pt.operator}' operation is not available`)
        }
        this.validateAgainstMeta(pt.left, arr)
        this.validateAgainstMeta(pt.right, arr)
      }
      return arr
    }
  }
}
</script>

<style scoped>

</style>
