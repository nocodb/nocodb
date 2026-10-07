<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'
import type { ViewType } from 'nocodb-sdk'
import { DEMO_STORAGE_KEY, SEED_STEPS, seedDemoBase } from './-helper/demo-seed'
import type { DemoBase, SeedStep } from './-helper/demo-seed'
import LiveFrame from './-components/LiveFrame.vue'

interface LivePage {
  key: string
  group: string
  label: string
  path: string
}

const { $api } = useNuxtApp()

const { user, appInfo } = useGlobal()

const workspaceStore = useWorkspace()

const { activeWorkspaceId } = storeToRefs(workspaceStore)

const basesStore = useBases()

const DEVICES = [
  { key: 'desktop', label: 'Desktop', icon: 'ncMonitor', width: null },
  { key: 'tablet', label: 'Tablet', icon: 'ncTablet', width: 820 },
  { key: 'mobile', label: 'Mobile', icon: 'ncSmartphone', width: 390 },
] as const

const VIEW_TYPE_LABELS: Partial<Record<ViewTypes, string>> = {
  [ViewTypes.GRID]: 'Grid',
  [ViewTypes.GALLERY]: 'Gallery',
  [ViewTypes.KANBAN]: 'Kanban',
  [ViewTypes.CALENDAR]: 'Calendar',
  [ViewTypes.FORM]: 'Form',
  [ViewTypes.MAP]: 'Map',
  [ViewTypes.LIST]: 'List',
}

const TARGET_STORAGE_KEY = 'nc-playground-live-target'

const demo = ref<DemoBase | null>(null)

const bases = ref<Array<{ id: string; title: string }>>([])

const tables = ref<Array<{ id: string; title: string }>>([])

const tableViews = ref<ViewType[]>([])

const selectedBaseId = ref<string>()

const selectedTableId = ref<string>()

const isLoadingTarget = ref(false)

const steps = ref<SeedStep[]>([])

const isSeeding = ref(false)

const isCheckingDemo = ref(true)

const device = ref<(typeof DEVICES)[number]['key']>('desktop')

const isSplit = ref(false)

const primaryKey = ref('ws-home')

const secondaryKey = ref('account-profile')

const frameHeight = ref(760)

const workspaceId = computed(() => activeWorkspaceId.value)

const pages = computed<LivePage[]>(() => {
  const ws = workspaceId.value
  const list: LivePage[] = []
  const baseId = selectedBaseId.value
  const tableId = selectedTableId.value
  if (ws && baseId && tableId && tableViews.value.length) {
    const tableRoot = `/${ws}/${baseId}/${tableId}`
    for (const v of tableViews.value) {
      const kind = VIEW_TYPE_LABELS[v.type as ViewTypes]
      list.push({
        key: `view-${v.id}`,
        group: 'Views',
        label: kind ? `${v.title} · ${kind}` : v.title!,
        path: `${tableRoot}/${v.id}`,
      })
    }
    const gridView = tableViews.value.find((v) => v.type === ViewTypes.GRID) ?? tableViews.value[0]!
    const gridRoot = `${tableRoot}/${gridView.id}`
    list.push(
      { key: 'view-expanded', group: 'Views', label: 'Expanded record', path: `${gridRoot}?rowId=1` },
      { key: 'table-fields', group: 'Table details', label: 'Fields', path: `${gridRoot}/projects/field` },
      { key: 'table-relations', group: 'Table details', label: 'Relations', path: `${gridRoot}/projects/relation` },
      { key: 'table-api', group: 'Table details', label: 'API snippets', path: `${gridRoot}/projects/api` },
      { key: 'table-webhooks', group: 'Table details', label: 'Webhooks', path: `${gridRoot}/projects/webhook` },
      { key: 'base-overview', group: 'Base', label: 'Base overview', path: `/${ws}/${baseId}` },
      { key: 'base-members', group: 'Base', label: 'Settings · Members', path: `/${ws}/${baseId}?settings=members` },
      { key: 'base-settings', group: 'Base', label: 'Settings · General', path: `/${ws}/${baseId}?settings=settings` },
      { key: 'base-sources', group: 'Base', label: 'Settings · Data sources', path: `/${ws}/${baseId}?settings=data-sources` },
      { key: 'base-audits', group: 'Base', label: 'Settings · Audits', path: `/${ws}/${baseId}?settings=audits` },
    )
  }
  if (ws) {
    list.push(
      { key: 'ws-home', group: 'Workspace', label: 'Home', path: `/${ws}` },
      { key: 'ws-members', group: 'Workspace', label: 'Settings · Members', path: `/${ws}/settings/members` },
      { key: 'ws-teams', group: 'Workspace', label: 'Settings · Teams', path: `/${ws}/settings/teams` },
      { key: 'ws-general', group: 'Workspace', label: 'Settings · General', path: `/${ws}/settings/general` },
      { key: 'ws-integrations', group: 'Workspace', label: 'Settings · Integrations', path: `/${ws}/settings/integrations` },
      { key: 'ws-billing', group: 'Workspace', label: 'Settings · Billing', path: `/${ws}/settings/billing` },
      { key: 'ws-usage', group: 'Workspace', label: 'Settings · Usage', path: `/${ws}/settings/usage` },
    )
  }
  list.push(
    { key: 'account-profile', group: 'Account', label: 'Profile', path: '/account/profile' },
    { key: 'account-tokens', group: 'Account', label: 'API tokens', path: '/account/tokens' },
    { key: 'account-users', group: 'Account', label: 'Users', path: '/account/users' },
    { key: 'account-integrations', group: 'Account', label: 'Integrations', path: '/account/external-integrations' },
    { key: 'account-mcp', group: 'Account', label: 'MCP', path: '/account/mcp' },
  )
  if (!appInfo.value.isCloud) list.push({ key: 'account-apps', group: 'Account', label: 'App store', path: '/account/apps' })
  return list
})

const pageGroups = computed(() => {
  const groups = new Map<string, LivePage[]>()
  for (const page of pages.value) groups.set(page.group, [...(groups.get(page.group) ?? []), page])
  return [...groups.entries()]
})

const frameWidth = computed(() => DEVICES.find((d) => d.key === device.value)?.width ?? null)

const visibleFrames = computed(() =>
  [primaryKey.value, ...(isSplit.value ? [secondaryKey.value] : [])]
    .map((key) => pages.value.find((p) => p.key === key))
    .filter((p): p is LivePage => !!p),
)

function stepIcon(status: SeedStep['status']) {
  switch (status) {
    case 'done':
      return 'ncCheck'
    case 'warning':
      return 'ncAlertTriangle'
    case 'error':
      return 'ncXCircle'
    default:
      return 'ncCircle'
  }
}

function openInNewTab(path: string) {
  window.open(path, '_blank', 'noopener')
}

function persist(value: DemoBase | null) {
  demo.value = value
  try {
    if (value) localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(DEMO_STORAGE_KEY)
  } catch {}
}

async function restoreDemo() {
  isCheckingDemo.value = true
  try {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY)
    const parsed: DemoBase | null = stored ? JSON.parse(stored) : null
    if (!parsed) return
    // a base deleted elsewhere (or a reset dev DB) must not leave dead links
    await $api.instance.get(`/api/v3/meta/bases/${parsed.baseId}`)
    demo.value = parsed
  } catch {
    persist(null)
  } finally {
    isCheckingDemo.value = false
  }
}

async function createDemo() {
  if (!workspaceId.value) await workspaceStore.loadWorkspaces()
  const wsId = workspaceId.value
  if (!wsId) {
    message.error('No workspace available')
    return
  }

  isSeeding.value = true
  steps.value = SEED_STEPS.map((s) => ({ ...s, status: 'pending' }))
  try {
    if (demo.value) {
      try {
        await $api.instance.delete(`/api/v3/meta/bases/${demo.value.baseId}`)
      } catch {}
      persist(null)
    }
    const result = await seedDemoBase({
      api: $api,
      workspaceId: wsId,
      userEmail: user.value?.email,
      createBase: (title) => basesStore.createProject({ title, workspaceId: wsId }),
      onStep: (key, status, msg) => {
        steps.value = steps.value.map((s) => (s.key === key ? { ...s, status, message: msg } : s))
      },
    })
    persist(result)
    await loadBases()
    await selectTarget(result.baseId, result.tableId)
    message.success('Demo base ready')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isSeeding.value = false
  }
}

async function loadBases() {
  if (!workspaceId.value) return
  try {
    const { data } = await $api.instance.get(`/api/v3/meta/workspaces/${workspaceId.value}/bases`)
    bases.value = data.list ?? []
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Points every frame at a base + table; table defaults to the base's first. */
async function selectTarget(baseId: string, tableId?: string) {
  isLoadingTarget.value = true
  try {
    selectedBaseId.value = baseId
    const { data } = await $api.instance.get(`/api/v3/meta/bases/${baseId}/tables`)
    tables.value = data.list ?? []
    selectedTableId.value = tables.value.find((t) => t.id === tableId)?.id ?? tables.value[0]?.id
    tableViews.value = []
    if (selectedTableId.value) {
      const res = await $api.internal.getOperation(workspaceId.value!, baseId, {
        operation: 'viewList',
        tableId: selectedTableId.value,
      })
      tableViews.value = (res.list ?? []) as ViewType[]
    }
    const firstView = pages.value.find((p) => p.group === 'Views')
    if (firstView && !pages.value.some((p) => p.key === primaryKey.value && p.group === 'Views')) primaryKey.value = firstView.key
    try {
      localStorage.setItem(TARGET_STORAGE_KEY, JSON.stringify({ baseId, tableId: selectedTableId.value }))
    } catch {}
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoadingTarget.value = false
  }
}

onMounted(async () => {
  if (!workspaceId.value) await workspaceStore.loadWorkspaces(true)
  await Promise.all([restoreDemo(), loadBases()])
  let saved: { baseId?: string; tableId?: string } = {}
  try {
    saved = JSON.parse(localStorage.getItem(TARGET_STORAGE_KEY) ?? '{}')
  } catch {}
  const baseId = [saved.baseId, demo.value?.baseId, bases.value[0]?.id].find((id) => id && bases.value.some((b) => b.id === id))
  if (baseId) await selectTarget(baseId, saved.baseId === baseId ? saved.tableId : demo.value?.tableId)
})
</script>

<template>
  <div class="px-6 py-6 flex flex-col gap-5">
    <div class="flex items-start gap-4 flex-wrap">
      <div class="flex-1 min-w-80">
        <h1 class="text-heading3 text-nc-content-gray-emphasis">Live pages</h1>
        <p class="text-body text-nc-content-gray-subtle mt-1 max-w-3xl">
          The real app, framed. Pick any of your bases and a table — its views, table details and base settings render with real
          data, and every token edit and theme switch reaches inside the frames as you make it.
        </p>
      </div>

      <div class="w-full lg:w-[420px] rounded-xl border-1 border-nc-border-gray-medium p-4 bg-nc-bg-default">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="ncDatabase" class="w-4 h-4 text-nc-content-brand" />
          <span class="text-captionBold text-nc-content-gray-emphasis">Demo base</span>
          <span v-if="demo" class="text-captionSm text-nc-content-gray-muted truncate">
            Design Playground · {{ Object.keys(demo.views).length }} views
          </span>
          <div class="ml-auto">
            <NcButton
              size="small"
              :type="demo ? 'secondary' : 'primary'"
              :loading="isSeeding"
              :disabled="isCheckingDemo"
              data-testid="nc-playground-live-seed"
              @click="createDemo"
            >
              {{ demo ? 'Recreate' : 'Create demo base' }}
            </NcButton>
          </div>
        </div>
        <p v-if="!demo && !steps.length" class="text-captionSm text-nc-content-gray-muted mt-2">
          Creates a base with a Projects table holding every common field type, 30 rows, a linked Teams table, and Grid, Gallery,
          Kanban, Calendar, Form and Timeline views. Recreate deletes the previous demo base first.
        </p>
        <div v-if="steps.length" class="mt-3 flex flex-col gap-1.5">
          <div v-for="step in steps" :key="step.key" class="flex items-start gap-2">
            <GeneralLoader v-if="step.status === 'running'" size="regular" class="mt-0.5" />
            <GeneralIcon
              v-else
              :icon="stepIcon(step.status)"
              class="w-4 h-4 flex-none mt-0.5"
              :class="{
                'text-nc-content-green-dark': step.status === 'done',
                'text-nc-content-yellow-dark': step.status === 'warning',
                'text-nc-content-red-dark': step.status === 'error',
                'text-nc-content-gray-disabled': step.status === 'pending',
              }"
            />
            <div class="min-w-0">
              <div class="text-captionSm text-nc-content-gray">{{ step.label }}</div>
              <div
                v-if="step.message"
                class="text-captionXs break-words"
                :class="step.status === 'error' ? 'text-nc-content-red-dark' : 'text-nc-content-gray-muted'"
              >
                {{ step.message }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="text-captionSm text-nc-content-gray-muted">Base</span>
        <NcSelect
          :value="selectedBaseId"
          class="w-52"
          show-search
          option-filter-prop="label"
          placeholder="Pick a base"
          :loading="isLoadingTarget"
          data-testid="nc-playground-live-base"
          @change="(id: string) => selectTarget(id)"
        >
          <a-select-option v-for="b in bases" :key="b.id" :value="b.id" :label="b.title">
            <div class="flex items-center gap-2 min-w-0">
              <span class="truncate">{{ b.title }}</span>
              <NcBadge v-if="b.id === demo?.baseId" color="purple" :border="false" class="!h-4 text-captionXs">demo</NcBadge>
            </div>
          </a-select-option>
        </NcSelect>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-captionSm text-nc-content-gray-muted">Table</span>
        <NcSelect
          :value="selectedTableId"
          class="w-44"
          show-search
          option-filter-prop="label"
          :disabled="!tables.length"
          data-testid="nc-playground-live-table"
          @change="(id: string) => selectTarget(selectedBaseId!, id)"
        >
          <a-select-option v-for="t in tables" :key="t.id" :value="t.id" :label="t.title">{{ t.title }}</a-select-option>
        </NcSelect>
      </div>

      <NcDivider type="vertical" class="!h-5 !mx-0" />

      <NcSelect
        v-model:value="primaryKey"
        class="w-64"
        show-search
        option-filter-prop="label"
        data-testid="nc-playground-live-page"
      >
        <a-select-opt-group v-for="[group, items] in pageGroups" :key="group" :label="group">
          <a-select-option v-for="p in items" :key="p.key" :value="p.key" :label="`${group} ${p.label}`">{{
            p.label
          }}</a-select-option>
        </a-select-opt-group>
      </NcSelect>

      <template v-if="isSplit">
        <span class="text-captionSm text-nc-content-gray-muted">vs</span>
        <NcSelect v-model:value="secondaryKey" class="w-64" show-search option-filter-prop="label">
          <a-select-opt-group v-for="[group, items] in pageGroups" :key="group" :label="group">
            <a-select-option v-for="p in items" :key="p.key" :value="p.key" :label="`${group} ${p.label}`">
              {{ p.label }}
            </a-select-option>
          </a-select-opt-group>
        </NcSelect>
      </template>

      <NcSwitch v-model:checked="isSplit" size="small">
        <span class="text-captionSm">Side by side</span>
      </NcSwitch>

      <div class="ml-auto flex items-center gap-2">
        <div class="flex items-center p-0.5 rounded-lg bg-nc-bg-gray-light">
          <NcTooltip v-for="d in DEVICES" :key="d.key" :title="d.width ? `${d.label} · ${d.width}px` : d.label" :arrow="false">
            <button
              class="w-8 h-6 rounded-md flex items-center justify-center text-nc-content-gray-muted"
              :class="{ 'bg-nc-bg-default shadow-sm !text-nc-content-gray-emphasis': device === d.key }"
              @click="device = d.key"
            >
              <GeneralIcon :icon="d.icon" class="w-3.5 h-3.5" />
            </button>
          </NcTooltip>
        </div>
        <NcSelect v-model:value="frameHeight" size="small" class="w-28">
          <a-select-option :value="600">600px</a-select-option>
          <a-select-option :value="760">760px</a-select-option>
          <a-select-option :value="960">960px</a-select-option>
        </NcSelect>
      </div>
    </div>

    <div class="flex gap-4" :style="{ height: `${frameHeight}px` }">
      <div v-for="(page, i) in visibleFrames" :key="i" class="flex-1 min-w-0 flex flex-col gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-captionSmBold text-nc-content-gray-subtle">{{ page.group }} · {{ page.label }}</span>
          <code class="text-captionXs text-nc-content-gray-muted font-mono truncate">{{ page.path }}</code>
          <NcButton class="!ml-auto" size="xsmall" type="text" @click="openInNewTab(page.path)">
            <div class="flex items-center gap-1">
              <GeneralIcon icon="ncExternalLink" class="w-3.5 h-3.5" />
              Open
            </div>
          </NcButton>
        </div>
        <div class="flex-1 min-h-0 rounded-xl bg-nc-bg-gray-extralight p-2">
          <LiveFrame :src="page.path" :width="frameWidth" />
        </div>
      </div>
    </div>

    <p v-if="!bases.length && !isCheckingDemo" class="text-captionSm text-nc-content-gray-muted">
      No bases in this workspace yet — create the demo base, or any base of your own, to frame its views and settings.
    </p>
  </div>
</template>
