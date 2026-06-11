<script lang="ts" setup>
import { ExpandedFormMode, type ViewType } from 'nocodb-sdk'

interface ItemType {
  icon: IconMapKey
  title?: string
  tooltip?: string
  value: string
  hidden?: boolean
  // Render a lock indicator on the tab; clicks resolve to the upgrade modal
  // instead of switching the mode.
  locked?: boolean
}

const props = defineProps<{
  view?: ViewType
}>()

const modelValue = defineModel<string>()

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const isPublic = inject(IsPublicInj, ref(false))

const { isSqlView } = useSmartsheetStoreOrThrow()

const { isNew, commentsDrawer, baseRoles } = useExpandedFormStoreOrThrow()

const viewsStore = useViewsStore()

// Show in every EE build (licensed + unlicensed on-prem + cloud). Unlicensed
// on-prem users see the tabs but get an upgrade modal on click for File /
// Discussion modes — discoverability over hiding.
const isViewModeEnabled = computed(() => {
  return (
    isEeUI &&
    !isNew.value &&
    commentsDrawer.value &&
    isUIAllowed('commentList', baseRoles.value) &&
    !isPublic.value &&
    !isMobileMode.value
  )
})

const { handleUpgradePlan, isEEFeatureBlocked } = useEeConfig()

const { t } = useI18n()

const items = computed(() => {
  return [
    { icon: 'menu', value: ExpandedFormMode.FIELD, tooltip: t('objects.fields') },
    {
      icon: modelValue.value === ExpandedFormMode.ATTACHMENT ? 'ncFileTextSolid' : 'ncFileText',
      value: ExpandedFormMode.ATTACHMENT,
      tooltip: t('labels.filePreview'),
      locked: isEEFeatureBlocked.value,
    },
    {
      icon: modelValue.value === ExpandedFormMode.DISCUSSION ? 'ncMessageSquare1Solid' : 'ncMessageSquare1Outline',
      value: ExpandedFormMode.DISCUSSION,
      tooltip: t('labels.discussion'),
      hidden: isSqlView.value,
      locked: isEEFeatureBlocked.value,
    },
  ].filter((i) => !i.hidden) as ItemType[]
})

const onTabClick = (item: ItemType) => {
  if (item.locked) {
    handleUpgradePlan()
    return
  }
  modelValue.value = item.value
}

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
    class="tab-wrapper flex flex-row rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default h-7 overflow-hidden"
  >
    <NcTooltip v-for="(item, idx) of items" :key="item.value" :disabled="!item.tooltip">
      <template #title>{{ item.tooltip }}</template>
      <div
        v-e="[`c:project:mode:${item.value}`]"
        class="tab"
        :class="[
          `nc-tab-${modelValue}`,
          {
            'active': modelValue === item.value && !item.locked,
            'first-tab': idx === 0,
            'last-tab': idx === items.length - 1,
            'nc-tab-locked': item.locked,
          },
        ]"
        @click="onTabClick(item)"
      >
        <GeneralIcon :icon="item.icon" class="tab-icon" />
        <GeneralIcon v-if="item.locked" icon="ncUpgradeSparkle" class="tab-lock-icon" />
        <div v-if="item.title" class="tab-title nc-tab">
          {{ $t(item.title) }}
        </div>
      </div>
    </NcTooltip>
  </div>
</template>

<style lang="scss" scoped>
.tab {
  @apply flex flex-row items-center h-full justify-center px-2 border-1 border-t-0 border-b-0 border-nc-border-gray-medium text-nc-content-gray-subtle2 cursor-pointer transition-all duration-300 select-none;

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

  &.active {
    @apply bg-nc-bg-brand-inverted text-nc-content-brand-disabled;

    box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
  }

  &:not(.active) {
    @apply hover:text-nc-content-gray-extreme;
  }
}

.tab-icon {
  font-size: 1rem !important;
  @apply w-4;
}
.tab-lock-icon {
  @apply w-2.5 h-2.5 ml-0.5 text-nc-content-gray-muted;
}
.tab.nc-tab-locked {
  @apply text-nc-content-gray-muted;
}
.tab .tab-title {
  @apply min-w-0;
  word-break: keep-all;
  white-space: nowrap;
  display: inline;
  line-height: 0.95;
}
</style>
