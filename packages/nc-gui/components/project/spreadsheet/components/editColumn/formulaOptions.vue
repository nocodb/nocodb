<template>
  <div class="formula-wrapper">
    <v-menu
      v-model="autocomplete"
      bottom
      offset-y
      nudge-bottom="-25px"
      allow-overflow
    >
      <template #activator="_args">
        <!-- todo: autocomplete based on available functions and metadata -->
        <!--        <v-tooltip color="info" right>-->
        <!--          <template #activator="{on}">-->
        <v-text-field
          ref="input"
          v-model="formula.value"
          dense
          outlined
          class="caption"
          hide-details="auto"
          label="Formula"
          persistent-hint
          hint="Available formulas are ADD, AVG, CONCAT, +, -, /"
          :rules="[v => !!v || 'Required', v => parseAndValidateFormula(v)]"
          autocomplete="off"
          @input="handleInputDeb"
          @keydown.down.prevent="suggestionListDown"
          @keydown.up.prevent="suggestionListUp"
          @keydown.enter.prevent="selectText"
        />
      </template>
      <v-list v-if="suggestion" ref="sugList" dense max-height="50vh" style="overflow: auto">
        <v-list-item-group
          v-model="selected"
          color="primary"
        >
          <v-list-item
            v-for="(it,i) in suggestion"
            :key="i"
            ref="sugOptions"
            dense
            selectable
            @mousedown.prevent="appendText(it)"
          >
            <span
              class="caption"
              :class="{
                'primary--text text--lighten-2 font-weight-bold': it.type ==='function'
              }"
            >{{ it.text }}<span v-if="it.type ==='function'">(...)</span></span>
          </v-list-item>
        </v-list-item-group>
      </v-list>
    </v-menu>
  </div>
</template>

<script>

import debounce from 'debounce'
import jsep from 'jsep'
import { UITypes } from 'nocodb-sdk'
import formulaList, { validations } from '../../../../../helpers/formulaList'
import { getWordUntilCaret, insertAtCursor } from '@/helpers'
import NcAutocompleteTree from '@/helpers/NcAutocompleteTree'

export default {
  name: 'FormulaOptions',
  props: ['nodes', 'column', 'meta', 'isSQLite', 'alias', 'value', 'sqlUi'],
  data: () => ({
    formula: {},
    // formulas: ['AVERAGE()', 'COUNT()', 'COUNTA()', 'COUNTALL()', 'SUM()', 'MIN()', 'MAX()', 'AND()', 'OR()', 'TRUE()', 'FALSE()', 'NOT()', 'XOR()', 'ISERROR()', 'IF()', 'LEN()', 'MID()', 'LEFT()', 'RIGHT()', 'FIND()', 'CONCATENATE()', 'T()', 'VALUE()', 'ARRAYJOIN()', 'ARRAYUNIQUE()', 'ARRAYCOMPACT()', 'ARRAYFLATTEN()', 'ROUND()', 'ROUNDUP()', 'ROUNDDOWN()', 'INT()', 'EVEN()', 'ODD()', 'MOD()', 'LOG()', 'EXP()', 'POWER()', 'SQRT()', 'CEILING()', 'FLOOR()', 'ABS()', 'RECORD_ID()', 'CREATED_TIME()', 'ERROR()', 'BLANK()', 'YEAR()', 'MONTH()', 'DAY()', 'HOUR()', 'MINUTE()', 'SECOND()', 'TODAY()', 'NOW()', 'WORKDAY()', 'DATETIME_PARSE()', 'DATETIME_FORMAT()', 'SET_LOCALE()', 'SET_TIMEZONE()', 'DATESTR()', 'TIMESTR()', 'TONOW()', 'FROMNOW()', 'DATEADD()', 'WEEKDAY()', 'WEEKNUM()', 'DATETIME_DIFF()', 'WORKDAY_DIFF()', 'IS_BEFORE()', 'IS_SAME()', 'IS_AFTER()', 'REPLACE()', 'REPT()', 'LOWER()', 'UPPER()', 'TRIM()', 'SUBSTITUTE()', 'SEARCH()', 'SWITCH()', 'LAST_MODIFIED_TIME()', 'ENCODE_URL_COMPONENT()', 'REGEX_EXTRACT()', 'REGEX_MATCH()', 'REGEX_REPLACE()']
    availableFunctions: formulaList,
    availableBinOps: ['+', '-', '*', '/', '>', '<', '==', '<=', '>=', '!='],
    autocomplete: false,
    suggestion: null,
    wordToComplete: '',
    selected: 0,
    tooltip: true
  }),
  computed: {
    suggestionsList() {
      const unsupportedFnList = this.sqlUi.getUnsupportedFnList()
      return [
        ...this.availableFunctions.filter(fn => !unsupportedFnList.includes(fn)).map(fn => ({
          text: fn,
          type: 'function'
        })),
        ...this.meta.columns.filter(c => !this.column || this.column.id !== c.id).map(c => ({
          text: c.title,
          type: 'column',
          c
        })),
        ...this.availableBinOps.map(op => ({
          text: op,
          type: 'op'
        }))
      ]
    },
    acTree() {
      const ref = new NcAutocompleteTree()
      for (const sug of this.suggestionsList) {
        ref.add(sug)
      }
      return ref
    }
  },
  watch: {
    value(v, o) {
      if (v !== o) {
        this.formula = this.formula || {}
        this.formula.value = v || ''
      }
    },
    'formula.value'(v, o) {
      if (v !== o) {
        this.$emit('input', v)
      }
    }
  },
  created() {
    this.formula = { value: this.value || '' }
  },
  methods: {
    async save() {
      try {
        const formulaCol = {
          title: this.alias,
          uidt: UITypes.Formula,
          formula_raw: this.formula.value
        }

        const col = await this.$api.dbTableColumn.create(this.meta.id, formulaCol)

        this.$toast.success('Formula column saved successfully').goAway(3000)
        return this.$emit('saved', this.alias)
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    },
    async update() {
      try {
        const meta = JSON.parse(JSON.stringify(this.$store.state.meta.metas[this.meta.table_name]))

        const col = meta.v.find(c => c.title === this.column.title && c.formula)

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
          tn: this.nodes.table_name,
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
        return true
      } catch (e) {
        return e.message
      }
    },
    validateAgainstMeta(pt, arr = []) {
      if (pt.type === 'CallExpression') {
        if (!this.availableFunctions.includes(pt.callee.name)) {
          arr.push(`'${pt.callee.name}' function is not available`)
        }
        const validation = validations[pt.callee.name] && validations[pt.callee.name].validation
        if (validation && validation.args) {
          if (validation.args.rqd !== undefined && validation.args.rqd !== pt.arguments.length) {
            arr.push(`'${pt.callee.name}' required ${validation.args.rqd} arguments`)
          } else if (validation.args.min !== undefined && validation.args.min > pt.arguments.length) {
            arr.push(`'${pt.callee.name}' required minimum ${validation.args.min} arguments`)
          } else if (validation.args.max !== undefined && validation.args.max < pt.arguments.length) {
            arr.push(`'${pt.callee.name}' required maximum ${validation.args.max} arguments`)
          }
        }
        pt.arguments.map(arg => this.validateAgainstMeta(arg, arr))
      } else if (pt.type === 'Identifier') {
        if (this.meta.columns.filter(c => !this.column || this.column.id !== c.id).every(c => c.title !== pt.name)) {
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
    },
    appendText(it) {
      const text = it.text
      const len = this.wordToComplete.length
      if (it.type === 'function') {
        this.$set(this.formula, 'value', insertAtCursor(this.$refs.input.$el.querySelector('input'), text + '()', len, 1))
      } else {
        this.$set(this.formula, 'value', insertAtCursor(this.$refs.input.$el.querySelector('input'), text, len))
      }
    },
    _handleInputDeb: debounce(async function(self) {
      await self.handleInput()
    }, 250),
    handleInputDeb() {
      this._handleInputDeb(this)
    },
    handleInput() {
      this.selected = 0
      this.suggestion = null
      const query = getWordUntilCaret(this.$refs.input.$el.querySelector('input'))
      const parts = query.split(/\W+/)
      this.wordToComplete = parts.pop()
      this.suggestion = this.acTree.complete(this.wordToComplete)
      this.autocomplete = !!this.suggestion.length
    },
    selectText() {
      if (this.selected > -1 && this.selected < this.suggestion.length) {
        this.appendText(this.suggestion[this.selected])
        this.autocomplete = false
      }
    },
    suggestionListDown() {
      this.selected = ++this.selected % this.suggestion.length
      this.scrollToSelectedOption()
    },
    suggestionListUp() {
      this.selected = --this.selected > -1 ? this.selected : this.suggestion.length - 1
      this.scrollToSelectedOption()
    },
    scrollToSelectedOption() {
      this.$nextTick(() => {
        if (this.$refs.sugOptions[this.selected]) {
          try {
            this.$refs.sugList.$el.scrollTo({
              top: this.$refs.sugOptions[this.selected].$el.offsetTop,
              behavior: 'smooth'
            })
          } catch (e) {
          }
        }
      })
    }
  }
}
</script>

<style scoped lang="scss">
</style>
