<script setup lang="ts">
const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const bases = useBases()

const dashboardStore = useDashboardStore()

const { baseHomeSearchQuery, openedProject } = storeToRefs(bases)

const { dashboards: baseDashboards } = storeToRefs(dashboardStore)

const isExpanded = ref(true)

const dashboards = computed(() => baseDashboards.value.get(baseId.value) ?? [])


</script>

<template>
  <div class="nc-project-home-section">
    <div class="nc-project-home-section-header !cursor-pointer" @click.stop="isExpanded = !isExpanded">
      <div class="flex-1">{{ $t('general.data') }}</div>

      <GeneralIcon
        icon="chevronRight"
        class="flex-none nc-sidebar-source-node-btns cursor-pointer transform transition-transform duration-200 text-[20px] text-nc-content-gray-muted"
        :class="{ '!rotate-90': isExpanded }"
      />
    </div>
    <div key="g1" class="overflow-x-hidden transition-max-height" :class="{ 'max-h-0': !isExpanded }">
      Show all tables and Dashboards here
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
