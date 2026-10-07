<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import PgSection from '../../-components/PgSection.vue'
import type { ShellRailGroup } from '~/components/shell/Rail.vue'

type Pattern = 'feature' | 'shell' | 'create'

const PATTERNS: Array<{ key: Pattern; title: string; props: string; size: string; usedBy: string }> = [
  {
    key: 'feature',
    title: 'Feature modal',
    props: 'size="feature" nc-modal-class-name="!p-0"',
    size: 'min(100vw − 32px, 1280px) × min(100vh − 100px, 1024px)',
    usedBy:
      'Webhook, MCP token, Sync create / edit / table form, Integration add / edit, Data source, OAuth client, Skills, Extensions + scripts market and details, Run script editor',
  },
  {
    key: 'shell',
    title: 'Shell modal',
    props: 'size="xl" nc-modal-class-name="!p-0" + ShellRail / ShellHeader / ShellClose',
    size: 'min(90vw, 1280px) × min(90vh, 864px)',
    usedBy: 'Base settings, Table details (Fields, Webhooks, API, ERD), Workspace base list',
  },
  {
    key: 'create',
    title: 'Create dialog',
    props: 'size="xs" height="auto" nc-modal-class-name="!p-0" class="!top-[25vh]" :centered="false"',
    size: 'min(100vw − 32px, 448px) × auto, pinned 25vh from the top',
    usedBy: 'Create table, view, script, dashboard, workflow, agent, team',
  },
]

const RAIL_GROUPS: ShellRailGroup[] = [
  {
    key: 'invite',
    label: 'Invite',
    items: [{ slug: 'members', icon: 'ncUserPlus', title: 'Members' }],
  },
  {
    key: 'data',
    label: 'Data',
    items: [
      { slug: 'sources', icon: 'ncDatabase', title: 'Data sources' },
      { slug: 'integrations', icon: 'integration', title: 'Integrations' },
      { slug: 'syncs', icon: 'ncZap', title: 'Syncs' },
    ],
  },
  {
    key: 'general',
    label: 'General',
    items: [
      { slug: 'mcp', icon: 'mcp', title: 'MCP server' },
      { slug: 'audits', icon: 'audit', title: 'Audits' },
    ],
  },
]

useProvideShell()

const open = ref<Pattern | null>(null)

const railActive = ref('sources')

const tableName = ref('')

const activeRailTitle = computed(() => RAIL_GROUPS.flatMap((g) => g.items).find((i) => i.slug === railActive.value)?.title ?? '')

function isOpen(key: Pattern) {
  return computed({
    get: () => open.value === key,
    set: (v: boolean) => {
      if (!v) open.value = null
    },
  })
}

const isFeatureOpen = isOpen('feature')

const isShellOpen = isOpen('shell')

const isCreateOpen = isOpen('create')
</script>

<template>
  <PgSection
    id="modal-patterns"
    title="Modal patterns"
    source="NcModal · modalSizes (utils/commonUtils.ts)"
    description="The three shapes product modals come in. Pick the pattern first, then fill it — don't hand-size a modal with its own height CSS."
  >
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <PgDemo v-for="p in PATTERNS" :key="p.key" :label="p.title">
        <template #actions>
          <NcButton size="xs" type="secondary" :data-testid="`pg-modal-pattern-${p.key}`" @click="open = p.key">Open</NcButton>
        </template>
        <div class="flex flex-col gap-2">
          <code class="text-captionXs font-mono text-nc-content-gray bg-nc-bg-gray-extralight rounded-md px-2 py-1.5 break-words">
            {{ p.props }}
          </code>
          <div class="text-captionSm text-nc-content-gray-subtle">{{ p.size }}</div>
          <div class="text-captionXs text-nc-content-gray-muted">Used by: {{ p.usedBy }}</div>
        </div>
      </PgDemo>
    </div>

    <!-- Feature: header row over a two-pane body, like integrations EditOrAdd / MCP token -->
    <NcModal v-model:visible="isFeatureOpen" size="feature" nc-modal-class-name="!p-0">
      <div class="h-full flex flex-col">
        <div class="flex-none flex w-full items-center gap-3 px-4 py-3 border-b-1 border-nc-border-gray-medium">
          <GeneralIcon icon="integration" class="h-5 w-5 text-nc-content-gray-emphasis" />
          <span class="flex-1 text-subHeading1 text-nc-content-gray-emphasis truncate">PostgreSQL integration</span>
          <NcButton size="small" type="secondary">Test connection</NcButton>
          <NcButton size="small">Save</NcButton>
          <NcButton size="small" type="text" icon-only @click="open = null">
            <template #icon>
              <GeneralIcon icon="close" />
            </template>
          </NcButton>
        </div>
        <div class="flex-1 min-h-0 flex">
          <div class="flex-1 min-w-0 overflow-y-auto nc-scrollbar-thin p-6">
            <div class="max-w-[760px] flex flex-col gap-4">
              <div class="text-subHeading2 text-nc-content-gray-emphasis">Connection</div>
              <div v-for="label in ['Connection name', 'Host', 'Port', 'Database', 'Username', 'Password']" :key="label">
                <div class="text-captionSm text-nc-content-gray-subtle mb-1.5">{{ label }}</div>
                <a-input class="nc-input-sm nc-input-shadow" :placeholder="label" />
              </div>
            </div>
          </div>
          <div
            class="flex-none w-[320px] border-l-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight p-5 flex flex-col gap-2"
          >
            <div class="text-captionBold text-nc-content-gray-emphasis">Help</div>
            <div class="text-captionSm text-nc-content-gray-subtle">
              The right panel is a fixed 320px; the body fills the modal's fixed height and scrolls on its own.
            </div>
          </div>
        </div>
      </div>
    </NcModal>

    <!-- Shell: same parts as SettingsShell -->
    <NcModal v-model:visible="isShellOpen" size="xl" nc-modal-class-name="!p-0">
      <div class="relative flex h-full w-full">
        <ShellClose @close="open = null" />
        <ShellRail :groups="RAIL_GROUPS" :active="railActive" search-placeholder="Search settings" @select="railActive = $event">
          <template #subject>
            <GeneralProjectIcon type="database" class="!h-5 !w-5 flex-none" />
            <span class="truncate">Getting Started</span>
          </template>
        </ShellRail>
        <div class="flex-1 flex flex-col min-w-0 min-h-0">
          <ShellHeader :title="activeRailTitle" description="Each rail item renders its pane here, under a shared header." />
          <div class="flex-1 min-h-0 nc-shell-gutter py-6 text-caption text-nc-content-gray-muted">
            Pane content for “{{ activeRailTitle }}”.
          </div>
        </div>
      </div>
    </NcModal>

    <!-- Create: copied from dlg/Table/Create.vue -->
    <NcModal
      v-model:visible="isCreateOpen"
      size="xs"
      height="auto"
      :centered="false"
      nc-modal-class-name="!p-0"
      class="!top-[25vh]"
    >
      <div class="py-5 flex flex-col gap-5">
        <div class="px-5 flex items-center gap-x-2 text-base font-semibold text-nc-content-gray">
          <GeneralIcon icon="table" class="!text-nc-content-gray-subtle2 w-5 h-5" />
          Create table
        </div>
        <div class="px-5">
          <a-input v-model:value="tableName" class="nc-input-sm nc-input-shadow" placeholder="Enter table name" />
        </div>
        <div class="px-5 flex justify-end gap-2">
          <NcButton size="small" type="secondary" @click="open = null">Cancel</NcButton>
          <NcButton size="small" :disabled="!tableName" @click="open = null">Create table</NcButton>
        </div>
      </div>
    </NcModal>
  </PgSection>
</template>
