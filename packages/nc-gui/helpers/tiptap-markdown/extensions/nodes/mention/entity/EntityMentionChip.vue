<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)

const payload = computed(() => props.node.attrs.id ?? {})

const KIND_ICONS: Record<string, string> = {
  table: 'table',
  view: 'grid',
  automation: 'ncAutomation',
  script: 'ncScript',
  document: 'ncFileText',
  user: 'ncUser',
  dashboard: 'dashboards',
  interface: 'ncLayers',
  interfacePage: 'ncFile',
  integration: 'integration',
}

const icon = computed(() => KIND_ICONS[payload.value.kind] ?? 'file')
</script>

<template>
  <NodeViewWrapper as="span" class="nc-entity-mention-chip" :data-kind="payload.kind">
    <GeneralIntegrationIcon
      v-if="payload.kind === 'integration' && payload.subType"
      :type="payload.subType"
      size="sx"
      class="flex-none"
    />
    <GeneralIcon v-else :icon="icon" class="flex-none w-3.5 h-3.5" />
    <span class="truncate max-w-60">{{ payload.title }}</span>
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.nc-entity-mention-chip {
  @apply inline-flex items-center gap-1 align-middle rounded-md px-1 py-0.25 mx-0.5 bg-nc-brand-50 text-nc-content-brand whitespace-nowrap;
}
</style>
