<script setup lang="ts">
import type { Ref } from 'vue'
import type { ListItem as AntListItem } from 'ant-design-vue'
import jsep from 'jsep'
import {
  FormulaError,
  UITypes,
  jsepCurlyHook,
  substituteColumnIdWithAliasInFormula,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk'
import type { ColumnType, FormulaType } from 'nocodb-sdk'
import {
  MetaInj,
  NcAutocompleteTree,
  computed,
  formulaList,
  formulas,
  getUIDTIcon,
  getWordUntilCaret,
  iconMap,
  inject,
  insertAtCursor,
  nextTick,
  onMounted,
  ref,
  useColumnCreateStoreOrThrow,
  useDebounceFn,
  useI18n,
  useMetas,
  useNocoEe,
  useVModel,
} from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const uiTypesNotSupportedInFormulas = [UITypes.QrCode, UITypes.Barcode]

const vModel = useVModel(props, 'value', emit)

const { setAdditionalValidations, validateInfos, sqlUi, column } = useColumnCreateStoreOrThrow()

const { t } = useI18n()

const { predictFunction: _predictFunction } = useNocoEe()

const meta = inject(MetaInj, ref())

const supportedColumns = computed(
  () => meta?.value?.columns?.filter((col) => !uiTypesNotSupportedInFormulas.includes(col.uidt as UITypes)) || [],
)
const { getMeta } = useMetas()

const suggestionPreviewed = ref<Record<any, string> | undefined>()

const validators = {
  formula_raw: [
    {
      validator: (_: any, formula: any) => {
        return (async () => {
          if (!formula?.trim()) throw new Error('Required')

          try {
            await validateFormulaAndExtractTreeWithType({
              column: column.value,
              formula,
              columns: supportedColumns.value,
              clientOrSqlUi: sqlUi.value,
              getMeta,
            })
          } catch (e: any) {
            if (e instanceof FormulaError && e.extra?.key) {
              throw new Error(t(e.extra.key, e.extra))
            }

            throw new Error(e.message)
          }
        })()
      },
    },
  ],
}

const availableFunctions = formulaList

const availableBinOps = ['+', '-', '*', '/', '>', '<', '==', '<=', '>=', '!=', '&']

const autocomplete = ref(false)

const formulaRef = ref()

const sugListRef = ref()

const variableListRef = ref<(typeof AntListItem)[]>([])

const sugOptionsRef = ref<(typeof AntListItem)[]>([])

const wordToComplete = ref<string | undefined>('')

const selected = ref(0)

const sortOrder: Record<string, number> = {
  column: 0,
  function: 1,
  op: 2,
}

const suggestionsList = computed(() => {
  const unsupportedFnList = sqlUi.value.getUnsupportedFnList()
  return [
    ...availableFunctions
      .filter((fn: string) => !unsupportedFnList.includes(fn))
      .map((fn: string) => ({
        text: `${fn}()`,
        type: 'function',
        description: formulas[fn].description,
        syntax: formulas[fn].syntax,
        examples: formulas[fn].examples,
        docsUrl: formulas[fn].docsUrl,
      })),
    ...supportedColumns.value
      .filter((c) => {
        // skip system LTAR columns
        if (c.uidt === UITypes.LinkToAnotherRecord && c.system) return false
        // v1 logic? skip the current column
        if (!column) return true
        return column.value?.id !== c.id
      })
      .map((c: any) => ({
        text: c.title,
        type: 'column',
        icon: getUIDTIcon(c.uidt),
        uidt: c.uidt,
      })),
    ...availableBinOps.map((op: string) => ({
      text: op,
      type: 'op',
    })),
  ]
})

// set default suggestion list
const suggestion: Ref<Record<string, any>[]> = ref(suggestionsList.value)

const acTree = computed(() => {
  const ref = new NcAutocompleteTree()
  for (const sug of suggestionsList.value) {
    ref.add(sug)
  }
  return ref
})

const suggestedFormulas = computed(() => {
  return suggestion.value.filter((s) => s && s.type !== 'column')
})

const variableList = computed(() => {
  return suggestion.value.filter((s) => s && s.type === 'column')
})

function isCurlyBracketBalanced() {
  // count number of opening curly brackets and closing curly brackets
  const cntCurlyBrackets = (formulaRef.value.$el.value.match(/\{|}/g) || []).reduce(
    (acc: Record<number, number>, cur: number) => {
      acc[cur] = (acc[cur] || 0) + 1
      return acc
    },
    {},
  )
  return (cntCurlyBrackets['{'] || 0) === (cntCurlyBrackets['}'] || 0)
}

function appendText(item: Record<string, any>) {
  const text = item.text
  const len = wordToComplete.value?.length || 0

  if (item.type === 'function') {
    vModel.value.formula_raw = insertAtCursor(formulaRef.value.$el, text, len, 1)
  } else if (item.type === 'column') {
    vModel.value.formula_raw = insertAtCursor(formulaRef.value.$el, `{${text}}`, len + +!isCurlyBracketBalanced())
  } else {
    vModel.value.formula_raw = insertAtCursor(formulaRef.value.$el, text, len)
  }
  autocomplete.value = false
  wordToComplete.value = ''
  if (item.type === 'function' || item.type === 'op') {
    // if function / operator is chosen, display columns only
    suggestion.value = suggestionsList.value.filter((f) => f.type === 'column')
  } else {
    // show all options if column is chosen
    suggestion.value = suggestionsList.value
  }
}

const handleInputDeb = useDebounceFn(function () {
  handleInput()
}, 250)

function handleInput() {
  selected.value = 0
  suggestion.value = []
  const query = getWordUntilCaret(formulaRef.value.$el)
  const parts = query.split(/\W+/)
  wordToComplete.value = parts.pop() || ''
  suggestion.value = acTree.value
    .complete(wordToComplete.value)
    ?.sort((x: Record<string, any>, y: Record<string, any>) => sortOrder[x.type] - sortOrder[y.type])

  if (suggestion.value.length > 0 && suggestion.value[0].type !== 'column') {
    suggestionPreviewed.value = suggestion.value[0]
  }

  if (!isCurlyBracketBalanced()) {
    suggestion.value = suggestion.value.filter((v) => v.type === 'column')
  }
  autocomplete.value = !!suggestion.value.length
}

function selectText() {
  if (suggestion.value && selected.value > -1 && selected.value < suggestionsList.value.length) {
    if (selected.value < suggestedFormulas.value.length) {
      appendText(suggestedFormulas.value[selected.value])
    } else {
      appendText(variableList.value[selected.value + suggestedFormulas.value.length])
    }
  }

  selected.value = 0
}

function suggestionListUp() {
  if (suggestion.value) {
    selected.value = --selected.value > -1 ? selected.value : suggestion.value.length - 1
    suggestionPreviewed.value = suggestedFormulas.value[selected.value]
    scrollToSelectedOption()
  }
}

function suggestionListDown() {
  if (suggestion.value) {
    selected.value = ++selected.value % suggestion.value.length
    suggestionPreviewed.value = suggestedFormulas.value[selected.value]

    scrollToSelectedOption()
  }
}

function scrollToSelectedOption() {
  nextTick(() => {
    if (sugOptionsRef.value[selected.value]) {
      try {
        sugOptionsRef.value[selected.value].$el.scrollIntoView({
          block: 'nearest',
          inline: 'start',
        })
      } catch (e) {}
    }
  })
}

// set default value
if ((column.value?.colOptions as any)?.formula_raw) {
  vModel.value.formula_raw =
    substituteColumnIdWithAliasInFormula(
      (column.value?.colOptions as FormulaType)?.formula,
      meta?.value?.columns as ColumnType[],
      (column.value?.colOptions as any)?.formula_raw,
    ) || ''
}

// set additional validations
setAdditionalValidations({
  ...validators,
})

onMounted(() => {
  jsep.plugins.register(jsepCurlyHook)
})
</script>

<template>
  <div class="formula-wrapper relative">
    <div
      v-if="suggestionPreviewed && suggestionPreviewed.type === 'function'"
      class="absolute -left-91 w-84 top-0 bg-white z-10 pl-3 pt-3 border-1 shadow-md rounded-xl"
    >
      <div class="pr-3">
        <div class="flex flex-row w-full justify-between pb-1 border-b-1">
          <div class="flex items-center gap-x-1 font-semibold text-base">
            <component :is="iconMap.function" class="text-lg" />
            {{ suggestionPreviewed.text }}
          </div>
          <NcButton type="text" size="small" @click="suggestionPreviewed = undefined">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
      <div class="flex flex-col max-h-120 nc-scrollbar-md pr-2">
        <div class="flex mt-3">{{ suggestionPreviewed.description }}</div>

        <div class="text-gray-500 uppercase text-xs mt-3 mb-2">Syntax</div>
        <div class="bg-white rounded-md py-1 px-2 border-1">{{ suggestionPreviewed.syntax }}</div>
        <div class="text-gray-500 uppercase text-xs mt-3 mb-2">Examples</div>
        <div
          v-for="(example, index) of suggestionPreviewed.examples"
          :key="example"
          class="bg-gray-100 py-1 px-2"
          :class="{
            'border-t-1 border-gray-200': index !== 0,
            'rounded-b-md': index === suggestionPreviewed.examples.length - 1 && suggestionPreviewed.examples.length !== 1,
            'rounded-t-md': index === 0 && suggestionPreviewed.examples.length !== 1,
            'rounded-md': suggestionPreviewed.examples.length === 1,
          }"
        >
          {{ example }}
        </div>
      </div>
      <div class="flex flex-row mt-1 mb-3 justify-end pr-3">
        <a target="_blank" rel="noopener noreferrer" :href="suggestionPreviewed.docsUrl">
          <NcButton type="text" class="!text-gray-400 !hover:text-gray-800 !text-xs"
            >View in Docs
            <GeneralIcon icon="openInNew" class="ml-1" />
          </NcButton>
        </a>
      </div>
    </div>
    <a-form-item v-bind="validateInfos.formula_raw" class="!pb-1" :label="$t('datatype.Formula')">
      <!-- <GeneralIcon
        v-if="isEeUI"
        icon="magic"
        :class="{ 'nc-animation-pulse': loadMagic }"
        class="text-orange-400 cursor-pointer absolute right-1 top-1 z-10"
        @click="predictFunction()"
      /> -->
      <a-textarea
        ref="formulaRef"
        v-model:value="vModel.formula_raw"
        class="nc-formula-input !rounded-md !my-1"
        @keydown.down.prevent="suggestionListDown"
        @keydown.up.prevent="suggestionListUp"
        @keydown.enter.prevent="selectText"
        @change="handleInputDeb"
      />
    </a-form-item>

    <div ref="sugListRef" class="h-[250px] overflow-auto nc-scrollbar-md">
      <template v-if="suggestedFormulas.length > 0">
        <div class="rounded-t-lg border-1 bg-gray-50 px-3 py-1 uppercase text-gray-600 text-xs">Formulas</div>

        <a-list
          :data-source="suggestedFormulas"
          :locale="{ emptyText: $t('msg.formula.noSuggestedFormulaFound') }"
          class="border-1 border-t-0 rounded-b-lg !mb-4"
        >
          <template #renderItem="{ item, index }">
            <a-list-item
              :ref="
                (el) => {
                  sugOptionsRef[index] = el
                }
              "
              class="cursor-pointer !overflow-hidden hover:bg-gray-50"
              :class="{
                '!bg-gray-100': selected === index,
              }"
              @click.prevent.stop="appendText(item)"
              @mouseenter="suggestionPreviewed = item"
            >
              <a-list-item-meta>
                <template #title>
                  <div class="flex items-center gap-x-1">
                    <component :is="iconMap.function" v-if="item.type === 'function'" class="text-lg" />

                    <component :is="iconMap.calculator" v-if="item.type === 'op'" class="text-lg" />

                    <component :is="item.icon" v-if="item.type === 'column'" class="text-lg" />
                    <span class="prose-sm text-gray-600">{{ item.text }}</span>
                  </div>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
      </template>

      <template v-if="variableList.length > 0">
        <div class="rounded-t-lg border-1 bg-gray-50 px-3 py-1 uppercase text-gray-600 text-xs">Fields</div>

        <a-list
          ref="variableListRef"
          :data-source="variableList"
          :locale="{ emptyText: $t('msg.formula.noSuggestedFormulaFound') }"
          class="border-1 border-t-0 rounded-b-lg !overflow-hidden"
        >
          <template #renderItem="{ item, index }">
            <a-list-item
              :ref="
                (el) => {
                  sugOptionsRef[index + suggestedFormulas.length] = el
                }
              "
              :class="{
                '!bg-gray-100': selected === index + suggestedFormulas.length,
              }"
              class="cursor-pointer hover:bg-gray-50"
              @click.prevent.stop="appendText(item)"
            >
              <a-list-item-meta>
                <template #title>
                  <div class="flex items-center gap-x-1">
                    <component :is="item.icon" class="text-lg" />

                    <span class="prose-sm text-gray-600">{{ item.text }}</span>
                  </div>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
      </template>
      <div v-if="suggestion.length === 0">
        <span class="text-gray-500">Empty</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-list-item) {
  @apply !pt-1.75 pb-0.75 !px-2;
}
</style>
