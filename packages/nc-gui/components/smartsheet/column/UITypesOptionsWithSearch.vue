<script lang="ts" setup>
import { FIELD_AGENT_SUPPORTED_TYPES, UITypes, UITypesName, UITypesSearchTerms, readonlyMetaAllowedTypes } from 'nocodb-sdk'

const props = defineProps<{
  options: typeof uiTypes
  extraIcons?: Record<string, string>
}>()

const emits = defineEmits<{ selected: [UITypes] }>()

const { options } = toRefs(props)

const { isMetaReadOnly } = useRoles()

const {
  showUpgradeToUseAiPromptField,
  showUpgradeToUseAiButtonField,
  showUpgradeToUseColourField,
  showUpgradeToUseUuidField,
  showUpgradeToUseAutoNumberField,
} = useEeConfig()

const { t } = useI18n()

const searchQuery = ref('')

const searchBasisInfoMap = ref<Record<string, string>>({})

// Field Agent submenu: use SDK single source of truth
const FIELD_AGENT_SUBMENU_TYPES = FIELD_AGENT_SUPPORTED_TYPES

const filteredOptions = computed(() => {
  searchBasisInfoMap.value = {}

  return (options.value || []).filter((c) => {
    // Step 1: apply default filter
    if (searchCompare([c.name, UITypesName[c.name]], searchQuery.value)) return true

    // Step 2: apply search basis options
    return searchCompare([...(UITypesSearchTerms[c.name] || [])], searchQuery.value, (matchKeyword) => {
      if (!matchKeyword) return

      searchBasisInfoMap.value[c.name] = t('msg.matchedByKeyword', { matchKeyword })
    })
  })
})

const inputRef = ref()

const activeFieldIndex = ref(-1)

const isDisabledUIType = (type: UITypes) => {
  return isMetaReadOnly.value && !readonlyMetaAllowedTypes.includes(type)
}

const onClick = (uidt: UITypes) => {
  if (!uidt || isDisabledUIType(uidt)) return

  // AIFieldAgent has a submenu — don't emit on direct click
  if (uidt === AIFieldAgent) return

  if (uidt === AIPrompt && showUpgradeToUseAiPromptField({ triggerSource: 'field-menu-ai-prompt' })) {
    return
  }

  if (uidt === AIButton && showUpgradeToUseAiButtonField({ triggerSource: 'field-menu-ai-button' })) {
    return
  }

  if (uidt === UITypes.Colour && showUpgradeToUseColourField({ triggerSource: 'field-menu-colour-field' })) {
    return
  }

  // EE-only: gate UUID field type behind plan feature flag
  if (uidt === UITypes.UUID && showUpgradeToUseUuidField({ triggerSource: 'field-menu-uuid-field' })) {
    return
  }

  // EE-only: gate AutoNumber field type behind plan feature flag
  if (uidt === UITypes.AutoNumber && showUpgradeToUseAutoNumberField({ triggerSource: 'field-menu-autonumber-field' })) {
    return
  }

  emits('selected', uidt)
}

// Field Agent submenu: emit composite string so EditOrAdd can preload field_agent meta
const onFieldAgentSubTypeClick = (subType: UITypes) => {
  emits('selected', `${AIFieldAgent}:${subType}` as any)
}

const handleAutoScrollOption = () => {
  const option = document.querySelector('.nc-column-list-option-active')

  if (option) {
    setTimeout(() => {
      option?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }
}

const onArrowDown = () => {
  activeFieldIndex.value = Math.min(activeFieldIndex.value + 1, filteredOptions.value.length - 1)
  handleAutoScrollOption()
}

const onArrowUp = () => {
  activeFieldIndex.value = Math.max(activeFieldIndex.value - 1, 0)
  handleAutoScrollOption()
}

const handleKeydownEnter = () => {
  if (filteredOptions.value[activeFieldIndex.value]) {
    onClick(filteredOptions.value[activeFieldIndex.value].name)
  } else if (filteredOptions.value[0]) {
    onClick(filteredOptions.value[activeFieldIndex.value].name)
  }
}

onMounted(() => {
  searchQuery.value = ''
  activeFieldIndex.value = options.value?.findIndex((o) => o.name === UITypes.SingleLineText) ?? -1
})

const { isSystem } = useColumnCreateStoreOrThrow()
</script>

<template>
  <div
    class="flex-1 border-1 border-nc-border-gray-medium rounded-lg flex flex-col pb-2"
    data-testid="nc-column-uitypes-options-list-wrapper"
    @keydown.arrow-down.prevent="onArrowDown"
    @keydown.arrow-up.prevent="onArrowUp"
    @keydown.enter.prevent="onClick(filteredOptions[activeFieldIndex].name)"
  >
    <div class="w-full mb-2 !border-b-1" @click.stop>
      <a-input
        ref="inputRef"
        v-model:value="searchQuery"
        :placeholder="`${$t('general.search')} ${$t('labels.columnType').toLowerCase()}`"
        class="nc-column-type-search-input nc-toolbar-dropdown-search-field-input !border-none !shadow-none !py-2 !rounded-t-lg"
        :disabled="isSystem"
        @keydown.enter.stop="handleKeydownEnter"
        @change="activeFieldIndex = 0"
      >
        <template #prefix> <GeneralIcon icon="search" class="nc-search-icon h-4 w-4 mr-1" /> </template>
      </a-input>
    </div>
    <div
      class="nc-column-list-wrapper flex-col w-full max-h-[290px] nc-scrollbar-thin !overflow-y-auto px-2 focus-visible:(shadow-none outline-none ring-0)"
    >
      <div v-if="!filteredOptions.length" class="px-2 py-6 text-nc-content-gray-muted flex flex-col items-center gap-6">
        <img
          src="~assets/img/placeholder/no-search-result-found.png"
          class="!w-[164px] flex-none"
          :alt="$t('title.noSearchResultsFound')"
        />

        {{ options?.length ? $t('title.noResultsMatchedYourSearch') : $t('title.theListIsEmpty') }}
      </div>
      <GeneralSourceRestrictionTooltip
        v-for="(option, index) in filteredOptions"
        :key="index"
        :message="$t('tooltip.typeNotAllowed')"
        :enabled="isDisabledUIType(option.name)"
      >
        <!-- AI Field Agent item with hover submenu -->
        <a-popover
          v-if="option.name === AIFieldAgent"
          placement="rightTop"
          trigger="hover"
          overlay-class-name="nc-field-agent-submenu-popover"
          :get-popup-container="(triggerNode) => triggerNode.closest('[data-testid=nc-column-uitypes-options-list-wrapper]') || triggerNode.parentNode"
          :align="{ offset: [4, -8] }"
        >
          <template #content>
            <div class="py-1 min-w-[180px]">
              <div
                v-for="subType in FIELD_AGENT_SUBMENU_TYPES"
                :key="subType"
                class="flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md hover:bg-nc-bg-gray-light text-sm text-nc-content-gray-subtle"
                @click="onFieldAgentSubTypeClick(subType)"
              >
                <component :is="getUIDTIcon(subType)" class="w-4 h-4 text-nc-content-gray-subtle" />
                <div>{{ UITypesName[subType] }}</div>
              </div>
            </div>
          </template>
          <div
            class="flex w-full py-2 items-center justify-between px-2 rounded-md"
            :class="[
              `nc-column-list-option-${index}`,
              {
                'hover:bg-nc-bg-gray-light cursor-pointer': true,
                'bg-nc-bg-gray-light nc-column-list-option-active': activeFieldIndex === index,
                '!text-nc-content-purple-dark': true,
              },
            ]"
            :data-testid="option.name"
            @click="onClick(option.name)"
          >
            <div class="flex flex-1 gap-2 items-center">
              <component :is="option.icon" class="w-4 h-4 text-nc-content-gray-subtle" />
              <div class="text-sm flex-1">
                {{ UITypesName[option.name] }}
              </div>
              <span v-if="option.isNew" class="text-sm text-nc-content-purple-dark bg-nc-bg-purple-light px-2 rounded-md">{{
                $t('general.new')
              }}</span>
            </div>
            <GeneralIcon icon="ncChevronRight" class="!text-nc-content-gray-muted w-4 h-4" />
          </div>
        </a-popover>

        <!-- Regular menu items -->
        <div
          v-else
          class="flex w-full py-2 items-center justify-between px-2 rounded-md"
          :class="[
            `nc-column-list-option-${index}`,
            {
              'hover:bg-nc-bg-gray-light cursor-pointer': !isDisabledUIType(option.name),
              'bg-nc-bg-gray-light nc-column-list-option-active': activeFieldIndex === index && !isDisabledUIType(option.name),
              '!text-nc-content-gray-disabled cursor-not-allowed': isDisabledUIType(option.name),
              '!text-nc-content-purple-dark': [AIButton, AIPrompt].includes(option.name),
            },
          ]"
          :data-testid="option.name"
          @click="onClick(option.name)"
        >
          <div class="flex flex-1 gap-2 items-center">
            <component
              :is="option.icon"
              class="w-4 h-4"
              :class="isDisabledUIType(option.name) ? '!text-nc-content-gray-disabled' : 'text-nc-content-gray-subtle'"
            />
            <div
              class="text-sm !text-nc-content-gray-subtle"
              :class="{
                'flex-1': !searchBasisInfoMap[option.name],
              }"
            >
              {{ UITypesName[option.name] }}
            </div>
            <div v-if="searchBasisInfoMap[option.name]" class="flex-1 flex">
              <NcTooltip :title="searchBasisInfoMap[option.name]" class="flex cursor-help">
                <GeneralIcon icon="info" class="flex-none h-3.5 w-3.5 text-nc-content-gray-muted" />
              </NcTooltip>
            </div>

            <span v-if="option.deprecated" class="!text-xs !text-nc-content-brand-hover">({{ $t('general.deprecated') }})</span>
            <span v-if="option.isNew" class="text-sm text-nc-content-purple-dark bg-nc-bg-purple-light px-2 rounded-md">{{
              $t('general.new')
            }}</span>
          </div>
          <GeneralIcon
            v-if="extraIcons && extraIcons[option.name]"
            class="!text-nc-content-gray-muted"
            :icon="extraIcons[option.name]"
          />
        </div>
      </GeneralSourceRestrictionTooltip>
    </div>
  </div>
</template>

<style lang="scss">
[data-testid='nc-column-uitypes-options-list-wrapper'] {
  overflow: visible;
}

.nc-field-agent-submenu-popover {
  z-index: 1050;

  .ant-popover-inner {
    @apply !rounded-lg !shadow-lg !border-1 !border-nc-border-gray-medium !bg-white;
  }

  .ant-popover-inner-content {
    @apply !p-1 !bg-white !rounded-lg;
  }

  .ant-popover-arrow {
    @apply !hidden;
  }
}
</style>
