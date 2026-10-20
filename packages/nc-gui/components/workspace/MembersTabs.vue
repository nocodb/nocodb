<script lang="ts" setup>
import type { TeamV3V3Type } from 'nocodb-sdk'

// People and Teams are one page; each tab is its own route, so links and the ?teamId modal keep working.
const props = defineProps<{
  pane: 'members' | 'teams'
  workspaceId: string
}>()

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { workspaceUserCount, teams } = storeToRefs(workspaceStore)

const { blockTeamsManagement } = useEeConfig()

const tabRefs = ref<HTMLButtonElement[]>([])

const tabs = computed(() => [
  {
    key: 'members' as const,
    icon: 'ncUser' as const,
    label: t('labels.people'),
    count: workspaceUserCount.value,
  },
  {
    key: 'teams' as const,
    icon: 'ncBuilding' as const,
    label: t('general.teams'),
    // Same list the Teams tab shows: org teams are managed from the org admin.
    count: blockTeamsManagement.value
      ? undefined
      : ((teams.value || []) as (TeamV3V3Type & { scope?: string })[]).filter((team) => team.scope !== 'org').length,
  },
])

function selectTab(key: 'members' | 'teams') {
  if (key === props.pane) return

  navigateTo(wsHomePanePath(props.workspaceId, key), { replace: true })
}

function onKeydown(e: KeyboardEvent, index: number) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return

  e.preventDefault()

  const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.value.length) % tabs.value.length

  tabRefs.value[next]?.focus()
  selectTab(tabs.value[next]!.key)
}
</script>

<template>
  <div
    class="nc-ws-members-tabs flex-none flex items-end gap-6 nc-shell-gutter mb-3 border-b-1 border-nc-border-gray-medium"
    role="tablist"
    :aria-label="$t('labels.membersAndTeams')"
  >
    <button
      v-for="(tab, index) of tabs"
      :key="tab.key"
      ref="tabRefs"
      v-e="['c:ws:members:tab:switch', { tab: tab.key }]"
      type="button"
      role="tab"
      :aria-selected="pane === tab.key"
      :tabindex="pane === tab.key ? 0 : -1"
      class="relative flex items-center gap-2 h-10 -mb-px border-b-2 text-bodyDefaultSm whitespace-nowrap outline-none cursor-pointer transition-colors focus-visible:shadow-focus rounded-t-md"
      :class="
        pane === tab.key
          ? 'border-nc-content-brand text-nc-content-gray font-semibold'
          : 'border-transparent text-nc-content-gray-subtle hover:text-nc-content-gray'
      "
      :data-testid="`nc-ws-members-tab-${tab.key}`"
      @click="selectTab(tab.key)"
      @keydown="onKeydown($event, index)"
    >
      <GeneralIcon :icon="tab.icon" class="w-4 h-4 flex-none" aria-hidden="true" />
      {{ tab.label }}
      <span
        v-if="tab.count !== undefined"
        class="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-md text-bodySm"
        :class="pane === tab.key ? 'bg-nc-bg-brand text-nc-content-brand' : 'bg-nc-bg-gray-light text-nc-content-gray-subtle'"
      >
        {{ tab.count }}
      </span>
    </button>
  </div>
</template>
