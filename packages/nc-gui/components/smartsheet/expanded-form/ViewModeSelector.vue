<script lang="ts" setup>
interface ItemType {
  icon: IconMapKey
  title?: string
  tooltip?: string
  value: string
  hidden?: boolean
}

const modelValue = defineModel<string>()

const isPublic = inject(IsPublicInj, ref(false))

const { isUIAllowed } = useRoles()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { isSqlView } = useSmartsheetStoreOrThrow()

const disabled = computed(() => {
  return !isUIAllowed('viewCreateOrEdit')
})

const isViewModeEnabled = computed(() => {
  return (
    isEeUI &&
    !isPublic.value &&
    (isFeatureEnabled(FEATURE_FLAG.EXPANDED_FORM_FILE_PREVIEW_MODE) ||
      isFeatureEnabled(FEATURE_FLAG.EXPANDED_FORM_DISCUSSION_MODE))
  )
})

const items = computed(() => {
  return [
    { icon: 'menu', value: 'field', tooltip: 'Fields' },
    {
      icon: modelValue.value === 'attachment' ? 'ncFileTextSolid' : 'ncFileText',
      value: 'attachment',
      tooltip: 'File Preview',
      hidden: !isFeatureEnabled(FEATURE_FLAG.EXPANDED_FORM_FILE_PREVIEW_MODE),
    },
    {
      icon: modelValue.value === 'discussion' ? 'ncMessageSquare1Solid' : 'ncMessageSquare1Outline',
      value: 'discussion',
      tooltip: 'Discussion',
      hidden: !isFeatureEnabled(FEATURE_FLAG.EXPANDED_FORM_DISCUSSION_MODE) || isSqlView.value,
    },
  ].filter((i) => !i.hidden) as ItemType[]
})
</script>

<template>
  <NcTooltip v-if="isViewModeEnabled" :disabled="!disabled">
    <template #title> You do not have permission to change view mode. </template>
    <div
      class="tab-wrapper flex flex-row rounded-lg border-1 border-nc-border-gray-medium bg-white h-7 overflow-hidden"
      :class="{
        '!cursor-not-allowed opacity-50': disabled,
      }"
    >
      <NcTooltip v-for="(item, idx) of items" :key="item.value" :disabled="!item.tooltip || disabled">
        <template #title>{{ item.tooltip }}</template>
        <div
          v-e="[`c:project:mode:${item.value}`]"
          class="tab"
          :class="[
            `nc-tab-${modelValue}`,
            {
              'pointer-events-none': disabled,
              'active': modelValue === item.value,
              'first-tab': idx === 0,
              'last-tab': idx === items.length - 1,
            },
          ]"
          @click="modelValue = item.value"
        >
          <GeneralIcon :icon="item.icon" class="tab-icon" />
          <div v-if="item.title" class="tab-title nc-tab">
            {{ $t(item.title) }}
          </div>
        </div>
      </NcTooltip>
    </div>
  </NcTooltip>
</template>

<style lang="scss" scoped>
.tab {
  @apply flex flex-row items-center h-full justify-center px-2 border-1 border-t-0 border-b-0 border-nc-border-gray-medium text-gray-600 hover:text-black cursor-pointer transition-all duration-300 select-none;

  &.first-tab {
    @apply border-0;
  }
  &.last-tab {
    @apply border-0;
  }

  &.nc-tab-field.active {
    :deep(svg.tab-icon) {
      path {
        @apply stroke-2;
      }
    }
  }
}

.tab-icon {
  font-size: 1rem !important;
  @apply w-4;
}
.tab .tab-title {
  @apply min-w-0;
  word-break: keep-all;
  white-space: nowrap;
  display: inline;
  line-height: 0.95;
}

.active {
  @apply bg-nc-bg-brand text-brand-600 hover:text-brand-600;

  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
}
</style>
