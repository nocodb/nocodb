<script setup lang="ts">
import { UITypes, isHiddenCol, jsepCurlyHook } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { ListItem as AntListItem } from 'ant-design-vue/lib/list'
import { KeyCode, type editor as MonacoEditor, Position, Range, languages, editor as monacoEditor } from 'monaco-editor'
import jsep from 'jsep'
import formulaLanguage from '../../monaco/formula'
import { isCursorInsideString } from '../../../utils/formulaUtils'

interface Props {
  error?: boolean
  value: string
  label?: string
  editorHeight?: string
  suggestionHeight?: 'small' | 'medium' | 'large'
  disableSuggestionHeaders?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  suggestionHeight: 'large',
  disableSuggestionHeaders: false,
})

const emits = defineEmits(['update:value'])

const { error, suggestionHeight, editorHeight } = toRefs(props)

const value = useVModel(props, 'value', emits)

const { $e } = useNuxtApp()

const uiTypesNotSupportedInFormulas = [UITypes.QrCode, UITypes.Barcode, UITypes.Button]

const { sqlUi, column, fromTableExplorer, validateInfos } = useColumnCreateStoreOrThrow()

const { isAiModeFieldModal } = usePredictFields()

const { isFeatureEnabled } = useBetaFeatureToggle()

const meta = inject(MetaInj, ref())

const supportedColumns = computed(
  () =>
    meta?.value?.columns?.filter((col) => {
      if (uiTypesNotSupportedInFormulas.includes(col.uidt as UITypes)) {
        return false
      }

      if (isHiddenCol(col, meta.value)) {
        return false
      }

      return true
    }) || [],
)

const suggestionPreviewed = ref<Record<any, string> | undefined>()

// If -1 Show Fields first, if 1 show Formulas first
const priority = ref(0)

const showFunctionList = ref<boolean>(true)

const availableFunctions = formulaList

const availableBinOps = ['+', '-', '*', '/', '>', '<', '==', '<=', '>=', '!=', '&']

const autocomplete = ref(false)

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
  return (
    [
      ...availableFunctions.map((fn: string) => ({
        text: `${fn}()`,
        type: 'function',
        description: formulas[fn].description,
        syntax: formulas[fn].syntax,
        examples: formulas[fn].examples,
        docsUrl: formulas[fn].docsUrl,
        unsupported: unsupportedFnList.includes(fn),
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
          icon: getUIDTIcon(c.uidt) ? markRaw(getUIDTIcon(c.uidt)!) : undefined,
          uidt: c.uidt,
        })),
      ...availableBinOps.map((op: string) => ({
        text: op,
        type: 'op',
      })),
    ]
      // move unsupported functions to the end
      .sort((a: Record<string, any>, b: Record<string, any>) => {
        if (a.unsupported && !b.unsupported) {
          return 1
        }
        if (!a.unsupported && b.unsupported) {
          return -1
        }
        return 0
      })
  )
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

const monacoRoot = ref<HTMLDivElement>()
let editor: MonacoEditor.IStandaloneCodeEditor

function getCurrentKeyword() {
  const model = editor.getModel()
  const position = editor.getPosition()
  if (!model || !position) {
    return null
  }

  const word = model.getWordAtPosition(position)

  return word?.word
}

const handleInputDeb = useDebounceFn(function () {
  handleInput()
}, 250)

onMounted(async () => {
  if (monacoRoot.value) {
    const model = monacoEditor.createModel(value.value, 'formula')

    languages.register({
      id: formulaLanguage.name,
    })

    monacoEditor.defineTheme(formulaLanguage.name, formulaLanguage.theme)

    languages.setMonarchTokensProvider(
      formulaLanguage.name,
      // replace @ with \x01 to avoid conflict with monaco's tokenizer
      formulaLanguage.generateLanguageDefinition(supportedColumns.value.map((c) => c.title!.replace(/@/g, '\x01'))),
    )

    languages.setLanguageConfiguration(formulaLanguage.name, formulaLanguage.languageConfiguration)

    monacoEditor.addKeybindingRules([
      {
        keybinding: KeyCode.DownArrow,
        when: 'editorTextFocus',
      },
      {
        keybinding: KeyCode.UpArrow,
        when: 'editorTextFocus',
      },
    ])

    editor = monacoEditor.create(monacoRoot.value, {
      model,
      'contextmenu': false,
      'theme': 'formula',
      'selectOnLineNumbers': false,
      'language': 'formula',
      'roundedSelection': false,
      'scrollBeyondLastLine': false,
      'lineNumbers': 'off',
      'glyphMargin': false,
      'folding': false,
      'wordWrap': 'on',
      'wrappingStrategy': 'advanced',
      // This seems to be a bug in the monoco.
      // https://github.com/microsoft/monaco-editor/issues/4535#issuecomment-2234042290
      'bracketPairColorization.enabled': false,
      'padding': {
        top: 8,
        bottom: 8,
      },
      'lineDecorationsWidth': 8,
      'lineNumbersMinChars': 0,
      'renderLineHighlight': 'none',
      'renderIndentGuides': false,
      'scrollbar': {
        horizontal: 'hidden',
      },
      'tabSize': 2,
      'automaticLayout': false,
      'overviewRulerLanes': 0,
      'hideCursorInOverviewRuler': true,
      'overviewRulerBorder': false,
      'matchBrackets': 'never',
      'minimap': {
        enabled: false,
      },
    })

    editor.layout({
      width: 339,
      height: 120,
    })

    editor.onDidChangeModelContent(async () => {
      value.value = editor.getValue()
      await handleInputDeb()
    })

    editor.onDidChangeCursorPosition(() => {
      const position = editor.getPosition()
      const model = editor.getModel()

      if (!position || !model) return

      const text = model.getValue()
      const offset = model.getOffsetAt(position)

      // IF cursor is inside string, don't show any suggestions
      if (isCursorInsideString(text, offset)) {
        autocomplete.value = false
        suggestion.value = []
      } else {
        handleInput()
      }

      const findEnclosingFunction = (text: string, offset: number) => {
        const formulaRegex = /\b(?<!['"])(\w+)\s*\(/g // Regular expression to match function names
        const quoteRegex = /"/g // Regular expression to match quotes

        const functionStack = [] // Stack to keep track of functions
        let inQuote = false

        let match
        // eslint-disable-next-line no-cond-assign
        while ((match = formulaRegex.exec(text)) !== null) {
          if (match.index > offset) break

          if (!inQuote) {
            const functionData = {
              name: match[1],
              start: match.index,
              end: formulaRegex.lastIndex,
            }

            let parenBalance = 1
            let childValueStart = -1
            let childValueEnd = -1
            for (let i = formulaRegex.lastIndex; i < text.length; i++) {
              if (text[i] === '(') {
                parenBalance++
              } else if (text[i] === ')') {
                parenBalance--
                if (parenBalance === 0) {
                  functionData.end = i + 1
                  break
                }
              }

              // Child value handling
              if (childValueStart === -1 && ['(', ',', '{'].includes(text[i])) {
                childValueStart = i
              } else if (childValueStart !== -1 && ['(', ',', '{'].includes(text[i])) {
                childValueStart = i
              } else if (childValueStart !== -1 && ['}', ',', ')'].includes(text[i])) {
                childValueEnd = i
                childValueStart = -1
              }

              if (i >= offset) {
                // If we've reached the offset and parentheses are still open, consider the current position as the end of the function
                if (parenBalance > 0) {
                  functionData.end = i + 1
                  break
                }

                // Check for nested functions
                const nestedFunction = findEnclosingFunction(
                  text.substring(functionData.start + match[1].length + 1, i),
                  offset - functionData.start - match[1].length - 1,
                )
                if (nestedFunction) {
                  return nestedFunction
                } else {
                  functionStack.push(functionData)
                  break
                }
              }
            }

            // If child value ended before offset, use child value end as function end
            if (childValueEnd !== -1 && childValueEnd < offset) {
              functionData.end = childValueEnd + 1
            }

            functionStack.push(functionData)
          }

          // Check for quotes
          let quoteMatch
          // eslint-disable-next-line no-cond-assign
          while ((quoteMatch = quoteRegex.exec(text)) !== null && quoteMatch.index < match.index) {
            inQuote = !inQuote
          }
        }

        const enclosingFunctions = functionStack.filter((func) => func.start <= offset && func.end >= offset)
        return enclosingFunctions.length > 0 ? enclosingFunctions[enclosingFunctions.length - 1].name : null
      }
      const lastFunction = findEnclosingFunction(text, offset)

      suggestionPreviewed.value =
        (suggestionsList.value.find((s) => s.text === `${lastFunction}()`) as Record<any, string>) || undefined
    })
    editor.focus()
  }
})

useResizeObserver(monacoRoot, (entries) => {
  const entry = entries[0]
  const { height } = entry.contentRect
  editor.layout({
    width: 339,
    height,
  })
})

function insertStringAtPosition(editor: MonacoEditor.IStandaloneCodeEditor, text: string, skipCursorMove = false) {
  const position = editor.getPosition()

  if (!position) {
    return
  }
  const range = new Range(position.lineNumber, position.column, position.lineNumber, position.column)

  editor.executeEdits('', [
    {
      range,
      text,
      forceMoveMarkers: true,
    },
  ])

  // Move the cursor to the end of the inserted text
  if (!skipCursorMove) {
    const newPosition = new Position(position.lineNumber, position.column + text.length - 1)
    editor.setPosition(newPosition)
  }

  editor.focus()
}

function appendText(item: Record<string, any>) {
  const len = wordToComplete.value?.length || 0

  if (!item?.text) return
  const text = item.text

  const position = editor.getPosition()

  if (!position) {
    return // No cursor position available
  }

  const newColumn = Math.max(1, position.column - len)

  const range = new Range(position.lineNumber, newColumn, position.lineNumber, position.column)

  editor.executeEdits('', [
    {
      range,
      text: '',
      forceMoveMarkers: true,
    },
  ])

  if (item.type === 'function') {
    insertStringAtPosition(editor, text)
  } else if (item.type === 'column') {
    insertStringAtPosition(editor, `{${text}}`, true)
  } else {
    insertStringAtPosition(editor, text, true)
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

function isCursorBetweenParenthesis() {
  const cursorPosition = editor?.getPosition()

  if (!cursorPosition || !editor) return false

  const line = editor.getModel()?.getLineContent(cursorPosition.lineNumber)

  if (!line) {
    return false
  }

  const cursorLine = line.substring(0, cursorPosition.column - 1)

  const openParenthesis = (cursorLine.match(/\(/g) || []).length

  const closeParenthesis = (cursorLine.match(/\)/g) || []).length

  return openParenthesis > closeParenthesis
}

function handleInput() {
  if (!editor) return

  const model = editor.getModel()
  const position = editor.getPosition()

  if (!model || !position) return

  const text = model.getValue()
  const offset = model.getOffsetAt(position)

  if (text.length === 0) {
    // clear error if formula is empty
    if (validateInfos.formula_raw.validateStatus === 'error') {
      validateInfos.formula_raw.validateStatus = 'success'
      validateInfos.formula_raw.help = []
    }
  }

  // IF cursor is inside string, don't show any suggestions
  if (isCursorInsideString(text, offset)) {
    autocomplete.value = false
    suggestion.value = []
    return
  }

  if (!isCursorBetweenParenthesis()) priority.value = 1

  selected.value = 0
  suggestion.value = []
  const query = getCurrentKeyword() ?? ''
  const parts = query.split(/\W+/)
  wordToComplete.value = parts.pop() || ''
  suggestion.value = acTree.value
    .complete(wordToComplete.value)
    ?.sort((x: Record<string, any>, y: Record<string, any>) => sortOrder[x.type] - sortOrder[y.type])

  if (isCursorBetweenParenthesis()) {
    // Show columns at top
    suggestion.value = suggestion.value.sort((a, b) => {
      if (a.type === 'column') return -1
      if (b.type === 'column') return 1
      return 0
    })
    selected.value = 0
    priority.value = -1
  } else if (!showFunctionList.value) {
    showFunctionList.value = true
  }

  autocomplete.value = !!suggestion.value.length
}

function selectText() {
  if (suggestion.value && selected.value > -1 && selected.value < suggestionsList.value.length) {
    if (selected.value < suggestedFormulas.value.length) {
      if (suggestedFormulas.value[selected.value].unsupported) return
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

const suggestionPreviewPostion = ref({
  top: '0px',
  left: '344px',
})

onMounted(() => {
  jsep.plugins.register(jsepCurlyHook)

  until(() => monacoRoot.value as HTMLDivElement)
    .toBeTruthy()
    .then(() => {
      setTimeout(() => {
        const monacoDivPosition = monacoRoot.value?.getBoundingClientRect()
        if (!monacoDivPosition) return

        suggestionPreviewPostion.value.top = `${monacoDivPosition.top - 75}px`

        if (fromTableExplorer?.value || monacoDivPosition.left > 352) {
          suggestionPreviewPostion.value.left = `${monacoDivPosition.left - 344}px`
        } else {
          suggestionPreviewPostion.value.left = `${monacoDivPosition.right + 8}px`
        }
      }, 250)
    })
})

const handleKeydown = (e: KeyboardEvent) => {
  e.stopPropagation()
  switch (e.key) {
    case 'ArrowUp': {
      e.preventDefault()
      suggestionListUp()
      break
    }
    case 'ArrowDown': {
      e.preventDefault()
      suggestionListDown()
      break
    }
    case 'Enter': {
      e.preventDefault()
      selectText()
      break
    }
  }
}

const { aiIntegrationAvailable, aiLoading, predictFormula, repairFormula } = useNocoAi()

enum AI_MODE {
  NONE = 'none',
  PROMPT = 'prompt',
}

const aiMode = ref<AI_MODE>(AI_MODE.NONE)

const aiPrompt = ref('')

const oldAiPrompt = ref('')

const calledFun = ref<null | string>(null)

const promptAI = async () => {
  if (!aiPrompt.value?.trim()) return

  calledFun.value = 'promptAI'

  $e(`a:column:ai:formula:predict-from-prompt`, {
    prompt: aiPrompt.value,
  })

  const formula = await predictFormula(aiPrompt.value, value.value)

  if (formula) {
    editor.setValue(formula)
    oldAiPrompt.value = aiPrompt.value
  }
}

const repairFormulaAI = async () => {
  calledFun.value = 'repairFormulaAI'

  $e(`a:column:ai:formula:repair`)

  const formula = await repairFormula(value.value, validateInfos?.formula_raw?.help.join(' | '))

  if (formula) {
    editor.setValue(formula)
  }
}

const enableAI = async () => {
  $e(`c:column:ai:formula:enable`)

  if (validateInfos?.formula_raw?.validateStatus === 'error') {
    await repairFormulaAI()
  } else {
    aiMode.value = AI_MODE.PROMPT
  }
}
</script>

<template>
  <div
    v-if="suggestionPreviewed && !suggestionPreviewed.unsupported && suggestionPreviewed.type === 'function'"
    class="w-84 fixed bg-white z-11 pl-3 pt-3 border-1 shadow-md rounded-xl"
    :style="{
      left: suggestionPreviewPostion.left,
      top: suggestionPreviewPostion.top,
    }"
  >
    <div class="pr-3">
      <div class="flex flex-row w-full justify-between pb-2 border-b-1">
        <div class="flex items-center gap-x-1 font-semibold text-lg text-gray-600">
          <component :is="iconMap.function" class="text-lg" />
          {{ suggestionPreviewed.text }}
        </div>
        <NcButton type="text" size="small" class="!h-7 !w-7 !min-w-0" @click="suggestionPreviewed = undefined">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>
    </div>
    <div class="flex flex-col max-h-120 nc-scrollbar-thin pr-2">
      <div class="flex mt-3 text-[13px] leading-6">{{ suggestionPreviewed.description }}</div>

      <div class="text-gray-500 uppercase text-[11px] mt-3 mb-2">Syntax</div>
      <div class="bg-white rounded-md py-1 text-[13px] mono-font leading-6 px-2 border-1">{{ suggestionPreviewed.syntax }}</div>
      <div class="text-gray-500 uppercase text-[11px] mt-3 mb-2">Examples</div>
      <div
        v-for="(example, index) of suggestionPreviewed.examples"
        :key="example"
        class="bg-gray-100 mono-font text-[13px] leading-6 py-1 px-2"
        :class="{
          'border-t-1  border-gray-200': index !== 0,
          'rounded-b-md': index === suggestionPreviewed.examples.length - 1 && suggestionPreviewed.examples.length !== 1,
          'rounded-t-md': index === 0 && suggestionPreviewed.examples.length !== 1,
          'rounded-md': suggestionPreviewed.examples.length === 1,
        }"
      >
        {{ example }}
      </div>
    </div>
    <div class="flex flex-row mt-3 mb-3 justify-end pr-3">
      <a v-if="suggestionPreviewed.docsUrl" target="_blank" rel="noopener noreferrer" :href="suggestionPreviewed.docsUrl">
        <NcButton type="text" size="small" class="!text-gray-400 !hover:text-gray-700 !text-xs"
          >View in Docs
          <GeneralIcon icon="openInNew" class="ml-1" />
        </NcButton>
      </a>
    </div>
  </div>

  <a-form-item :label="label" required v-bind="validateInfos.formula_raw">
    <div
      ref="monacoRoot"
      :style="{
        height: editorHeight ?? '100px',
      }"
      :class="{
        '!border-red-500 formula-error': error,
        '!focus-within:border-brand-500 shadow-default hover:shadow-hover formula-success': !error,
        'bg-white': isAiModeFieldModal,
      }"
      class="formula-monaco transition-colors duration-300"
      @keydown.stop="handleKeydown"
    ></div>
  </a-form-item>
  <template v-if="isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)">
    <div v-if="aiMode === AI_MODE.NONE" class="w-full flex justify-end mt-2">
      <NcButton size="small" type="text" :loading="aiLoading" @click="enableAI">
        <template #icon>
          <GeneralIcon icon="ncAutoAwesome" class="text-nc-content-purple-medium h-4 w-4" />
        </template>
        <template #loadingIcon>
          <GeneralLoader class="!text-nc-content-purple-medium" size="regular" />
        </template>
        <div class="flex gap-2 items-center">
          <span v-if="validateInfos?.formula_raw?.validateStatus === 'error'" class="text-[13px] font-semibold">Fix Formula</span>
          <span v-else class="text-[13px] font-semibold">Formula Helper</span>
        </div>
      </NcButton>
    </div>
    <template v-else-if="aiMode === AI_MODE.PROMPT">
      <AiIntegrationNotFound v-if="!aiIntegrationAvailable" class="mt-4" />
      <div v-else class="prompt-wrapper">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="9" viewBox="0 0 18 9" fill="none" class="nc-polygon-2">
          <path d="M1.51476 8.5L9 0.721111L16.4852 8.5H1.51476Z" fill="white" stroke="#e5d4f5" />
        </svg>
        <div class="prompt-input-wrapper w-full flex">
          <div class="nc-triangle-bottom-bar"></div>

          <div class="flex items-center gap-2 pl-3 pr-1 py-1">
            <div class="flex-1 text-small leading-[18px] font-bold text-nc-content-gray-subtle2">Prompt</div>
            <div class="flex items-center gap-2">
              <NcButton
                v-if="validateInfos?.formula_raw?.validateStatus === 'error'"
                type="secondary"
                size="xs"
                theme="ai"
                :bordered="false"
                class="nc-formula-helper-ai-btn !px-2"
                :disabled="aiLoading && calledFun === 'repairFormulaAI'"
                :loading="aiLoading && calledFun === 'repairFormulaAI'"
                @click="repairFormulaAI"
              >
                <template #icon>
                  <GeneralIcon icon="ncAutoAwesome" class="!text-current h-4 w-4" />
                </template>
                <template #loadingIcon>
                  <GeneralLoader class="!text-current" size="regular" />
                </template>
                <div class="flex items-center gap-1">
                  <span class="text-[13px] font-semibold text-purple-400">Repair</span>
                </div>
              </NcButton>
              <NcButton
                type="secondary"
                size="xs"
                theme="ai"
                :bordered="false"
                class="nc-formula-helper-ai-btn !px-2"
                :loading="aiLoading && calledFun === 'promptAI'"
                :disabled="
                  !aiPrompt?.trim() ||
                  (!!aiPrompt.trim() && aiPrompt.trim() === oldAiPrompt.trim()) ||
                  (aiLoading && calledFun === 'promptAI')
                "
                @click="promptAI"
              >
                <template #icon>
                  <GeneralIcon icon="ncAutoAwesome" class="!text-current h-4 w-4" />
                </template>
                <template #loadingIcon>
                  <GeneralLoader class="!text-current" size="regular" />
                </template>
                <div class="flex items-center gap-1">Generate</div>
              </NcButton>
            </div>
          </div>
          <a-textarea
            v-model:value="aiPrompt"
            class="nc-ai-formula-helper-input nc-input-shadow nc-ai-input nc-scrollbar-thin !min-h-[80px]"
            :placeholder="`Enter prompt to ${value ? 'modify' : 'generate'} formula`"
          ></a-textarea>
        </div>
      </div>
    </template>
  </template>

  <div
    :class="{
      'h-[250px]': suggestionHeight === 'large',
      'h-[150px]': suggestionHeight === 'medium',
      'h-[125px]': suggestionHeight === 'small',
      'bg-white': isAiModeFieldModal,
    }"
    class="overflow-auto flex flex-col nc-suggestion-list nc-scrollbar-thin border-1 border-gray-200 rounded-lg mt-4"
  >
    <div v-if="suggestedFormulas && showFunctionList" :style="{ order: priority === -1 ? 2 : 1 }">
      <div
        v-if="!disableSuggestionHeaders"
        class="border-b-1 bg-gray-50 px-3 py-1 uppercase text-gray-600 text-xs font-semibold sticky top-0 z-10"
      >
        Formulas
      </div>

      <a-list :data-source="suggestedFormulas" :locale="{ emptyText: $t('msg.formula.noSuggestedFormulaFound') }">
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
              'cursor-not-allowed': item.unsupported,
            }"
            @click.prevent.stop="!item.unsupported && appendText(item)"
            @mouseenter="suggestionPreviewed = item"
          >
            <a-list-item-meta>
              <template #title>
                <div class="flex items-center gap-x-1" :class="{ 'text-gray-400': item.unsupported }">
                  <component :is="iconMap.function" v-if="item.type === 'function'" class="w-4 h-4 !text-gray-600" />

                  <component :is="iconMap.calculator" v-if="item.type === 'op'" class="w-4 h-4 !text-gray-600" />

                  <component :is="item.icon" v-if="item.type === 'column'" class="w-4 h-4 !text-gray-600" />
                  <span class="text-small leading-[18px]" :class="{ 'text-gray-800': !item.unsupported }">{{ item.text }}</span>
                </div>
                <div v-if="item.unsupported" class="ml-5 text-gray-400 text-xs">{{ $t('msg.formulaNotSupported') }}</div>
              </template>
            </a-list-item-meta>
          </a-list-item>
        </template>
      </a-list>
    </div>

    <div v-if="variableList" :style="{ order: priority === 1 ? 2 : 1 }">
      <div
        v-if="!disableSuggestionHeaders"
        class="border-b-1 bg-gray-50 px-3 py-1 uppercase text-gray-600 text-xs font-semibold sticky top-0 z-10"
      >
        Fields
      </div>

      <a-list
        ref="variableListRef"
        :data-source="variableList"
        :locale="{ emptyText: $t('msg.formula.noSuggestedFieldFound') }"
        class="!overflow-hidden"
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
            <a-list-item-meta class="nc-variable-list-item">
              <template #title>
                <div class="flex items-center gap-x-1 justify-between">
                  <div class="flex items-center gap-x-1 rounded-md px-1 h-5">
                    <component :is="item.icon" class="w-4 h-4 !text-gray-600" />

                    <span class="text-small leading-[18px] text-gray-800 font-weight-500">{{ item.text }}</span>
                  </div>

                  <NcButton size="small" type="text" class="nc-variable-list-item-use-field-btn !h-7 px-3 !text-small invisible">
                    {{ $t('general.use') }} {{ $t('objects.field').toLowerCase() }}
                  </NcButton>
                </div>
              </template>
            </a-list-item-meta>
          </a-list-item>
        </template>
      </a-list>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-suggestion-list {
  @apply resize-y max-h-[300px] min-h-[50px];
}

:deep(.ant-list-item) {
  @apply !py-0 !px-2;

  &:not(:has(.nc-variable-list-item)) {
    @apply !py-[7px] !px-2;
  }
  .nc-variable-list-item {
    @apply min-h-8 flex items-center;
  }
  .ant-list-item-meta-title {
    @apply m-0;
  }
  &.ant-list-item,
  &.ant-list-item:last-child {
    @apply !border-b-1 border-gray-200 border-solid;
  }
  &:hover .nc-variable-list-item-use-field-btn {
    @apply visible;
  }
}

.formula-monaco {
  @apply rounded-md nc-scrollbar-md border-gray-200 border-1 overflow-y-auto overflow-x-hidden resize-y;
  max-height: 250px;
  min-height: 50px;

  &:focus-within:not(.formula-error) {
    box-shadow: 0 0 0 2px var(--ant-primary-color-outline);
  }

  &:focus-within:not(.formula-success) {
    box-shadow: 0 0 0 2px var(--ant-error-color-outline);
  }
  .view-line {
    width: auto !important;
  }
}
.prompt-wrapper {
  @apply relative mt-2.5;

  .nc-polygon-2 {
    @apply absolute -top-[8px] left-[50%] transform -translate-x-1/2 z-0;
  }

  .nc-triangle-bottom-bar {
    @apply absolute -top-[8px] left-[50%] transform -translate-x-1/2 w-3.5 h-2 bg-transparent border-2 border-transparent !border-b-nc-bg-gray-extralight;
  }

  .prompt-input-wrapper {
    @apply relative inline-block transition-all duration-300 shadow-default border-1 rounded-lg bg-nc-bg-gray-extralight border-purple-100 z-10;

    .nc-ai-formula-helper-input {
      @apply rounded-b-lg !border-purple-100 !-m-[1px] !max-w-[calc(100%_+_2px)] !w-[calc(100%_+_2px)] !shadow-none;

      &:focus {
        @apply rounded-lg !border-nc-border-purple !shadow-selected-ai;
      }
    }
  }
}
</style>

<style lang="scss">
.formula-placeholder {
  @apply !text-gray-500 !text-xs !font-medium;
  font-family: 'Manrope';
}
</style>
