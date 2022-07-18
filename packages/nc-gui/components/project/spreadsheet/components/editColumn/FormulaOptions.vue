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
      <a href="https://docs.nocodb.com/setup-and-usages/formulas#available-formula-features" target="_blank">Formulas</a
      >.
    </div>
    <v-card v-if="suggestion && suggestion.length" class="formula-suggestion">
      <v-card-text>Suggestions</v-card-text>
      <v-divider />
      <v-list ref="sugList" dense max-height="50vh" style="overflow: auto">
        <v-list-item-group v-model="selected" color="primary">
          <v-list-item
            v-for="(it, i) in suggestion"
            :key="i"
            ref="sugOptions"
            dense
            selectable
            @mousedown.prevent="appendText(it)"
          >
            <!-- Function -->
            <template v-if="it.type === 'function'">
              <v-tooltip right offset-x nudge-right="100">
                <template #activator="{ on }">
                  <v-list-item-content v-on="on">
                    <span class="caption primary--text text--lighten-2 font-weight-bold">
                      <v-icon color="primary lighten-2" small class="mr-1"> mdi-function </v-icon>
                      {{ it.text }}
                    </span>
                  </v-list-item-content>
                  <v-list-item-action>
                    <span class="caption"> Function </span>
                  </v-list-item-action>
                </template>
                <div>
                  {{ it.description }} <br /><br />
                  Syntax: <br />
                  {{ it.syntax }} <br /><br />
                  Examples: <br />
                  <div v-for="(example, idx) in it.examples" :key="idx">
                    <pre>({{ idx + 1 }}): {{ example }}</pre>
                  </div>
                </div>
              </v-tooltip>
            </template>

            <!-- Column -->
            <template v-if="it.type === 'column'">
              <v-list-item-content>
                <span class="caption text--darken-3 font-weight-bold">
                  <v-icon color="grey darken-4" small class="mr-1">
                    {{ it.icon }}
                  </v-icon>
                  {{ it.text }}
                </span>
              </v-list-item-content>
              <v-list-item-action>
                <span class="caption"> Column </span>
              </v-list-item-action>
            </template>

            <!-- Operator -->
            <template v-if="it.type === 'op'">
              <v-list-item-content>
                <span class="caption indigo--text text--darken-3 font-weight-bold">
                  <v-icon color="indigo darken-3" small class="mr-1"> mdi-calculator-variant </v-icon>
                  {{ it.text }}
                </span>
              </v-list-item-content>

              <v-list-item-action>
                <span class="caption"> Operator </span>
              </v-list-item-action>
            </template>
          </v-list-item>
        </v-list-item-group>
      </v-list>
    </v-card>
  </div>
</template>

<script>
import debounce from 'debounce';
import jsep from 'jsep';
import { UITypes, jsepCurlyHook } from 'nocodb-sdk';
import { getUIDTIcon } from '~/components/project/spreadsheet/helpers/uiTypes';
import formulaList, { formulas, formulaTypes } from '@/helpers/formulaList';
import { validateDateWithUnknownFormat } from '@/helpers/dateFormatHelper';
import { getWordUntilCaret, insertAtCursor } from '@/helpers';
import NcAutocompleteTree from '@/helpers/NcAutocompleteTree';

export default {
  name: 'FormulaOptions',
  props: ['nodes', 'column', 'meta', 'isSQLite', 'alias', 'value', 'sqlUi'],
  data: () => ({
    formula: {},
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
      op: 2,
    },
  }),
  computed: {
    suggestionsList() {
      const unsupportedFnList = this.sqlUi.getUnsupportedFnList();
      return [
        ...this.availableFunctions
          .filter(fn => !unsupportedFnList.includes(fn))
          .map(fn => ({
            text: fn + '()',
            type: 'function',
            description: formulas[fn].description,
            syntax: formulas[fn].syntax,
            examples: formulas[fn].examples,
          })),
        ...this.meta.columns
          .filter(
            c =>
              !this.column || (this.column.id !== c.id && !(c.uidt === UITypes.LinkToAnotherRecord && c.system === 1))
          )
          .map(c => ({
            text: c.title,
            type: 'column',
            icon: getUIDTIcon(c.uidt),
            c,
          })),
        ...this.availableBinOps.map(op => ({
          text: op,
          type: 'op',
        })),
      ];
    },
    acTree() {
      const ref = new NcAutocompleteTree();
      for (const sug of this.suggestionsList) {
        ref.add(sug);
      }
      return ref;
    },
  },
  watch: {
    value(v, o) {
      if (v !== o) {
        this.formula = this.formula || {};
        this.formula.value = v || '';
      }
    },
    'formula.value'(v, o) {
      if (v !== o) {
        this.$emit('input', v);
      }
    },
  },
  created() {
    this.formula = { value: this.value || '' };
    jsep.plugins.register(jsepCurlyHook);
  },
  methods: {
    async save() {
      try {
        const formulaCol = {
          title: this.alias,
          uidt: UITypes.Formula,
          formula_raw: this.formula.value,
        };

        const col = await this.$api.dbTableColumn.create(this.meta.id, formulaCol);

        this.$toast.success('Formula column saved successfully').goAway(3000);
        return this.$emit('saved', this.alias);
      } catch (e) {
        this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000);
      }
    },
    async update() {
      try {
        const meta = JSON.parse(JSON.stringify(this.$store.state.meta.metas[this.meta.table_name]));

        const col = meta.v.find(c => c.title === this.column.title && c.formula);

        Object.assign(col, {
          _cn: this.alias,
          formula: {
            ...this.formula,
            tree: jsep(this.formula.value),
            error: undefined,
          },
        });

        await this.$store.dispatch('sqlMgr/ActSqlOp', [
          {
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias,
          },
          'xcModelSet',
          {
            tn: this.nodes.table_name,
            meta,
          },
        ]);
        this.$toast.success('Formula column updated successfully').goAway(3000);
      } catch (e) {
        this.$toast.error(e.message).goAway(3000);
      }
    },
    parseAndValidateFormula(formula) {
      try {
        const parsedTree = jsep(formula);
        const metaErrors = this.validateAgainstMeta(parsedTree);
        if (metaErrors.size) {
          return [...metaErrors].join(', ');
        }
        return true;
      } catch (e) {
        return e.message;
      }
    },
    validateAgainstMeta(parsedTree, errors = new Set(), typeErrors = new Set()) {
      if (parsedTree.type === jsep.CALL_EXP) {
        // validate function name
        if (!this.availableFunctions.includes(parsedTree.callee.name)) {
          errors.add(`'${parsedTree.callee.name}' function is not available`);
        }
        // validate arguments
        const validation = formulas[parsedTree.callee.name] && formulas[parsedTree.callee.name].validation;
        if (validation && validation.args) {
          if (validation.args.rqd !== undefined && validation.args.rqd !== parsedTree.arguments.length) {
            errors.add(`'${parsedTree.callee.name}' required ${validation.args.rqd} arguments`);
          } else if (validation.args.min !== undefined && validation.args.min > parsedTree.arguments.length) {
            errors.add(`'${parsedTree.callee.name}' required minimum ${validation.args.min} arguments`);
          } else if (validation.args.max !== undefined && validation.args.max < parsedTree.arguments.length) {
            errors.add(`'${parsedTree.callee.name}' required maximum ${validation.args.max} arguments`);
          }
        }
        parsedTree.arguments.map(arg => this.validateAgainstMeta(arg, errors));

        // validate data type
        if (parsedTree.callee.type === jsep.IDENTIFIER) {
          const expectedType = formulas[parsedTree.callee.name].type;
          if (expectedType === formulaTypes.NUMERIC) {
            if (parsedTree.callee.name === 'WEEKDAY') {
              // parsedTree.arguments[0] = date
              this.validateAgainstType(
                parsedTree.arguments[0],
                formulaTypes.DATE,
                v => {
                  if (!validateDateWithUnknownFormat(v)) {
                    typeErrors.add('The first parameter of WEEKDAY() should have date value');
                  }
                },
                typeErrors
              );
              // parsedTree.arguments[1] = startDayOfWeek (optional)
              this.validateAgainstType(
                parsedTree.arguments[1],
                formulaTypes.STRING,
                v => {
                  if (
                    typeof v !== 'string' ||
                    !['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(
                      v.toLowerCase()
                    )
                  ) {
                    typeErrors.add(
                      'The second parameter of WEEKDAY() should have the value either "sunday", "monday", "tuesday", "wednesday", "thursday", "friday" or "saturday"'
                    );
                  }
                },
                typeErrors
              );
            } else {
              parsedTree.arguments.map(arg => this.validateAgainstType(arg, expectedType, null, typeErrors));
            }
          } else if (expectedType === formulaTypes.DATE) {
            if (parsedTree.callee.name === 'DATEADD') {
              // parsedTree.arguments[0] = date
              this.validateAgainstType(
                parsedTree.arguments[0],
                formulaTypes.DATE,
                v => {
                  if (!validateDateWithUnknownFormat(v)) {
                    typeErrors.add('The first parameter of DATEADD() should have date value');
                  }
                },
                typeErrors
              );
              // parsedTree.arguments[1] = numeric
              this.validateAgainstType(
                parsedTree.arguments[1],
                formulaTypes.NUMERIC,
                v => {
                  if (typeof v !== 'number') {
                    typeErrors.add('The second parameter of DATEADD() should have numeric value');
                  }
                },
                typeErrors
              );
              // parsedTree.arguments[2] = ["day" | "week" | "month" | "year"]
              this.validateAgainstType(
                parsedTree.arguments[2],
                formulaTypes.STRING,
                v => {
                  if (!['day', 'week', 'month', 'year'].includes(v)) {
                    typeErrors.add(
                      'The third parameter of DATEADD() should have the value either "day", "week", "month" or "year"'
                    );
                  }
                },
                typeErrors
              );
            }
          }
        }

        errors = new Set([...errors, ...typeErrors]);
      } else if (parsedTree.type === jsep.IDENTIFIER) {
        if (
          this.meta.columns.filter(c => !this.column || this.column.id !== c.id).every(c => c.title !== parsedTree.name)
        ) {
          errors.add(`Column '${parsedTree.name}' is not available`);
        }

        // check circular reference
        // e.g. formula1 -> formula2 -> formula1 should return circular reference error

        // get all formula columns excluding itself
        const formulaPaths = this.meta.columns
          .filter(c => c.id !== this.column.id && c.uidt === UITypes.Formula)
          .reduce((res, c) => {
            // in `formula`, get all the target neighbours
            // i.e. all column id (e.g. cl_xxxxxxxxxxxxxx) with formula type
            const neighbours = (c.colOptions.formula.match(/cl_\w{14}/g) || []).filter(
              colId => this.meta.columns.filter(col => col.id === colId && col.uidt === UITypes.Formula).length
            );
            if (neighbours.length > 0) {
              // e.g. formula column 1 -> [formula column 2, formula column3]
              res.push({ [c.id]: neighbours });
            }
            return res;
          }, []);
        // include target formula column (i.e. the one to be saved if applicable)
        const targetFormulaCol = this.meta.columns.find(c => c.title === parsedTree.name && c.uidt === UITypes.Formula);
        if (targetFormulaCol) {
          formulaPaths.push({
            [this.column.id]: [targetFormulaCol.id],
          });
        }
        const vertices = formulaPaths.length;
        if (vertices > 0) {
          // perform kahn's algo for cycle detection
          const adj = new Map();
          const inDegrees = new Map();
          // init adjacency list & indegree
          for (const [_, v] of Object.entries(formulaPaths)) {
            const src = Object.keys(v)[0];
            const neighbours = v[src];
            inDegrees.set(src, inDegrees.get(src) || 0);
            for (const neighbour of neighbours) {
              adj.set(src, (adj.get(src) || new Set()).add(neighbour));
              inDegrees.set(neighbour, (inDegrees.get(neighbour) || 0) + 1);
            }
          }
          const queue = [];
          // put all vertices with in-degree = 0 (i.e. no incoming edges) to queue
          inDegrees.forEach((inDegree, col) => {
            if (inDegree === 0) {
              // in-degree = 0 means we start traversing from this node
              queue.push(col);
            }
          });
          // init count of visited vertices
          let visited = 0;
          // BFS
          while (queue.length !== 0) {
            // remove a vertex from the queue
            const src = queue.shift();
            // if this node has neighbours, increase visited by 1
            const neighbours = adj.get(src) || new Set();
            if (neighbours.size > 0) {
              visited += 1;
            }
            // iterate each neighbouring nodes
            neighbours.forEach(neighbour => {
              // decrease in-degree of its neighbours by 1
              inDegrees.set(neighbour, inDegrees.get(neighbour) - 1);
              // if in-degree becomes 0
              if (inDegrees.get(neighbour) === 0) {
                // then put the neighboring node to the queue
                queue.push(neighbour);
              }
            });
          }
          // vertices not same as visited = cycle found
          if (vertices !== visited) {
            errors.add('Can’t save field because it causes a circular reference');
          }
        }
      } else if (parsedTree.type === jsep.BINARY_EXP) {
        if (!this.availableBinOps.includes(parsedTree.operator)) {
          errors.add(`'${parsedTree.operator}' operation is not available`);
        }
        this.validateAgainstMeta(parsedTree.left, errors);
        this.validateAgainstMeta(parsedTree.right, errors);
      } else if (parsedTree.type === jsep.LITERAL || parsedTree.type === jsep.UNARY_EXP) {
        // do nothing
      } else if (parsedTree.type === jsep.COMPOUND) {
        if (parsedTree.body.length) {
          errors.add('Can’t save field because the formula is invalid');
        }
      } else {
        errors.add('Can’t save field because the formula is invalid');
      }
      return errors;
    },
    validateAgainstType(parsedTree, expectedType, func, typeErrors = new Set()) {
      if (parsedTree === false || typeof parsedTree === 'undefined') {
        return typeErrors;
      }
      if (parsedTree.type === jsep.LITERAL) {
        if (typeof func === 'function') {
          func(parsedTree.value);
        } else if (expectedType === formulaTypes.NUMERIC) {
          if (typeof parsedTree.value !== 'number') {
            typeErrors.add('Numeric type is expected');
          }
        } else if (expectedType === formulaTypes.STRING) {
          if (typeof parsedTree.value !== 'string') {
            typeErrors.add('string type is expected');
          }
        }
      } else if (parsedTree.type === jsep.IDENTIFIER) {
        const col = this.meta.columns.find(c => c.title === parsedTree.name);
        if (col === undefined) {
          return;
        }
        if (col.uidt === UITypes.Formula) {
          const foundType = this.getRootDataType(jsep(col.colOptions.formula_raw));
          if (foundType === 'N/A') {
            typeErrors.add(`Not supported to reference column ${c.title}`);
          } else if (expectedType !== foundType) {
            typeErrors.add(`Type ${expectedType} is expected but found Type ${foundType}`);
          }
        } else {
          switch (col.uidt) {
            // string
            case UITypes.SingleLineText:
            case UITypes.LongText:
            case UITypes.MultiSelect:
            case UITypes.SingleSelect:
            case UITypes.PhoneNumber:
            case UITypes.Email:
            case UITypes.URL:
              if (expectedType !== formulaTypes.STRING) {
                typeErrors.add(
                  `Column '${parsedTree.name}' with ${formulaTypes.STRING} type is found but ${expectedType} type is expected`
                );
              }
              break;

            // numeric
            case UITypes.Year:
            case UITypes.Number:
            case UITypes.Decimal:
            case UITypes.Rating:
            case UITypes.Count:
            case UITypes.AutoNumber:
              if (expectedType !== formulaTypes.NUMERIC) {
                typeErrors.add(
                  `Column '${parsedTree.name}' with ${formulaTypes.NUMERIC} type is found but ${expectedType} type is expected`
                );
              }
              break;

            // date
            case UITypes.Date:
            case UITypes.DateTime:
            case UITypes.CreateTime:
            case UITypes.LastModifiedTime:
              if (expectedType !== formulaTypes.DATE) {
                typeErrors.add(
                  `Column '${parsedTree.name}' with ${formulaTypes.DATE} type is found but ${expectedType} type is expected`
                );
              }
              break;

            // not supported
            case UITypes.ForeignKey:
            case UITypes.Attachment:
            case UITypes.ID:
            case UITypes.Time:
            case UITypes.Currency:
            case UITypes.Percent:
            case UITypes.Duration:
            case UITypes.Rollup:
            case UITypes.Lookup:
            case UITypes.Barcode:
            case UITypes.Button:
            case UITypes.Checkbox:
            case UITypes.Collaborator:
            default:
              typeErrors.add(`Not supported to reference column '${parsedTree.name}'`);
              break;
          }
        }
      } else if (parsedTree.type === jsep.UNARY_EXP || parsedTree.type === jsep.BINARY_EXP) {
        if (expectedType !== formulaTypes.NUMERIC) {
          // parsedTree.name won't be available here
          typeErrors.add(`${formulaTypes.NUMERIC} type is found but ${expectedType} type is expected`);
        }
      } else if (parsedTree.type === jsep.CALL_EXP) {
        if (formulas[parsedTree.callee.name]?.type && expectedType !== formulas[parsedTree.callee.name].type) {
          typeErrors.add(`${expectedType} not matched with ${formulas[parsedTree.callee.name].type}`);
        }
      }
      return typeErrors;
    },
    getRootDataType(parsedTree) {
      // given a parse tree, return the data type of it
      if (parsedTree.type === jsep.CALL_EXP) {
        return formulas[parsedTree.callee.name].type;
      } else if (parsedTree.type === jsep.IDENTIFIER) {
        const col = this.meta.columns.find(c => c.title === parsedTree.name);
        if (col.uidt === UITypes.Formula) {
          return this.getRootDataType(jsep(col.colOptions.formula_raw));
        } else {
          switch (col.uidt) {
            // string
            case UITypes.SingleLineText:
            case UITypes.LongText:
            case UITypes.MultiSelect:
            case UITypes.SingleSelect:
            case UITypes.PhoneNumber:
            case UITypes.Email:
            case UITypes.URL:
              return formulaTypes.STRING;

            // numeric
            case UITypes.Year:
            case UITypes.Number:
            case UITypes.Decimal:
            case UITypes.Rating:
            case UITypes.Count:
            case UITypes.AutoNumber:
              return formulaTypes.NUMERIC;

            // date
            case UITypes.Date:
            case UITypes.DateTime:
            case UITypes.CreateTime:
            case UITypes.LastModifiedTime:
              return formulaTypes.DATE;

            // not supported
            case UITypes.ForeignKey:
            case UITypes.Attachment:
            case UITypes.ID:
            case UITypes.Time:
            case UITypes.Currency:
            case UITypes.Percent:
            case UITypes.Duration:
            case UITypes.Rollup:
            case UITypes.Lookup:
            case UITypes.Barcode:
            case UITypes.Button:
            case UITypes.Checkbox:
            case UITypes.Collaborator:
            default:
              return 'N/A';
          }
        }
      } else if (parsedTree.type === jsep.BINARY_EXP || parsedTree.type === jsep.UNARY_EXP) {
        return formulaTypes.NUMERIC;
      } else if (parsedTree.type === jsep.LITERAL) {
        return typeof parsedTree.value;
      } else {
        return 'N/A';
      }
    },
    isCurlyBracketBalanced() {
      // count number of opening curly brackets and closing curly brackets
      const cntCurlyBrackets = (this.$refs.input.$el.querySelector('input').value.match(/\{|}/g) || []).reduce(
        (acc, cur) => ((acc[cur] = (acc[cur] || 0) + 1), acc),
        {}
      );
      return (cntCurlyBrackets['{'] || 0) === (cntCurlyBrackets['}'] || 0);
    },
    appendText(it) {
      const text = it.text;
      const len = this.wordToComplete.length;
      if (it.type === 'function') {
        this.$set(this.formula, 'value', insertAtCursor(this.$refs.input.$el.querySelector('input'), text, len, 1));
      } else if (it.type === 'column') {
        this.$set(
          this.formula,
          'value',
          insertAtCursor(
            this.$refs.input.$el.querySelector('input'),
            '{' + text + '}',
            len + !this.isCurlyBracketBalanced()
          )
        );
      } else {
        this.$set(this.formula, 'value', insertAtCursor(this.$refs.input.$el.querySelector('input'), text, len));
      }
      this.autocomplete = false;
      this.suggestion = null;
    },
    _handleInputDeb: debounce(async function (self) {
      await self.handleInput();
    }, 250),
    handleInputDeb() {
      this._handleInputDeb(this);
    },
    handleInput() {
      this.selected = 0;
      this.suggestion = null;
      const query = getWordUntilCaret(this.$refs.input.$el.querySelector('input'));
      const parts = query.split(/\W+/);
      this.wordToComplete = parts.pop();
      this.suggestion = this.acTree
        .complete(this.wordToComplete)
        ?.sort((x, y) => this.sortOrder[x.type] - this.sortOrder[y.type]);
      if (!this.isCurlyBracketBalanced()) {
        this.suggestion = this.suggestion.filter(v => v.type === 'column');
      }
      this.autocomplete = !!this.suggestion.length;
    },
    selectText() {
      if (this.suggestion && this.selected > -1 && this.selected < this.suggestion.length) {
        this.appendText(this.suggestion[this.selected]);
      }
    },
    suggestionListDown() {
      if (this.suggestion) {
        this.selected = ++this.selected % this.suggestion.length;
        this.scrollToSelectedOption();
      }
    },
    suggestionListUp() {
      if (this.suggestion) {
        this.selected = --this.selected > -1 ? this.selected : this.suggestion.length - 1;
        this.scrollToSelectedOption();
      }
    },
    scrollToSelectedOption() {
      this.$nextTick(() => {
        if (this.$refs.sugOptions[this.selected]) {
          try {
            this.$refs.sugList.$el.scrollTo({
              top: this.$refs.sugOptions[this.selected].$el.offsetTop,
              behavior: 'smooth',
            });
          } catch (e) {}
        }
      });
    },
  },
};
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
