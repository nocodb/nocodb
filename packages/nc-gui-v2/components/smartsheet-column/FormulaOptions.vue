<script setup lang="ts">
import jsep from 'jsep'
import { UITypes, jsepCurlyHook } from 'nocodb-sdk'
import { useColumnCreateStoreOrThrow, useDebounceFn } from '#imports'
import { MetaInj } from '~/context'
import { NcAutocompleteTree, formulaList, formulaTypes, formulas, getUIDTIcon, getWordUntilCaret, insertAtCursor } from '@/utils'

const { formState, validateInfos, setAdditionalValidations, sqlUi, onDataTypeChange, onAlter, column } =
  useColumnCreateStoreOrThrow()

const meta = inject(MetaInj)

const columns = computed(() => meta?.value?.columns || [])

const validators = {
  'colOptions.formula_raw': [
    {
      validator: (_: any, formula: any) => {
        return new Promise<void>((resolve, reject) => {
          if (!parseAndValidateFormula(formula)) {
            return reject(new Error('Invalid formula'))
          }
          resolve()
        })
      },
    },
  ],
}

const formula = ref()

const availableFunctions = formulaList

const availableBinOps = ['+', '-', '*', '/', '>', '<', '==', '<=', '>=', '!=']

const autocomplete = ref(false)

const suggestion = ref()

const formulaRef = ref()

const sugListRef = ref()

const sugOptionsRef = ref()

const wordToComplete = ref<string | undefined>('')

const selected = ref(0)

const tooltip = ref(true)

const sortOrder: Record<string, number> = {
  column: 0,
  function: 1,
  op: 2,
}

const suggestionsList = computed(() => {
  const unsupportedFnList = sqlUi.value.getUnsupportedFnList()
  return [
    ...availableFunctions
      .filter((fn) => !unsupportedFnList.includes(fn))
      .map((fn) => ({
        text: `${fn}()`,
        type: 'function',
        description: formulas[fn].description,
        syntax: formulas[fn].syntax,
        examples: formulas[fn].examples,
      })),
    ...columns.value
      .filter(
        (c: Record<string, any>) =>
          !column || (column.id !== c.id && !(c.uidt === UITypes.LinkToAnotherRecord && c.system === 1)),
      )
      .map((c: any) => ({
        text: c.title,
        type: 'column',
        icon: getUIDTIcon(c.uidt),
        c,
      })),
    ...availableBinOps.map((op: string) => ({
      text: op,
      type: 'op',
    })),
  ]
})

const acTree = computed(() => {
  const ref = new NcAutocompleteTree()
  for (const sug of suggestionsList.value) {
    ref.add(sug)
  }
  return ref
})

function parseAndValidateFormula(formula: string) {
  try {
    const parsedTree = jsep(formula)
    const metaErrors = validateAgainstMeta(parsedTree)
    if (metaErrors.length) {
      return [...metaErrors].join(', ')
    }
    return true
  } catch (e: any) {
    return e.message
  }
}

function validateAgainstMeta(parsedTree: any, errors = new Set(), typeErrors = new Set()) {
  return []
  //   if (parsedTree.type === jsep.CALL_EXP) {
  //     // validate function name
  //     if (!this.availableFunctions.includes(parsedTree.callee.name)) {
  //       errors.add(`'${parsedTree.callee.name}' function is not available`);
  //     }
  //     // validate arguments
  //     const validation = formulas[parsedTree.callee.name] && formulas[parsedTree.callee.name].validation;
  //     if (validation && validation.args) {
  //       if (validation.args.rqd !== undefined && validation.args.rqd !== parsedTree.arguments.length) {
  //         errors.add(`'${parsedTree.callee.name}' required ${validation.args.rqd} arguments`);
  //       } else if (validation.args.min !== undefined && validation.args.min > parsedTree.arguments.length) {
  //         errors.add(`'${parsedTree.callee.name}' required minimum ${validation.args.min} arguments`);
  //       } else if (validation.args.max !== undefined && validation.args.max < parsedTree.arguments.length) {
  //         errors.add(`'${parsedTree.callee.name}' required maximum ${validation.args.max} arguments`);
  //       }
  //     }
  //     parsedTree.arguments.map(arg => this.validateAgainstMeta(arg, errors));
  //
  //     // validate data type
  //     if (parsedTree.callee.type === jsep.IDENTIFIER) {
  //       const expectedType = formulas[parsedTree.callee.name].type;
  //       if (expectedType === formulaTypes.NUMERIC) {
  //         if (parsedTree.callee.name === 'WEEKDAY') {
  //           // parsedTree.arguments[0] = date
  //           this.validateAgainstType(
  //               parsedTree.arguments[0],
  //               formulaTypes.DATE,
  //               v => {
  //                 if (!validateDateWithUnknownFormat(v)) {
  //                   typeErrors.add('The first parameter of WEEKDAY() should have date value');
  //                 }
  //               },
  //               typeErrors
  //           );
  //           // parsedTree.arguments[1] = startDayOfWeek (optional)
  //           this.validateAgainstType(
  //               parsedTree.arguments[1],
  //               formulaTypes.STRING,
  //               v => {
  //                 if (
  //                     typeof v !== 'string' ||
  //                     !['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(
  //                         v.toLowerCase()
  //                     )
  //                 ) {
  //                   typeErrors.add(
  //                       'The second parameter of WEEKDAY() should have the value either "sunday", "monday", "tuesday", "wednesday", "thursday", "friday" or "saturday"'
  //                   );
  //                 }
  //               },
  //               typeErrors
  //           );
  //         } else {
  //           parsedTree.arguments.map(arg => this.validateAgainstType(arg, expectedType, null, typeErrors));
  //         }
  //       } else if (expectedType === formulaTypes.DATE) {
  //         if (parsedTree.callee.name === 'DATEADD') {
  //           // parsedTree.arguments[0] = date
  //           this.validateAgainstType(
  //               parsedTree.arguments[0],
  //               formulaTypes.DATE,
  //               v => {
  //                 if (!validateDateWithUnknownFormat(v)) {
  //                   typeErrors.add('The first parameter of DATEADD() should have date value');
  //                 }
  //               },
  //               typeErrors
  //           );
  //           // parsedTree.arguments[1] = numeric
  //           this.validateAgainstType(
  //               parsedTree.arguments[1],
  //               formulaTypes.NUMERIC,
  //               v => {
  //                 if (typeof v !== 'number') {
  //                   typeErrors.add('The second parameter of DATEADD() should have numeric value');
  //                 }
  //               },
  //               typeErrors
  //           );
  //           // parsedTree.arguments[2] = ["day" | "week" | "month" | "year"]
  //           this.validateAgainstType(
  //               parsedTree.arguments[2],
  //               formulaTypes.STRING,
  //               v => {
  //                 if (!['day', 'week', 'month', 'year'].includes(v)) {
  //                   typeErrors.add(
  //                       'The third parameter of DATEADD() should have the value either "day", "week", "month" or "year"'
  //                   );
  //                 }
  //               },
  //               typeErrors
  //           );
  //         }
  //       }
  //     }
  //
  //     errors = new Set([...errors, ...typeErrors]);
  //   } else if (parsedTree.type === jsep.IDENTIFIER) {
  //     if (
  //         this.meta.columns.filter(c => !this.column || this.column.id !== c.id).every(c => c.title !== parsedTree.name)
  //     ) {
  //       errors.add(`Column '${parsedTree.name}' is not available`);
  //     }
  //
  //     // check circular reference
  //     // e.g. formula1 -> formula2 -> formula1 should return circular reference error
  //
  //     // get all formula columns excluding itself
  //     const formulaPaths = this.meta.columns
  //         .filter(c => c.id !== this.column.id && c.uidt === UITypes.Formula)
  //         .reduce((res, c) => {
  //           // in `formula`, get all the target neighbours
  //           // i.e. all column id (e.g. cl_xxxxxxxxxxxxxx) with formula type
  //           const neighbours = (c.colOptions.formula.match(/cl_\w{14}/g) || []).filter(
  //               colId => this.meta.columns.filter(col => col.id === colId && col.uidt === UITypes.Formula).length
  //           );
  //           if (neighbours.length > 0) {
  //             // e.g. formula column 1 -> [formula column 2, formula column3]
  //             res.push({ [c.id]: neighbours });
  //           }
  //           return res;
  //         }, []);
  //     // include target formula column (i.e. the one to be saved if applicable)
  //     const targetFormulaCol = this.meta.columns.find(c => c.title === parsedTree.name && c.uidt === UITypes.Formula);
  //     if (targetFormulaCol) {
  //       formulaPaths.push({
  //         [this.column.id]: [targetFormulaCol.id],
  //       });
  //     }
  //     const vertices = formulaPaths.length;
  //     if (vertices > 0) {
  //       // perform kahn's algo for cycle detection
  //       const adj = new Map();
  //       const inDegrees = new Map();
  //       // init adjacency list & indegree
  //       for (const [_, v] of Object.entries(formulaPaths)) {
  //         const src = Object.keys(v)[0];
  //         const neighbours = v[src];
  //         inDegrees.set(src, inDegrees.get(src) || 0);
  //         for (const neighbour of neighbours) {
  //           adj.set(src, (adj.get(src) || new Set()).add(neighbour));
  //           inDegrees.set(neighbour, (inDegrees.get(neighbour) || 0) + 1);
  //         }
  //       }
  //       const queue = [];
  //       // put all vertices with in-degree = 0 (i.e. no incoming edges) to queue
  //       inDegrees.forEach((inDegree, col) => {
  //         if (inDegree === 0) {
  //           // in-degree = 0 means we start traversing from this node
  //           queue.push(col);
  //         }
  //       });
  //       // init count of visited vertices
  //       let visited = 0;
  //       // BFS
  //       while (queue.length !== 0) {
  //         // remove a vertex from the queue
  //         const src = queue.shift();
  //         // if this node has neighbours, increase visited by 1
  //         const neighbours = adj.get(src) || new Set();
  //         if (neighbours.size > 0) {
  //           visited += 1;
  //         }
  //         // iterate each neighbouring nodes
  //         neighbours.forEach(neighbour => {
  //           // decrease in-degree of its neighbours by 1
  //           inDegrees.set(neighbour, inDegrees.get(neighbour) - 1);
  //           // if in-degree becomes 0
  //           if (inDegrees.get(neighbour) === 0) {
  //             // then put the neighboring node to the queue
  //             queue.push(neighbour);
  //           }
  //         });
  //       }
  //       // vertices not same as visited = cycle found
  //       if (vertices !== visited) {
  //         errors.add('Can’t save field because it causes a circular reference');
  //       }
  //     }
  //   } else if (parsedTree.type === jsep.BINARY_EXP) {
  //     if (!this.availableBinOps.includes(parsedTree.operator)) {
  //       errors.add(`'${parsedTree.operator}' operation is not available`);
  //     }
  //     this.validateAgainstMeta(parsedTree.left, errors);
  //     this.validateAgainstMeta(parsedTree.right, errors);
  //   } else if (parsedTree.type === jsep.LITERAL || parsedTree.type === jsep.UNARY_EXP) {
  //     // do nothing
  //   } else if (parsedTree.type === jsep.COMPOUND) {
  //     if (parsedTree.body.length) {
  //       errors.add('Can’t save field because the formula is invalid');
  //     }
  //   } else {
  //     errors.add('Can’t save field because the formula is invalid');
  //   }
  //   return errors;
}

function isCurlyBracketBalanced() {
  // count number of opening curly brackets and closing curly brackets
  const cntCurlyBrackets = (formulaRef.value.value.match(/\{|}/g) || []).reduce((acc: Record<number, number>, cur: number) => {
    acc[cur] = (acc[cur] || 0) + 1
    return acc
  }, {})
  return (cntCurlyBrackets['{'] || 0) === (cntCurlyBrackets['}'] || 0)
}

function appendText(it: Record<string, any>) {
  const text = it.text
  const len = wordToComplete.value?.length || 0
  if (it.type === 'function') {
    formula.value = insertAtCursor(formula.value, text, len, 1)
  } else if (it.type === 'column') {
    formula.value = insertAtCursor(formula.value, `{${text}}`, len + +!isCurlyBracketBalanced())
  } else {
    formula.value = insertAtCursor(formula.value, text, len)
  }
  autocomplete.value = false
  suggestion.value = null
}

const handleInputDeb = useDebounceFn(function () {
  handleInput()
}, 250)

function handleInput() {
  selected.value = 0
  suggestion.value = null
  const query = getWordUntilCaret(formulaRef.value)
  const parts = query.split(/\W+/)
  wordToComplete.value = parts.pop() || ''
  suggestion.value = acTree.value.complete(wordToComplete.value)?.sort((x, y) => sortOrder[x.type] - sortOrder[y.type]) // TODO: check .type
  if (!isCurlyBracketBalanced()) {
    suggestion.value = suggestion.value.filter((v: Record<string, any>) => v.type === 'column')
  }
  autocomplete.value = !!suggestion.value.length
}

function selectText() {
  if (suggestion && selected.value > -1 && selected.value < suggestion.value.length) {
    appendText(suggestion.value[selected.value])
  }
}

function suggestionListUp() {
  if (suggestion.value) {
    selected.value = --selected.value > -1 ? selected.value : suggestion.value.length - 1
    scrollToSelectedOption()
  }
}

function suggestionListDown() {
  if (suggestion.value) {
    selected.value = ++selected.value % suggestion.value.length
    scrollToSelectedOption()
  }
}

function scrollToSelectedOption() {
  nextTick(() => {
    if (sugOptionsRef.value[selected.value]) {
      try {
        sugListRef.value.$el.scrollTo({
          top: sugOptionsRef.value[selected.value].$el.offsetTop,
          behavior: 'smooth',
        })
      } catch (e) {}
    }
  })
}

// set default value
formState.value.colOptions = {
  formula: '',
  formula_raw: '',
  ...column?.colOptions,
}
</script>

<template>
  <div class="formula-wrapper">
    {{ formState.colOptions }}
    <a-form-item v-bind="validateInfos['colOptions.formula_raw']" label="Formula">
      <a-input
        ref="formulaRef"
        v-model:value="formState.colOptions.formula_raw"
        @keydown.down.prevent="suggestionListDown"
        @keydown.up.prevent="suggestionListUp"
        @keydown.enter.prevent="selectText"
        @change="handleInputDeb"
      />
    </a-form-item>
    <div class="hint">
      Hint: Use {} to reference columns, e.g: {column_name}. For more, please check out
      <a href="https://docs.nocodb.com/setup-and-usages/formulas#available-formula-features" target="_blank">Formulas</a>.
    </div>
    <a-card v-if="suggestion && suggestion.length" class="formula-suggestion">
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
    </a-card>
  </div>
</template>
