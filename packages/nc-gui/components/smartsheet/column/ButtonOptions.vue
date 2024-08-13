<script setup lang="ts">
import {
  FormulaError,
  UITypes,
  isHiddenCol,
  substituteColumnIdWithAliasInFormula,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk'
import { type ButtonType, type ColumnType, type HookType } from 'nocodb-sdk'
import { searchIcons } from '../../../utils/iconUtils'

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

const uiTypesNotSupportedInFormulas = [UITypes.QrCode, UITypes.Barcode, UITypes.Button]

const webhooksStore = useWebhooksStore()

const { loadHooksList } = webhooksStore

await loadHooksList()

const { hooks } = toRefs(webhooksStore)

const selectedWebhook = ref<HookType>()

const manualHooks = computed(() => {
  return hooks.value.filter((hook) => hook.event === 'manual' && hook.active)
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
          if (vModel.value.type === 'webhook' && !fk_webhook_id) {
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
          if (!['url', 'webhook'].includes(type)) {
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

const isDropdownOpen = ref(false)

const updateButtonTheme = (type: string, name: string) => {
  vModel.value.theme = type
  vModel.value.color = name
  isDropdownOpen.value = false
}

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
</script>

<template>
  <div class="relative">
    <a-row :gutter="8">
      <a-col :span="12">
        <a-form-item v-bind="validateInfos.label" class="mt-4" :label="$t('general.label')">
          <a-input v-model:value="vModel.label" class="nc-column-label-input !rounded-lg" placeholder="Button" />
        </a-form-item>
      </a-col>
      <a-col :span="6">
        <a-form-item :label="$t('general.style')" v-bind="validateInfos.theme">
          <NcDropdown v-model:visible="isDropdownOpen" class="nc-color-picker-dropdown-trigger">
            <div
              :class="{
                '!border-brand-500 shadow-selected nc-button-style-dropdown ': isDropdownOpen,
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
                '!border-brand-500 shadow-selected nc-button-style-dropdown ': isButtonIconDropdownOpen,
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
            <template #suffixIcon> <GeneralIcon icon="arrowDown" class="text-gray-500" /> </template>

            <a-select-option v-for="(type, i) of buttonTypes" :key="i" :value="type.value">
              <div class="flex gap-2 w-full capitalize text-gray-800 truncate items-center">
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
    <div v-if="vModel?.type === 'url'" class="!mt-4">
      <SmartsheetColumnFormulaInputHelper
        v-model:value="vModel.formula_raw"
        suggestion-height="medium"
        editor-height="50px"
        disable-suggestion-headers
        :label="$t('labels.urlFormula')"
        :error="validateInfos.formula_raw?.validateStatus === 'error'"
      />
    </div>

    <a-form-item v-if="vModel?.type === 'webhook'" class="!mt-4">
      <div class="mb-2 text-gray-800 text-[13px] flex justify-between">
        {{ $t('labels.webhook') }}
        <a
          class="font-medium"
          href="https://docs.nocodb.com/fields/field-types/custom-types/button#create-a-button-field"
          target="_blank"
        >
          Docs
        </a>
      </div>
      <div class="flex rounded-lg">
        <NcDropdown v-model:visible="isWebHookSelectionDropdownOpen" :trigger="['click']">
          <template #overlay>
            <NcListWithSearch
              v-if="isWebHookSelectionDropdownOpen"
              :is-parent-open="isWebHookSelectionDropdownOpen"
              :search-input-placeholder="$t('placeholder.searchFields')"
              :option-config="{ selectOptionEvent: ['c:actions:webhook'], optionClassName: '' }"
              :options="manualHooks"
              :selected-option-id="selectedWebhook?.id"
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
              'nc-button-style-dropdown shadow-dropdown-open remove-right-shadow': isWebHookSelectionDropdownOpen,
            }"
            class="nc-button-webhook-select border-r-0 flex items-center justify-center border-1 h-8 px-[8px] border-gray-300 !w-full transition-all cursor-pointer !rounded-l-lg"
          >
            <div class="flex w-full items-center gap-2">
              <div
                :key="selectedWebhook?.id"
                class="flex items-center overflow-x-clip truncate text-ellipsis w-full gap-1 text-gray-800"
              >
                <NcTooltip
                  :class="{
                    'text-gray-500': !selectedWebhook?.title,
                  }"
                  class="truncate max-w-full"
                  show-on-truncate-only
                >
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
                class="text-gray-500 transition-all transition-transform"
              />
            </div>
          </div>
        </NcDropdown>
        <NcButton
          size="small"
          type="secondary"
          class="!rounded-l-none border-l-[#d9d9d9] !hover:bg-white nc-button-style-dropdown"
          :class="{
            'nc-button-style-dropdown shadow-dropdown-open remove-left-shadow': isWebHookSelectionDropdownOpen,
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

<style scoped lang="scss">
.shadow-dropdown-open {
  @apply transition-all duration-0.3s;

  &:not(:focus-within) {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.24);
  }
}

:deep(.ant-form-item-label > label) {
  @apply !text-small !leading-[18px] mb-2 !text-gray-800 flex;
}

.nc-list-with-search {
  @apply w-full;
}
.remove-right-shadow {
  clip-path: inset(-2px 0px -2px -2px) !important;
}

.remove-left-shadow {
  clip-path: inset(-2px -2px -2px 0px) !important;
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
