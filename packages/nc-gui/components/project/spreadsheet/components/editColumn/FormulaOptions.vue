<template>
  <div class="formula-wrapper">
    <v-text-field
      ref="input"
      v-model="formula.value"
      dense
      outlined
      class="caption"
      hide-details="auto"
      label="Formula"
      :rules="[v => !!v || 'Required', v => parseAndValidateFormula(v)]"
      autocomplete="off"
      @input="handleInputDeb"
      @keydown.down.prevent="suggestionListDown"
      @keydown.up.prevent="suggestionListUp"
      @keydown.enter.prevent="selectText"
    />
    <div class="hint">
      Hint: Use {} to reference columns, e.g: {column_name}. For more, please check out
      <a href="https://docs.nocodb.com/setup-and-usages/formulas#available-formula-features" target="_blank">Formulas</a>.
    </div>
    <v-card v-if="suggestion && suggestion.length" class="formula-suggestion">
      <v-card-text>Suggestions</v-card-text>
      <v-divider />
      <v-list ref="sugList" dense max-height="50vh" style="overflow: auto">
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
            <!-- Function -->
            <template v-if="it.type ==='function'">
              <v-tooltip right offset-x nudge-right="100">
                <template #activator="{ on }">
                  <v-list-item-content v-on="on">
                    <span
                      class="caption primary--text text--lighten-2 font-weight-bold"
                    >
                      {{ it.text }}
                    </span>
                  </v-list-item-content>
                  <v-list-item-action>
                    <span class="caption">
                      Function
                    </span>
                  </v-list-item-action>
                </template>
                <div>
                  {{ it.description }} <br><br>
                  Syntax: <br>
                  {{ it.syntax }} <br><br>
                  Examples: <br>
                  <div v-for="(example, idx) in it.examples" :key="idx">
                    <pre>({{ idx + 1 }}): {{ example }}</pre>
                  </div>
                </div>
              </v-tooltip>
            </template>

            <!-- Column -->
            <template v-if="it.type ==='column'">
              <v-list-item-content>
                <span
                  class="caption text--darken-3 font-weight-bold"
                >
                  {{ it.text }}
                </span>
              </v-list-item-content>

              <v-list-item-action>
                <span class="caption">
                  Column
                </span>
              </v-list-item-action>
            </template>

            <!-- Operator -->
            <template v-if="it.type ==='op'">
              <v-list-item-content>
                <span
                  class="caption indigo--text text--darken-3 font-weight-bold"
                >
                  {{ it.text }}
                </span>
              </v-list-item-content>

              <v-list-item-action>
                <span class="caption">
                  Operator
                </span>
              </v-list-item-action>
            </template>
          </v-list-item>
        </v-list-item-group>
      </v-list>
    </v-card>
  </div>
</template>

<script>

import debounce from 'debounce'
import jsep from 'jsep'
import { UITypes, jsepCurlyHook } from 'nocodb-sdk'
import formulaList, { formulas, formulaTypes } from '../../../../../helpers/formulaList'
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
    tooltip: true,
    sortOrder: {
      column: 0,
      function: 1,
      op: 2
    }
  }),
  computed: {
    suggestionsList() {
      const unsupportedFnList = this.sqlUi.getUnsupportedFnList()
      return [
        ...this.availableFunctions.filter(fn => !unsupportedFnList.includes(fn)).map(fn => ({
          text: fn + '()',
          type: 'function',
          description: formulas[fn].description,
          syntax: formulas[fn].syntax,
          examples: formulas[fn].examples
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
    jsep.plugins.register(jsepCurlyHook)
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
        this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000)
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
    parseAndValidateFormula(formula) {
      try {
        const pt = jsep(formula)
        const err = this.validateAgainstMeta(pt)
        if (err.size) {
          return [...err].join(', ')
        }
        return true
      } catch (e) {
        return e.message
      }
    },
    validateAgainstMeta(pt, arr = new Set()) {
      if (pt.type === jsep.CALL_EXP) {
        if (!this.availableFunctions.includes(pt.callee.name)) {
          arr.add(`'${pt.callee.name}' function is not available`)
        }
        const validation = formulas[pt.callee.name] && formulas[pt.callee.name].validation
        // validate arguments
        if (validation && validation.args) {
          if (validation.args.rqd !== undefined && validation.args.rqd !== pt.arguments.length) {
            arr.add(`'${pt.callee.name}' required ${validation.args.rqd} arguments`)
          } else if (validation.args.min !== undefined && validation.args.min > pt.arguments.length) {
            arr.add(`'${pt.callee.name}' required minimum ${validation.args.min} arguments`)
          } else if (validation.args.max !== undefined && validation.args.max < pt.arguments.length) {
            arr.add(`'${pt.callee.name}' required maximum ${validation.args.max} arguments`)
          }
        }
        // validate data type
        const type = formulas[pt.callee.name].type
        if (type === formulaTypes.NUMERIC) {
          for (const arg of pt.arguments) {
            if (arg.value && typeof arg.value !== 'number') {
              arr.add(`Value '${arg.value}' should have a numeric type`)
            }
            if (arg.name) {
              // TODO: handle jsep.IDENTIFIER case
              // arr.add(`Column '${arg.name}' should have a numeric type`)
            }
          }
        } else if (type === formulaTypes.STRING) {
          for (const arg of pt.arguments) {
            if (arg.value && typeof arg.value !== 'string') {
              arr.add(`Value '${arg.value}' should have a string type`)
            }
            if (arg.name) {
              // TODO: handle jsep.IDENTIFIER case
              // arr.add(`Column '${arg.name}' should have a string type`)
            }
          }
        } else if (type === formulaTypes.DATE) {
          if (pt.callee.name === 'DATEADD') {
            // pt.arguments[0] = date type
            // pt.arguments[1] = numeric
            // pt.arguments[2] = ["day" | "week" | "month" | "year"]
            // TODO: write a dry-run function to validate each segment
          }
        }
        pt.arguments.map(arg => this.validateAgainstMeta(arg, arr))
      } else if (pt.type === jsep.IDENTIFIER) {
        if (this.meta.columns.filter(c => !this.column || this.column.id !== c.id).every(c => c.title !== pt.name)) {
          arr.add(`Column '${pt.name}' is not available`)
        }

        // check circular reference
        // e.g. formula1 -> formula2 -> formula1 should return circular reference error
        const formulaPaths = [
          // all formula fields excluding itself
          ...this.meta.columns.filter(c => c.id !== this.column.id && c.uidt === UITypes.Formula),
          // include target formula field before saving
          ...this.meta.columns.filter(c => c.title === pt.name && c.uidt === UITypes.Formula)
        ].reduce((res, c) => {
          // in `formula`, get all the target neighbours
          // i.e. all column id (e.g. cl_xxxxxxxxxxxxxx) with formula type
          const neighbours = (c.colOptions.formula.match(/cl_\w{14}/g) || []).filter(colId => (this.meta.columns.filter(col => (col.id === colId && col.uidt === UITypes.Formula)).length))
          if (neighbours.length > 0) {
            // e.g. formula column 1 -> [formula column 2, formula column3]
            res.push({ [c.id]: neighbours })
          }
          return res
        }, [])
        const vertices = formulaPaths.length
        if (vertices > 0) {
          // perform kahn's algo for cycle detection
          const adj = new Map()
          const inDegrees = new Map()
          // init adjacency list & indegree
          for (const [_, v] of Object.entries(formulaPaths)) {
            const src = Object.keys(v)[0]
            const neighbours = v[src]
            inDegrees.set(src, inDegrees.get(src) || 0)
            for (const neighbour of neighbours) {
              adj.set(src, (adj.get(src) || new Set()).add(neighbour))
              inDegrees.set(neighbour, (inDegrees.get(neighbour) || 0) + 1)
            }
          }
          const queue = []
          // put all vertices with in-degree = 0 (i.e. no incoming edges) to queue
          inDegrees.forEach((inDegree, col) => {
            if (inDegree === 0) {
              // in-degree = 0 means we start traversing from this node
              queue.push(col)
            }
          })
          // init count of visited vertices
          let visited = 0
          // BFS
          while (queue.length !== 0) {
            // remove a vertex from the queue
            const src = queue.shift()
            // if this node has neighbours, increase visited by 1
            const neighbours = adj.get(src) || new Set()
            if (neighbours.size > 0) {
              visited += 1
            }
            // iterate each neighbouring nodes
            neighbours.forEach((neighbour) => {
              // decrease in-degree of its neighbours by 1
              inDegrees.set(neighbour, inDegrees.get(neighbour) - 1)
              // if in-degree becomes 0
              if (inDegrees.get(neighbour) === 0) {
                // then put the neighboring node to the queue
                queue.push(neighbour)
              }
            })
          }
          // vertices not same as visited = cycle found
          if (vertices !== visited) {
            arr.add('Can’t save field because it causes a circular reference')
          }
        }
      } else if (pt.type === jsep.BINARY_EXP) {
        if (!this.availableBinOps.includes(pt.operator)) {
          arr.add(`'${pt.operator}' operation is not available`)
        }
        this.validateAgainstMeta(pt.left, arr)
        this.validateAgainstMeta(pt.right, arr)
      } else if (pt.type === jsep.LITERAL) {
        // do nothing
      } else if (pt.type === jsep.COMPOUND) {
        if (pt.body.length) {
          arr.add('Can’t save field because the formula is invalid')
        }
      } else {
        arr.add('Can’t save field because the formula is invalid')
      }
      return arr
    },
    appendText(it) {
      const text = it.text
      const len = this.wordToComplete.length
      if (it.type === 'function') {
        this.$set(this.formula, 'value', insertAtCursor(this.$refs.input.$el.querySelector('input'), text, len, 1))
      } else if (it.type === 'column') {
        this.$set(this.formula, 'value', insertAtCursor(this.$refs.input.$el.querySelector('input'), '{' + text + '}', len))
      } else {
        this.$set(this.formula, 'value', insertAtCursor(this.$refs.input.$el.querySelector('input'), text, len))
      }
      this.autocomplete = false
      this.suggestion = null
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
      this.suggestion = this.acTree.complete(this.wordToComplete)?.sort((x, y) => this.sortOrder[x.type] - this.sortOrder[y.type])
      this.autocomplete = !!this.suggestion.length
    },
    selectText() {
      if (this.suggestion && this.selected > -1 && this.selected < this.suggestion.length) {
        this.appendText(this.suggestion[this.selected])
      }
    },
    suggestionListDown() {
      if (this.suggestion) {
        this.selected = ++this.selected % this.suggestion.length
        this.scrollToSelectedOption()
      }
    },
    suggestionListUp() {
      if (this.suggestion) {
        this.selected = --this.selected > -1 ? this.selected : this.suggestion.length - 1
        this.scrollToSelectedOption()
      }
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
  ::v-deep {
    .formula-suggestion .v-card__text {
        font-size: 0.75rem;
        padding: 8px;
        text-align: center;
      }
  }

  .hint {
    font-size: 0.75rem;
    line-height: normal;
    padding: 10px 5px;
  }
</style>
