<script setup lang="ts">
import {
  type ButtonType,
  type ColumnType,
  FormulaError,
  UITypes,
  isHiddenCol,
  jsepCurlyHook,
  substituteColumnIdWithAliasInFormula,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk'
import { type editor as MonacoEditor, languages, editor as monacoEditor } from 'monaco-editor'
import jsep from 'jsep'
import formulaLanguage from '../../monaco/formula'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const { getMeta } = useMetas()

const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const { isEdit, setAdditionalValidations, validateInfos, sqlUi, column, removeAdditionalValidation } =
  useColumnCreateStoreOrThrow()

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

const validators = {
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
          label.length > 0 ? resolve() : reject(new Error(t('msg.invalidLabel')))
          resolve()
        })
      },
    },
  ],
}

setAdditionalValidations({
  ...validators,
})

// set default value
if ((column.value?.colOptions as any)?.formula_raw) {
  console.log(column.value?.colOptions)
  vModel.value.formula_raw =
    substituteColumnIdWithAliasInFormula(
      (column.value?.colOptions as ButtonType)?.formula,
      meta?.value?.columns as ColumnType[],
      (column.value?.colOptions as any)?.formula_raw,
    ) || ''
}

const updateValidations = (type: 'webhook' | 'url') => {
  if (type === 'url') {
    setAdditionalValidations({
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
    })
  } else if (type === 'webhook') {
    removeAdditionalValidation('formula_raw')
  }
}

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

    editor.onDidChangeModelContent(async () => {
      console.log(editor.getValue())
      vModel.value.formula_raw = editor.getValue()
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
    updateValidations(val)
    await nextTick(() => {
      mountMonaco()
    })
  },
)

const isDropdownOpen = ref(false)

onMounted(async () => {
  jsep.plugins.register(jsepCurlyHook)

  if (isEdit.value) {
    const colOptions = vModel.value.colOptions as any
    vModel.value.type = colOptions?.type
    vModel.value.theme = colOptions?.theme
    vModel.value.label = colOptions?.label
    vModel.value.color = colOptions?.color
    updateValidations(colOptions?.type)
  } else {
    vModel.value.type = buttonTypes[0].value
    vModel.value.theme = 'solid'
    vModel.value.label = 'Button'
    vModel.value.color = 'brand'
    updateValidations('url')
  }
  await nextTick(() => {
    mountMonaco()
  })
})
</script>

<template>
  <a-row :gutter="8">
    <a-col :span="12">
      <a-form-item v-bind="validateInfos.label" :label="$t('general.label')">
        <a-input v-model:value="vModel.label" class="nc-column-name-input !rounded-lg" placeholder="Button" />
      </a-form-item>
    </a-col>
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
            class="nc-button-style-dropdown-not-focus flex items-center justify-center border-1 h-8 px-[11px] border-gray-300 !w-full transition-all cursor-pointer !rounded-lg"
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
                    {{ vModel.color }}
                  </span>
                </div>
              </div>
              <GeneralIcon icon="arrowDown" class="text-gray-700" />
            </div>
          </div>
        </NcDropdown>
      </a-form-item>
    </a-col>
  </a-row>
  <a-row :gutter="8">
    <a-col :span="24">
      <a-form-item :label="$t('labels.onClick')" v-bind="validateInfos.type">
        <a-select v-model:value="vModel.type" class="w-52" dropdown-class-name="nc-dropdown-button-cell-type">
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
  <a-form-item v-if="vModel?.type === 'url'" class="mt-4" v-bind="validateInfos.formula_raw" required>
    <div
      ref="monacoRoot"
      :class="{
        '!border-red-500 formula-error': validateInfos.formula_raw?.validateStatus === 'error',
        '!focus-within:border-brand-500 formula-success': validateInfos.formula_raw?.validateStatus !== 'error',
      }"
      class="formula-monaco"
    ></div>
  </a-form-item>
</template>

<style scoped lang="scss">
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
  width: 100%;
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
    @apply text-gray-800;

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
