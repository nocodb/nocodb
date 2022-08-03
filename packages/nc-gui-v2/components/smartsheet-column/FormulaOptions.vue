<script setup lang="ts">
import jsep from 'jsep';
import { UITypes, jsepCurlyHook } from 'nocodb-sdk';
import { formulaList, formulas, formulaTypes } from '@/utils'


const formula = ref({})

const availableFunctions = formulaList

const availableBinOps = ['+', '-', '*', '/', '>', '<', '==', '<=', '>=', '!=']

const autocomplete = ref(false)

const suggestion = ref()

const wordToComplete = ref('')

const selected = ref(0)

const tooltip = ref(true)

const sortOrder = {
  column: 0,
  function: 1,
  op: 2,
}
</script>

<template>
  <div class="formula-wrapper">
    <a-text-field
      ref="input"
      v-model:value="formula.value"
      dense
      outlined
      class="caption"
      hide-details="auto"
      label="Formula"
      :rules="[(v) => !!v || 'Required', (v) => parseAndValidateFormula(v)]"
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
