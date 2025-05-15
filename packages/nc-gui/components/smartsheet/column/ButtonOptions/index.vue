<script setup lang="ts">
import type { ButtonType, ColumnType, HookType, ScriptType } from 'nocodb-sdk'
import {
  ButtonActionsType,
  FormulaError,
  UITypes,
  isHiddenCol,
  substituteColumnIdWithAliasInFormula,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk'
import { searchIcons } from '~/utils/iconUtils'

const props = defineProps<{
  value: any
  fromTableExplorer?: boolean
}>()

const emit = defineEmits(['update:value'])

const buttonActionsType = {
  ...ButtonActionsType,
}

const { t } = useI18n()

const { getMeta } = useMetas()

const { isFeatureEnabled } = useBetaFeatureToggle()

const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const { isEdit, setAdditionalValidations, validateInfos, sqlUi, column, isAiMode } = useColumnCreateStoreOrThrow()

const uiTypesNotSupportedInFormulas = [UITypes.QrCode, UITypes.Barcode, UITypes.Button]

const webhooksStore = useWebhooksStore()

const { loadHooksList } = webhooksStore

const { hooks } = toRefs(webhooksStore)

const automationStore = useAutomationStore()

const { loadAutomations } = automationStore

const bases = useBases()

const { openedProject } = storeToRefs(bases)

await Promise.all([loadHooksList(), loadAutomations({ baseId: openedProject.value!.id, force: true })])

const { activeBaseAutomations } = toRefs(automationStore)

const selectedWebhook = ref<HookType>()

const selectedScript = ref<ScriptType>()

const isAiButtonEnabled = computed(() => {
  if (isEdit.value) {
    return true
  }

  return isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)
})

const isScriptButtonEnabled = computed(() => {
  if (isEdit.value) {
    return true
  }

  return isFeatureEnabled(FEATURE_FLAG.NOCODB_SCRIPTS)
})

const buttonTypes = computed(() => [
  {
    label: t('labels.openUrl'),
    value: ButtonActionsType.Url,
  },
  {
    label: t('labels.runWebHook'),
    value: ButtonActionsType.Webhook,
  },
  ...(isAiButtonEnabled.value
    ? [
        {
          label: t('labels.generateFieldDataUsingAi'),
          value: ButtonActionsType.Ai,
          tooltip: t('tooltip.generateFieldDataUsingAiButtonOption'),
        },
      ]
    : []),
  ...(isEeUI && isScriptButtonEnabled.value
    ? [
        {
          label: t('labels.runScript'),
          value: ButtonActionsType.Script,
        },
      ]
    : []),
])

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

const validators = {
  formula_raw: [
    {
      required: [ButtonActionsType.Url, ButtonActionsType.Ai].includes(vModel.value.type),
      validator: (_: any, formula: any) => {
        return (async () => {
          if (vModel.value.type === ButtonActionsType.Url) {
            if (!formula?.trim()) throw new Error('Formula is required for URL Button')

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
          } else if (vModel.value.type === ButtonActionsType.Ai) {
            if (!formula?.trim()) throw new Error('Prompt required for AI Button')
          }
        })()
      },
    },
  ],
  fk_webhook_id: [
    {
      required: vModel.value.type === ButtonActionsType.Webhook,
      validator: (_: any, fk_webhook_id: any) => {
        return new Promise<void>((resolve, reject) => {
          if (vModel.value.type === ButtonActionsType.Webhook && !fk_webhook_id) {
            reject(new Error(t('general.required')))
          }
          resolve()
        })
      },
    },
  ],
  fk_script_id: [
    {
      required: vModel.value.type === ButtonActionsType.Script,
      validator: (_: any, fk_script_id: any) => {
        return new Promise<void>((resolve, reject) => {
          if (vModel.value.type === ButtonActionsType.Script && !fk_script_id) {
            reject(new Error(t('general.required')))
          }
          resolve()
        })
      },
    },
  ],
  color: [
    {
      validator: (_: any, color: any) => {
        return new Promise<void>((resolve, reject) => {
          if (!['brand', 'red', 'green', 'maroon', 'blue', 'orange', 'pink', 'purple', 'yellow', 'gray'].includes(color)) {
            reject(new Error(t('msg.invalidColor')))
          }
          resolve()
        })
      },
    },
  ],
  theme: [
    {
      validator: (_: any, theme: any) => {
        return new Promise<void>((resolve, reject) => {
          if (!['solid', 'light', 'text'].includes(theme)) {
            reject(new Error(t('msg.invalidTheme')))
          }
          resolve()
        })
      },
    },
  ],
  type: [
    {
      validator: (_: any, type: any) => {
        return new Promise<void>((resolve, reject) => {
          if (!Object.values(ButtonActionsType).includes(type)) {
            reject(new Error(t('msg.invalidType')))
          }
          resolve()
        })
      },
    },
  ],
  label: [
    {
      validator: (_: any, label: any) => {
        return new Promise<void>((resolve, reject) => {
          if (!(label.length > 0) && !vModel.value.icon) {
            reject(new Error(t('msg.invalidLabel')))
          }
          resolve()
        })
      },
    },
  ],
  output_column_ids: [
    {
      validator: (_: any, value: any) => {
        return new Promise<void>((resolve, reject) => {
          if (vModel.value.type === ButtonActionsType.Ai && !value) {
            reject(new Error('At least one output field is required for AI Button'))
          }
          resolve()
        })
      },
    },
  ],
  fk_integration_id: [
    {
      validator: (_: any, value: any) => {
        return new Promise<void>((resolve, reject) => {
          if (vModel.value.type === ButtonActionsType.Ai && !value) {
            reject(new Error(t('title.aiIntegrationMissing')))
          }
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
  vModel.value.fk_script_id = colOptions?.fk_script_id
  vModel.value.icon = colOptions?.icon
  selectedWebhook.value = hooks.value.find((hook) => hook.id === vModel.value?.fk_webhook_id)
  selectedScript.value = activeBaseAutomations.value.find((script) => script.id === vModel.value?.fk_script_id)

  if (vModel.value.type === ButtonActionsType.Ai) {
    vModel.value.formula_raw = colOptions?.formula_raw || ''
    vModel.value.output_column_ids = colOptions?.output_column_ids || ''
    vModel.value.fk_integration_id = colOptions?.fk_integration_id
  }
} else {
  vModel.value.type = vModel.value?.type || buttonTypes.value[0]?.value

  if (vModel.value.type === ButtonActionsType.Ai) {
    vModel.value.theme = 'light'
    vModel.value.label = 'Generate data'
    vModel.value.color = 'purple'
    vModel.value.icon = 'ncAutoAwesome'
    vModel.value.output_column_ids = vModel.value?.output_column_ids || ''
  } else {
    vModel.value.theme = 'solid'
    vModel.value.label = 'Button'
    vModel.value.color = 'brand'
  }

  vModel.value.formula_raw = vModel.value?.formula_raw || ''
}

setAdditionalValidations({
  ...validators,
})

// set default value
if (vModel.value?.type === ButtonActionsType.Url || (column.value?.colOptions as any)?.type === ButtonActionsType.Url) {
  if ((column.value?.colOptions as any)?.formula_raw) {
    vModel.value.formula_raw =
      substituteColumnIdWithAliasInFormula(
        (column.value?.colOptions as ButtonType)?.formula,
        meta?.value?.columns as ColumnType[],
        (column.value?.colOptions as any)?.formula_raw,
      ) || ''
  } else {
    vModel.value.formula_raw = ''
  }
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

const isDropdownOpen = ref(false)

const updateButtonTheme = (type: string, name: string) => {
  vModel.value.theme = type
  vModel.value.color = name
  isDropdownOpen.value = false
}

const isButtonIconDropdownOpen = ref(false)

const iconSearchQuery = ref('')

const icons = computed(() => {
  return searchIcons(iconSearchQuery.value)
})

const removeIcon = () => {
  vModel.value.icon = null
  isButtonIconDropdownOpen.value = false
}

const selectIcon = (icon: string) => {
  vModel.value.icon = icon
  isButtonIconDropdownOpen.value = false
}

const handleUpdateActionType = () => {
  vModel.value.formula_raw = ''
}
</script>

<template>
  <div class="relative flex flex-col gap-4">
    <a-row :gutter="8">
      <a-col :span="12">
        <a-form-item v-bind="validateInfos.label" class="mt-4" :label="$t('general.label')">
          <a-input
            v-model:value="vModel.label"
            class="nc-column-label-input nc-input-shadow !rounded-lg"
            :class="{
              'nc-ai-input': isAiMode,
            }"
            placeholder="Button"
          />
        </a-form-item>
      </a-col>
      <a-col :span="6">
        <a-form-item :label="$t('general.style')" v-bind="validateInfos.theme">
          <NcDropdown v-model:visible="isDropdownOpen" class="nc-color-picker-dropdown-trigger">
            <div
              :class="{
                'nc-button-style-dropdown': isDropdownOpen,
                '!border-nc-border-purple !shadow-selected-ai': isDropdownOpen && isAiMode,
                '!border-brand-500 !shadow-selected': isDropdownOpen && !isAiMode,
              }"
              class="flex items-center justify-between border-1 h-8 px-[11px] border-gray-300 !w-full transition-all cursor-pointer !rounded-lg"
            >
              <div
                :class="`${vModel.color ?? 'brand'} ${vModel.theme ?? 'solid'}`"
                class="flex items-center justify-center nc-cell-button rounded-md h-6 w-6 gap-2"
              >
                <component :is="iconMap.cellText" class="w-4 h-4" />
              </div>
              <GeneralIcon icon="arrowDown" class="text-gray-500 !w-4 !h-4" />
            </div>
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
          </NcDropdown>
        </a-form-item>
      </a-col>
      <a-col :span="6">
        <a-form-item :label="$t('labels.icon')" v-bind="validateInfos.icon">
          <NcDropdown v-model:visible="isButtonIconDropdownOpen" class="nc-color-picker-dropdown-trigger">
            <div
              :class="{
                'nc-button-style-dropdown ': isButtonIconDropdownOpen,
                '!border-nc-border-purple !shadow-selected-ai': isButtonIconDropdownOpen && isAiMode,
                '!border-brand-500 !shadow-selected': isButtonIconDropdownOpen && !isAiMode,
              }"
              class="flex items-center justify-center border-1 h-8 px-[11px] border-gray-300 !w-full transition-all cursor-pointer !rounded-lg"
            >
              <div class="flex w-full items-center leading-5 justify-between gap-1">
                <GeneralIcon v-if="vModel.icon" :icon="vModel.icon as any" class="w-4 h-4 text-gray-700" />
                <div v-else class="text-sm flex items-center leading-5 text-gray-500">
                  {{ $t('labels.selectIcon') }}
                </div>
                <GeneralIcon icon="arrowDown" class="text-gray-500 !w-4 !h-4" />
              </div>
            </div>
            <template #overlay>
              <div class="bg-white w-80 space-y-3 h-70 overflow-y-auto rounded-lg">
                <div class="!sticky top-0 flex gap-2 bg-white px-2 py-2">
                  <a-input
                    ref="inputRef"
                    v-model:value="iconSearchQuery"
                    :placeholder="$t('placeholder.searchIcons')"
                    class="nc-dropdown-search-unified-input z-10 nc-input-shadow"
                    :class="{
                      'nc-ai-input': isAiMode,
                    }"
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
    <a-row :gutter="8">
      <a-col :span="24">
        <a-form-item :label="$t('labels.onClick')" v-bind="validateInfos.type">
          <a-select
            v-model:value="vModel.type"
            class="w-52 nc-button-type-select nc-select-shadow"
            :class="{
              'nc-ai-input': isAiMode,
            }"
            dropdown-class-name="nc-dropdown-button-cell-type"
            @change="handleUpdateActionType"
          >
            <template #suffixIcon> <GeneralIcon icon="arrowDown" class="text-gray-500" /> </template>

            <a-select-option v-for="(type, i) of buttonTypes" :key="i" :value="type.value">
              <NcTooltip :disabled="!type.tooltip" placement="right" class="w-full" :title="type.tooltip">
                <div class="flex gap-2 w-full capitalize text-gray-800 truncate items-center">
                  <div class="flex-1">
                    {{ type.label }}
                  </div>
                  <component
                    :is="iconMap.check"
                    v-if="vModel.type === type.value"
                    id="nc-selected-item-icon"
                    class="text-primary w-4 h-4"
                  />
                </div>
              </NcTooltip>
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
    </a-row>
    <div v-if="vModel?.type === buttonActionsType.Url">
      <SmartsheetColumnFormulaInputHelper
        v-model:value="vModel.formula_raw"
        suggestion-height="medium"
        editor-height="50px"
        disable-suggestion-headers
        :label="$t('labels.urlFormula')"
        :error="validateInfos.formula_raw?.validateStatus === 'error'"
      />
    </div>
    <SmartsheetColumnButtonOptionsWebhook
      v-if="vModel?.type === buttonActionsType.Webhook"
      v-model:model-value="vModel"
      v-model:selected-webhook="selectedWebhook"
    />
    <SmartsheetColumnButtonOptionsScript
      v-if="vModel?.type === buttonActionsType.Script"
      v-model:model-value="vModel"
      v-model:selected-script="selectedScript"
    />
  </div>
</template>

<style scoped lang="scss">
:deep(.ant-form-item-label > label) {
  @apply !text-small !leading-[18px] mb-2 !text-gray-800 flex;
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

    &.brand {
      @apply bg-brand-500;
    }

    &.red {
      @apply bg-red-600;
    }

    &.green {
      @apply bg-green-600;
    }

    &.maroon {
      @apply bg-maroon-600;
    }

    &.blue {
      @apply bg-blue-600;
    }

    &.orange {
      @apply bg-orange-600;
    }

    &.pink {
      @apply bg-pink-600;
    }

    &.purple {
      @apply bg-purple-500;
    }

    &.yellow {
      @apply bg-yellow-600;
    }

    &.gray {
      @apply bg-gray-600;
    }
  }

  &.light {
    @apply text-gray-700;

    &.brand {
      @apply bg-brand-200;
    }

    &.red {
      @apply bg-red-200;
    }

    &.green {
      @apply bg-green-200;
    }

    &.maroon {
      @apply bg-maroon-200;
    }

    &.blue {
      @apply bg-blue-200;
    }

    &.orange {
      @apply bg-orange-200;
    }

    &.pink {
      @apply bg-pink-200;
    }

    &.purple {
      @apply bg-purple-200;
    }

    &.yellow {
      @apply bg-yellow-200;
    }

    &.gray {
      @apply bg-gray-200;
    }
  }

  &.text {
    @apply border-1 border-gray-200 rounded;

    &.brand {
      @apply text-brand-500;
    }

    &.red {
      @apply text-red-600;
    }

    &.green {
      @apply text-green-600;
    }

    &.maroon {
      @apply text-maroon-600;
    }

    &.blue {
      @apply text-blue-600;
    }

    &.orange {
      @apply text-orange-600;
    }

    &.pink {
      @apply text-pink-600;
    }

    &.purple {
      @apply text-purple-500;
    }

    &.yellow {
      @apply text-yellow-600;
    }

    &.gray {
      @apply text-gray-600;
    }
  }
}
</style>
