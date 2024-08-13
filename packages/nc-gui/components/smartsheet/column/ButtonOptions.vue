<script setup lang="ts">
import {
  type ButtonType,
  type ColumnType,
  FormulaError,
  type HookType,
  UITypes,
  isHiddenCol,
  jsepCurlyHook,
  substituteColumnIdWithAliasInFormula,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk'
import { type editor as MonacoEditor, languages, editor as monacoEditor } from 'monaco-editor'
import jsep from 'jsep'
import formulaLanguage from '../../monaco/formula'
import { searchIcons } from '../../../utils/iconUtils'
import { isCursorInsideString } from '../../../utils/formulaUtils'
import PlaceholderContentWidget from '../../monaco/Placeholder'

const props = defineProps<{
  value: any
  fromTableExplorer?: boolean
}>()

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const { isUIAllowed } = useRoles()

const { getMeta } = useMetas()

const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const { isEdit, setAdditionalValidations, validateInfos, sqlUi, column, isWebhookCreateModalOpen } = useColumnCreateStoreOrThrow()

const webhooksStore = useWebhooksStore()

const { loadHooksList } = webhooksStore

await loadHooksList()

const { hooks } = toRefs(webhooksStore)

const selectedWebhook = ref<HookType>()

const manualHooks = computed(() => {
  return hooks.value.filter((hook) => hook.event === 'manual' && hook.active)
})

const suggestionPreviewed = ref<Record<any, string> | undefined>()

const supportedColumns = computed(
  () =>
    meta?.value?.columns?.filter((col) => {
      if ([UITypes.QrCode, UITypes.Barcode, UITypes.Button].includes(col.uidt as UITypes)) {
        return false
      }

      if (isHiddenCol(col, meta.value)) {
        return false
      }

      return true
    }) || [],
)

const suggestionsList = computed(() => {
  const unsupportedFnList = sqlUi.value.getUnsupportedFnList()
  return (
    [
      ...formulaList.map((fn: string) => ({
        text: `${fn}()`,
        type: 'function',
        description: formulas[fn].description,
        syntax: formulas[fn].syntax,
        examples: formulas[fn].examples,
        docsUrl: formulas[fn].docsUrl,
        unsupported: unsupportedFnList.includes(fn),
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

const suggestionPreviewPostion = ref({
  top: '0px',
  left: '344px',
})

const buttonTypes = [
  {
    label: t('labels.openUrl'),
    value: 'url',
  },
  {
    label: t('labels.runWebHook'),
    value: 'webhook',
  },
]

const validators = {
  formula_raw: [
    {
      required: vModel.value.type === 'url',
      validator: (_: any, formula: any) => {
        return (async () => {
          if (vModel.value.type === 'url') {
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
          }
        })()
      },
    },
  ],
  fk_webhook_id: [
    {
      required: vModel.value.type === 'webhook',
      validator: (_: any, fk_webhook_id: any) => {
        return new Promise<void>((resolve, reject) => {
          if (vModel.value.type === 'webhook') {
            fk_webhook_id ? resolve() : reject(new Error(t('msg.required')))
          } else {
            resolve()
          }
        })
      },
    },
  ],
  color: [
    {
      validator: (_: any, color: any) => {
        return new Promise<void>((resolve, reject) => {
          ;['brand', 'red', 'green', 'maroon', 'blue', 'orange', 'pink', 'purple', 'yellow', 'gray'].includes(color)
            ? resolve()
            : reject(new Error(t('msg.invalidColor')))
          resolve()
        })
      },
    },
  ],
  theme: [
    {
      validator: (_: any, theme: any) => {
        return new Promise<void>((resolve, reject) => {
          ;['solid', 'light', 'text'].includes(theme) ? resolve() : reject(new Error(t('msg.invalidTheme')))
          resolve()
        })
      },
    },
  ],
  type: [
    {
      validator: (_: any, type: any) => {
        return new Promise<void>((resolve, reject) => {
          ;['url', 'webhook'].includes(type) ? resolve() : reject(new Error(t('msg.invalidType')))
          resolve()
        })
      },
    },
  ],
  label: [
    {
      validator: (_: any, label: any) => {
        return new Promise<void>((resolve, reject) => {
          label.length > 0 ? resolve() : !vModel.value.icon ? reject(new Error(t('msg.invalidLabel'))) : resolve()
          resolve()
        })
      },
    },
  ],
}

if (isEdit.value) {
  const colOptions = vModel.value.colOptions as ButtonType
  vModel.value.type = colOptions?.type
  vModel.value.theme = colOptions?.theme
  vModel.value.label = colOptions?.label
  vModel.value.color = colOptions?.color
  vModel.value.fk_webhook_id = colOptions?.fk_webhook_id
  vModel.value.icon = colOptions?.icon
  selectedWebhook.value = hooks.value.find((hook) => hook.id === vModel.value?.fk_webhook_id)
} else {
  vModel.value.type = buttonTypes[0].value
  vModel.value.theme = 'solid'
  vModel.value.label = 'Button'
  vModel.value.color = 'brand'
  vModel.value.formula_raw = ''
}

setAdditionalValidations({
  ...validators,
})

// set default value
if ((column.value?.colOptions as any)?.formula_raw) {
  vModel.value.formula_raw =
    substituteColumnIdWithAliasInFormula(
      (column.value?.colOptions as ButtonType)?.formula,
      meta?.value?.columns as ColumnType[],
      (column.value?.colOptions as any)?.formula_raw,
    ) || ''
}

const colorClass = {
  solid: {
    brand: 'bg-brand-500 text-white',
    red: 'bg-red-600 text-white',
    green: 'bg-green-600 text-white',
    maroon: 'bg-maroon-600 text-white',
    blue: 'bg-blue-600 text-white',
    orange: 'bg-orange-600 text-white',
    pink: 'bg-pink-600 text-white',
    purple: 'bg-purple-500 text-white',
    yellow: 'bg-yellow-600 text-white',
    gray: 'bg-gray-600 text-white',
  },
  light: {
    brand: 'bg-brand-200 text-gray-800',
    red: 'bg-red-200 text-gray-800',
    green: 'bg-green-200 text-gray-800',
    maroon: 'bg-maroon-200 text-gray-800',
    blue: 'bg-blue-200 text-gray-800',
    orange: 'bg-orange-200 text-gray-800',
    pink: 'bg-pink-200 text-gray-800',
    purple: 'bg-purple-200 text-gray-800',
    yellow: 'bg-yellow-200 text-gray-800',
    gray: 'bg-gray-200',
  },
  text: {
    brand: 'text-brand-500',
    red: 'text-red-600',
    green: 'text-green-600',
    maroon: 'text-maroon-600',
    blue: 'text-blue-600',
    orange: 'text-orange-600',
    pink: 'text-pink-600',
    purple: 'text-purple-500',
    yellow: 'text-yellow-600',
    gray: 'text-gray-600',
  },
}

const updateButtonTheme = (type: string, name: string) => {
  vModel.value.theme = type
  vModel.value.color = name
}

const monacoRoot = ref()

let editor: MonacoEditor.IStandaloneCodeEditor

const mountMonaco = () => {
  if (monacoRoot.value) {
    const model = monacoEditor.createModel(vModel.value.formula_raw, 'formula')

    languages.register({
      id: formulaLanguage.name,
    })

    monacoEditor.defineTheme(formulaLanguage.name, formulaLanguage.theme)

    languages.setMonarchTokensProvider(
      formulaLanguage.name,
      formulaLanguage.generateLanguageDefinition(supportedColumns.value.map((c) => c.title!)),
    )

    languages.setLanguageConfiguration(formulaLanguage.name, formulaLanguage.languageConfiguration)

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

    // eslint-disable-next-line no-new
    new PlaceholderContentWidget('CONCAT({URL-field})', editor)

    editor.onDidChangeModelContent(async () => {
      vModel.value.formula_raw = editor.getValue()
    })

    editor.onDidChangeCursorPosition(() => {
      const position = editor.getPosition()
      const model = editor.getModel()

      if (!position || !model) return

      const text = model.getValue()
      const offset = model.getOffsetAt(position)

      // IF cursor is inside string, don't show any suggestions
      if (isCursorInsideString(text, offset)) {
      }

      const findEnclosingFunction = (text: string, offset: number) => {
        const formulaRegex = /\b(?<!['"])(\w+)\s*\(/g // Regular expression to match function names
        const quoteRegex = /"/g // Regular expression to match quotes

        const functionStack = [] // Stack to keep track of functions
        let inQuote = false

        let match
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
}

useResizeObserver(monacoRoot, (entries) => {
  const entry = entries[0]
  const { height } = entry.contentRect
  editor.layout({
    width: 339,
    height,
  })
})

watch(
  () => vModel.value?.type,
  async (val) => {
    await nextTick(() => {
      mountMonaco()
    })
  },
)

const isDropdownOpen = ref(false)

const isWebHookSelectionDropdownOpen = ref(false)

const isButtonIconDropdownOpen = ref(false)

const iconSearchQuery = ref('')

const icons = computed(() => {
  return searchIcons(iconSearchQuery.value)
})

const eventList = ref<Record<string, any>[]>([
  { text: [t('general.manual'), t('general.trigger')], value: ['manual', 'trigger'] },
])

const isWebhookModal = ref(false)

const newWebhook = () => {
  selectedWebhook.value = undefined
  isWebhookModal.value = true
  isWebhookCreateModalOpen.value = true
}

const onClose = (hook: HookType) => {
  selectedWebhook.value = hook.id ? hook : undefined
  vModel.value.fk_webhook_id = hook.id
  isWebhookModal.value = false
  setTimeout(() => {
    isWebhookCreateModalOpen.value = false
  }, 500)
}

const onSelectWebhook = (hook: HookType) => {
  vModel.value.fk_webhook_id = hook.id
  selectedWebhook.value = hook
  isWebHookSelectionDropdownOpen.value = false
  isWebhookModal.value = false
}

const removeIcon = () => {
  vModel.value.icon = null
  isButtonIconDropdownOpen.value = false
}

const editWebhook = () => {
  if (selectedWebhook.value) {
    isWebhookCreateModalOpen.value = true
    isWebhookModal.value = true
  }
}

watch(isWebhookModal, (newVal) => {
  if (!newVal) {
    setTimeout(() => {
      isWebhookCreateModalOpen.value = false
    }, 500)
  }
})

const selectIcon = (icon: string) => {
  vModel.value.icon = icon
  isButtonIconDropdownOpen.value = false
}

onMounted(async () => {
  jsep.plugins.register(jsepCurlyHook)
  mountMonaco()

  until(() => monacoRoot.value as HTMLDivElement)
    .toBeTruthy()
    .then(() => {
      setTimeout(() => {
        const monacoDivPosition = monacoRoot.value?.getBoundingClientRect()
        if (!monacoDivPosition) return

        suggestionPreviewPostion.value.top = `${monacoDivPosition.top}px`

        if (props.fromTableExplorer?.value || monacoDivPosition.left > 352) {
          suggestionPreviewPostion.value.left = `${monacoDivPosition.left - 344}px`
        } else {
          suggestionPreviewPostion.value.left = `${monacoDivPosition.right + 8}px`
        }
      }, 250)
    })
})
</script>

<template>
  <div class="relative">
    <div
      v-if="
        suggestionPreviewed &&
        !suggestionPreviewed.unsupported &&
        suggestionPreviewed.type === 'function' &&
        vModel.type === 'url'
      "
      class="w-84 fixed bg-white z-10 pl-3 pt-3 border-1 shadow-md rounded-xl"
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
    <a-form-item v-bind="validateInfos.label" class="mt-4" :label="$t('general.label')">
      <a-input v-model:value="vModel.label" class="nc-column-name-input !rounded-lg" placeholder="Button" />
    </a-form-item>
    <a-row class="mt-4" :gutter="8">
      <a-col :span="12">
        <a-form-item :label="$t('general.style')" v-bind="validateInfos.theme">
          <NcDropdown v-model:visible="isDropdownOpen" class="nc-color-picker-dropdown-trigger">
            <template #overlay>
              <div class="bg-white space-y-2 p-2 rounded-lg">
                <div v-for="[type, colors] in Object.entries(colorClass)" :key="type" class="flex gap-2">
                  <div v-for="[name, color] in Object.entries(colors)" :key="name">
                    <button
                      :class="{
                        [color]: true,
                        '!border-transparent': type !== 'text',
                      }"
                      class="border-1 border-gray-200 flex items-center justify-center rounded h-6 w-6"
                      @click="updateButtonTheme(type, name)"
                    >
                      <component :is="iconMap.cellText" class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </template>

            <div
              :class="{
                '!border-brand-500 shadow-selected nc-button-style-dropdown ': isDropdownOpen,
              }"
              class="flex items-center justify-center border-1 h-8 px-[11px] border-gray-300 !w-full transition-all cursor-pointer !rounded-lg"
            >
              <div class="flex w-full items-center gap-2">
                <div class="flex gap-2 items-center w-full">
                  <div
                    :class="`${vModel.color ?? 'brand'} ${vModel.theme ?? 'solid'}`"
                    class="flex items-center justify-center nc-cell-button rounded-md h-6 w-6 gap-2"
                  >
                    <component :is="iconMap.cellText" class="w-4 h-4" />
                  </div>
                  <div class="flex items-center gap-1 text-gray-800">
                    <span class="capitalize">
                      {{ vModel.theme }}
                    </span>
                    <span class="capitalize">
                      {{ vModel.color === 'brand' ? $t('general.default') : vModel.color }}
                    </span>
                  </div>
                </div>
                <GeneralIcon icon="arrowDown" class="text-gray-700" />
              </div>
            </div>
          </NcDropdown>
        </a-form-item>
      </a-col>
      <a-col :span="12">
        <a-form-item :label="$t('labels.icon')" v-bind="validateInfos.icon">
          <NcDropdown v-model:visible="isButtonIconDropdownOpen" class="nc-color-picker-dropdown-trigger">
            <div
              :class="{
                '!border-brand-500 shadow-selected nc-button-style-dropdown ': isButtonIconDropdownOpen,
              }"
              class="flex items-center justify-center border-1 h-8 px-[11px] border-gray-300 !w-full transition-all cursor-pointer !rounded-lg"
            >
              <div class="flex w-full items-center justify-between gap-2">
                <GeneralIcon v-if="vModel.icon" :icon="vModel.icon as any" class="w-4 h-4" />
                <span v-else>
                  {{ $t('labels.selectIcon') }}
                </span>
                <GeneralIcon icon="arrowDown" class="text-gray-700" />
              </div>
            </div>
            <template #overlay>
              <div class="bg-white w-80 space-y-3 h-70 overflow-y-auto rounded-lg">
                <div class="!sticky top-0 flex gap-2 bg-white px-2 py-2">
                  <a-input
                    ref="inputRef"
                    v-model:value="iconSearchQuery"
                    :placeholder="$t('placeholder.searchIcons')"
                    class="nc-dropdown-search-unified-input z-10"
                  >
                    <template #prefix> <GeneralIcon icon="search" class="nc-search-icon h-3.5 w-3.5 mr-1" /> </template
                  ></a-input>
                  <NcButton size="small" class="!px-4" type="text" @click="removeIcon">
                    <span class="text-[13px]">
                      {{ $t('general.remove') }}
                    </span>
                  </NcButton>
                </div>

                <div class="grid px-3 auto-rows-max pb-2 nc-scrollbar-md gap-3 grid-cols-10">
                  <component
                    :is="icon"
                    v-for="({ icon, name }, i) in icons"
                    :key="i"
                    :icon="icon"
                    class="w-6 hover:bg-gray-100 cursor-pointer rounded p-1 text-gray-700 h-6"
                    @click="selectIcon(name)"
                  />
                </div>
              </div>
            </template>
          </NcDropdown>
        </a-form-item>
      </a-col>
    </a-row>
    <a-row class="mt-4" :gutter="8">
      <a-col :span="24">
        <a-form-item :label="$t('labels.onClick')" v-bind="validateInfos.type">
          <a-select
            v-model:value="vModel.type"
            class="w-52 nc-button-type-select"
            dropdown-class-name="nc-dropdown-button-cell-type"
          >
            <template #suffixIcon> <GeneralIcon icon="arrowDown" class="text-gray-700" /> </template>

            <a-select-option v-for="(type, i) of buttonTypes" :key="i" :value="type.value">
              <div class="flex gap-2 w-full capitalize truncate items-center">
                {{ type.label }}

                <component
                  :is="iconMap.check"
                  v-if="vModel.type === type.value"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                />
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
    </a-row>
    <a-form-item
      v-if="vModel?.type === 'url'"
      class="!mt-4"
      v-bind="validateInfos.formula_raw"
      :label="$t('labels.urlFormula')"
      required
    >
      <div
        ref="monacoRoot"
        :class="{
          '!border-red-500 formula-error': validateInfos.formula_raw?.validateStatus === 'error',
          '!focus-within:border-brand-500 formula-success': validateInfos.formula_raw?.validateStatus !== 'error',
        }"
        class="formula-monaco"
      ></div>
    </a-form-item>

    <a-form-item v-if="vModel?.type === 'webhook'" class="!mt-4">
      <div class="mb-2 text-gray-700 text-[13px] flex justify-between">
        {{ $t('labels.webhook') }}
        <a class="font-medium" href="https://docs.nocodb.com/automation/webhook/create-webhook/" target="_blank"> Docs </a>
      </div>
      <div class="flex rounded-lg nc-color-picker-dropdown-trigger">
        <NcDropdown v-model:visible="isWebHookSelectionDropdownOpen" :trigger="['click']">
          <template #overlay>
            <NcListWithSearch
              v-if="isWebHookSelectionDropdownOpen"
              :is-parent-open="isWebHookSelectionDropdownOpen"
              :search-input-placeholder="$t('placeholder.searchFields')"
              :option-config="{ selectOptionEvent: ['c:actions:webhook'], optionClassName: '' }"
              :options="manualHooks"
              disable-mascot
              class="max-h-72 max-w-85"
              filter-field="title"
              show-selected-option
              @selected="onSelectWebhook"
            >
              <template v-if="isUIAllowed('hookCreate')" #bottom>
                <a-divider style="margin: 4px 0" />
                <div class="flex items-center text-brand-500 text-sm cursor-pointer" @click="newWebhook">
                  <div class="w-full flex justify-between items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-100">
                    {{ $t('general.create') }} {{ $t('objects.webhook').toLowerCase() }}
                    <GeneralIcon icon="plus" class="flex-none" />
                  </div>
                </div>
              </template>
            </NcListWithSearch>
          </template>
          <div
            :class="{
              '!border-brand-500 shadow-selected remove-right-shadow nc-button-style-dropdown ': isWebHookSelectionDropdownOpen,
            }"
            class="nc-button-webhook-select border-r-0 flex items-center justify-center border-1 h-8 px-[8px] border-gray-300 !w-full transition-all cursor-pointer !rounded-l-lg"
          >
            <div class="flex w-full items-center gap-2">
              <div
                :key="selectedWebhook?.id"
                class="flex items-center overflow-x-clip truncate text-ellipsis w-full gap-1 text-gray-800"
              >
                <NcTooltip class="truncate max-w-full" show-on-truncate-only>
                  <template #title>
                    {{ !selectedWebhook?.title ? $t('labels.selectAWebhook') : selectedWebhook?.title }}
                  </template>
                  {{ !selectedWebhook?.title ? $t('labels.selectAWebhook') : selectedWebhook?.title }}
                </NcTooltip>
              </div>
              <GeneralIcon
                icon="arrowDown"
                :class="{
                  'transform rotate-180': isWebHookSelectionDropdownOpen,
                }"
                class="text-gray-700 transition-all transition-transform"
              />
            </div>
          </div>
        </NcDropdown>
        <NcButton
          size="small"
          type="secondary"
          class="!rounded-l-none border-l-[#d9d9d9] nc-button-style-dropdown"
          :class="{
            '!border-t-brand-500 !border-b-brand-500 remove-left-shadow !border-r-brand-500  !shadow-selected nc-button-style-dropdown':
              isWebHookSelectionDropdownOpen,
          }"
          @click="editWebhook"
        >
          <GeneralIcon
            :class="{
              'text-gray-400': !selectedWebhook,
              'text-gray-700': selectedWebhook,
            }"
            icon="ncEdit"
          />
        </NcButton>
      </div>
    </a-form-item>

    <Webhook
      v-if="isWebhookModal"
      v-model:value="isWebhookModal"
      :hook="selectedWebhook"
      :event-list="eventList"
      @close="onClose"
    />
  </div>
</template>

<style lang="scss">
.formula-placeholder {
  @apply !text-gray-500 !text-xs !font-medium;
  font-family: 'Manrope';
}
</style>

<style scoped lang="scss">
.nc-list-with-search {
  @apply w-full;
}
.remove-right-shadow {
  clip-path: inset(-2px 0px -2px -2px) !important;
}

.remove-left-shadow {
  clip-path: inset(-2px -2px -2px 0px) !important;
}
.formula-monaco {
  @apply rounded-md nc-scrollbar-md border-gray-200 border-1 overflow-y-auto overflow-x-hidden resize-y;
  min-height: 100px;
  height: 120px;
  max-height: 250px;

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
.mono-font {
  font-family: 'JetBrainsMono', monospace;
}

.nc-button-style-dropdown {
  @apply border-[#d9d9d9];
}

.nc-cell-button {
  &.solid {
    @apply text-white;

    &[class*='brand'] {
      @apply !bg-brand-500;
    }
    &[class*='red'] {
      @apply bg-red-600;
    }
    &[class*='green'] {
      @apply bg-green-600;
    }
    &[class*='maroon'] {
      @apply bg-maroon-600;
    }
    &[class*='blue'] {
      @apply bg-blue-600;
    }
    &[class*='orange'] {
      @apply bg-orange-600;
    }
    &[class*='pink'] {
      @apply bg-pink-600;
    }
    &[class*='purple'] {
      @apply bg-purple-500;
    }
    &[class*='yellow'] {
      @apply bg-yellow-600;
    }
    &[class*='gray'] {
      @apply bg-gray-600;
    }
  }

  &.light {
    @apply text-gray-700;

    &[class*='brand'] {
      @apply bg-brand-200;
    }
    &[class*='red'] {
      @apply bg-red-200;
    }
    &[class*='green'] {
      @apply bg-green-200;
    }
    &[class*='maroon'] {
      @apply bg-maroon-200;
    }
    &[class*='blue'] {
      @apply bg-blue-200;
    }
    &[class*='orange'] {
      @apply bg-orange-200;
    }
    &[class*='pink'] {
      @apply bg-pink-200;
    }
    &[class*='purple'] {
      @apply bg-purple-200;
    }
    &[class*='yellow'] {
      @apply bg-yellow-200;
    }
    &[class*='gray'] {
      @apply bg-gray-200;
    }
  }

  &.text {
    @apply border-1 border-gray-200 rounded;

    &[class*='brand'] {
      @apply text-brand-500;
    }
    &[class*='red'] {
      @apply text-red-600;
    }
    &[class*='green'] {
      @apply text-green-600;
    }
    &[class*='maroon'] {
      @apply text-maroon-600;
    }
    &[class*='blue'] {
      @apply text-blue-600;
    }
    &[class*='orange'] {
      @apply text-orange-600;
    }
    &[class*='pink'] {
      @apply text-pink-600;
    }
    &[class*='purple'] {
      @apply text-purple-500;
    }
    &[class*='yellow'] {
      @apply text-yellow-600;
    }
    &[class*='gray'] {
      @apply text-gray-600;
    }
  }
}
</style>
