<script lang="ts" setup>
import type { PlanFeatureTypes } from 'nocodb-sdk'
import type { ViewPageType } from '~/lib/types'

export interface ToolRailItem {
  slug: ViewPageType
  icon: string
  title: string
  // When set, the row shows a plan-upgrade lock badge while the feature is blocked.
  feature?: PlanFeatureTypes
}

export interface ToolRailGroup {
  label: string
  items: ToolRailItem[]
}

interface Props {
  groups: ToolRailGroup[]
  active: ViewPageType
}

defineProps<Props>()

const emits = defineEmits<{
  select: [slug: ViewPageType]
}>()

const { isEEFeatureBlocked } = useEeConfig()

const onSelect = (slug: ViewPageType) => {
  emits('select', slug)
}
</script>

<template>
  <div
    class="nc-tools-rail flex-none w-61 flex flex-col bg-nc-bg-gray-extralight border-r-1 border-nc-border-gray-medium"
    data-testid="nc-tools-rail"
  >
    <div class="flex-1 overflow-y-auto nc-scrollbar-thin px-2.5 pt-3 pb-4">
      <template v-for="group in groups" :key="group.label">
        <div
          v-if="group.items.length"
          class="px-2 pt-2.5 pb-1.5 text-[10px] font-bold tracking-wide text-nc-content-gray-muted uppercase"
        >
          {{ group.label }}
        </div>
        <div
          v-for="item in group.items"
          :key="item.slug"
          v-e="[`c:table:tools-shell:${item.slug}`]"
          class="nc-tools-rail-item"
          :class="{ 'nc-tools-rail-item-active': active === item.slug }"
          :data-testid="`nc-tools-rail-item-${item.slug}`"
          @click="onSelect(item.slug)"
        >
          <GeneralIcon
            :icon="item.icon"
            class="!h-4 !w-4 flex-none"
            :class="active === item.slug ? 'text-nc-content-brand' : 'text-nc-content-gray-subtle2'"
          />
          <span class="truncate flex-1">{{ item.title }}</span>
          <LazyPaymentUpgradeBadge
            v-if="item.feature"
            :feature="item.feature"
            :feature-enabled-callback="() => !isEEFeatureBlocked"
            remove-click
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-tools-rail-item {
  @apply flex items-center gap-2.5 px-2.5 py-2 mb-0.5 rounded-lg text-bodyDefaultSm font-medium text-nc-content-gray-emphasis cursor-pointer;

  &:hover {
    @apply bg-nc-bg-gray-light;
  }
}

.nc-tools-rail-item-active {
  @apply bg-nc-bg-brand text-nc-content-brand font-bold;

  &:hover {
    @apply bg-nc-bg-brand;
  }
}
</style>
