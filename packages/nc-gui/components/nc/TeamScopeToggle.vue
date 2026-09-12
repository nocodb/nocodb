<script setup lang="ts">
import type { SubjectHierarchyScope } from 'nocodb-sdk'

/**
 * Two-segment team hierarchy-scope control — "This team | + Sub-teams"
 * (the permissions UserSelectorList idiom). Absent/null scope means
 * 'self_and_descendants' (the default everywhere scopes are used).
 */
const props = defineProps<{
  scope?: SubjectHierarchyScope | null
  disabled?: boolean
}>()

const emits = defineEmits<{
  toggle: []
}>()

const isSelfOnly = computed(() => props.scope === 'self_only')

function onSegmentClick(selfOnly: boolean) {
  if (props.disabled) return
  if (selfOnly === isSelfOnly.value) return

  emits('toggle')
}
</script>

<template>
  <div
    class="nc-team-scope-toggle flex items-center rounded-md border-1 border-nc-border-gray-medium flex-none"
    :class="{ 'opacity-60 pointer-events-none': disabled }"
    @click.stop
  >
    <NcTooltip placement="top" class="flex">
      <template #title>{{ $t('tooltip.teamScopeThisOnlyDesc') }}</template>
      <div
        class="nc-team-scope-segment px-1.5 py-0.5 text-[10px] leading-tight font-medium transition-colors cursor-pointer rounded-l-[5px]"
        :class="isSelfOnly ? 'bg-nc-fill-primary text-white' : 'text-nc-content-gray-subtle hover:bg-nc-bg-gray-light'"
        @click="onSegmentClick(true)"
      >
        {{ $t('labels.thisTeamOnly') }}
      </div>
    </NcTooltip>
    <NcTooltip placement="top" class="flex">
      <template #title>{{ $t('tooltip.teamScopeWithSubTeamsDesc') }}</template>
      <div
        class="nc-team-scope-segment px-1.5 py-0.5 text-[10px] leading-tight font-medium transition-colors cursor-pointer rounded-r-[5px]"
        :class="!isSelfOnly ? 'bg-nc-fill-primary text-white' : 'text-nc-content-gray-subtle hover:bg-nc-bg-gray-light'"
        @click="onSegmentClick(false)"
      >
        {{ $t('labels.withSubTeams') }}
      </div>
    </NcTooltip>
  </div>
</template>
