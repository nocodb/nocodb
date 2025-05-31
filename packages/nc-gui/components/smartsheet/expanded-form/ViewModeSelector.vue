<script lang="ts" setup>
import { ExpandedFormMode, type ViewType } from 'nocodb-sdk'

interface ItemType {
  icon: IconMapKey
  title?: string
  tooltip?: string
  value: string
  hidden?: boolean
}

const props = defineProps<{
  view?: ViewType
}>()

const modelValue = defineModel<string>()

const { isUIAllowed } = useRoles()

const isPublic = inject(IsPublicInj, ref(false))

const { isFeatureEnabled } = useBetaFeatureToggle()

const { isSqlView } = useSmartsheetStoreOrThrow()

const { isNew, commentsDrawer, baseRoles } = useExpandedFormStoreOrThrow()

const viewsStore = useViewsStore()

const isViewModeEnabled = computed(() => {
  return (
    !isNew.value &&
    commentsDrawer.value &&
    isUIAllowed('commentList', baseRoles.value) &&
    !isPublic.value &&
    (isFeatureEnabled(FEATURE_FLAG.EXPANDED_FORM_FILE_PREVIEW_MODE) ||
      (isFeatureEnabled(FEATURE_FLAG.EXPANDED_FORM_DISCUSSION_MODE) && !isSqlView.value))
  )
})

const items = computed(() => {
  return [
    { icon: 'menu', value: ExpandedFormMode.FIELD, tooltip: 'Fields' },
    {
      icon: modelValue.value === ExpandedFormMode.ATTACHMENT ? 'ncFileTextSolid' : 'ncFileText',
      value: ExpandedFormMode.ATTACHMENT,
      tooltip: 'File Preview',
      hidden: !isFeatureEnabled(FEATURE_FLAG.EXPANDED_FORM_FILE_PREVIEW_MODE),
    },
    {
      icon: modelValue.value === ExpandedFormMode.DISCUSSION ? 'ncMessageSquare1Solid' : 'ncMessageSquare1Outline',
      value: ExpandedFormMode.DISCUSSION,
      tooltip: 'Discussion',
      hidden: !isFeatureEnabled(FEATURE_FLAG.EXPANDED_FORM_DISCUSSION_MODE) || isSqlView.value,
    },
  ].filter((i) => !i.hidden) as ItemType[]
})

onMounted(() => {
  if (!isViewModeEnabled.value && modelValue.value !== ExpandedFormMode.FIELD) {
    modelValue.value = ExpandedFormMode.FIELD

    if (!props.view?.id) return

    viewsStore.setCurrentViewExpandedFormMode(props.view.id, ExpandedFormMode.FIELD)
  }
})
</script>

<template>
  <div
    v-if="isViewModeEnabled"
    class="tab-wrapper flex flex-row rounded-lg border-1 border-nc-border-gray-medium bg-white h-7 overflow-hidden"
  >
    <NcTooltip v-for="(item, idx) of items" :key="item.value" :disabled="!item.tooltip">
      <template #title>{{ item.tooltip }}</template>
      <div
        v-e="[`c:project:mode:${item.value}`]"
        class="tab"
        :class="[
          `nc-tab-${modelValue}`,
          {
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
