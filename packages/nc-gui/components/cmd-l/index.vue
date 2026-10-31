<script setup lang="ts">
import dayjs from 'dayjs'
import type { CmdCommand, CommandPaletteType } from '~/lib/types'
import { cmdRowDomId } from '~/utils/commandPaletteUtils'

type CmdRow = { kind: 'section'; title: string } | { kind: 'command'; command: CmdCommand }

const props = defineProps<{
  open: boolean
  setActiveCmdView: (cmd: CommandPaletteType) => void
}>()

const emits = defineEmits(['update:open'])

const vOpen = useVModel(props, 'open', emits)

const { $e } = useNuxtApp()

const { t } = useI18n()

const viewStore = useViewsStore()

const { allRecentViews, activeView } = storeToRefs(viewStore)

// Recorded by Cmd+K's EE commands (ee useGlobalCommands), which are mounted for the app's lifetime.
const { recentItems } = useCommand()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { bases, workspaceBasesMap } = storeToRefs(useBases())

const route = useRoute()

const ROW_HEIGHT = 36

const inputEl = ref<HTMLInputElement>()

const search = ref('')

const selectedId = ref<string>()

/** Set once the user moves the selection; until then late-arriving items keep the default row selected. */
const navigated = ref(false)

let openedAt = 0

const cmdOrCtrlKey = isMac() ? 'Meta' : 'Ctrl'

function dayBucket(viewedAt?: string) {
  if (!viewedAt) return t('labels.commandPalette.sections.earlier')
  const days = dayjs().startOf('day').diff(dayjs(viewedAt).startOf('day'), 'day')
  if (days <= 0) return t('labels.commandPalette.sections.today')
  if (days === 1) return t('labels.commandPalette.sections.yesterday')
  return t('labels.commandPalette.sections.earlier')
}

/** Inside a base Cmd+L lists only that base; elsewhere the whole workspace. */
const scopeBaseId = computed(() => route.params.baseId as string | undefined)

function inScope(item: { workspaceId: string; baseId: string }) {
  if (item.workspaceId !== activeWorkspaceId.value) return false
  return !scopeBaseId.value || item.baseId === scopeBaseId.value
}

// Views (tracked by the views store) and every other object (dashboards, scripts, workflows, …), newest first.
const commands = computed<CmdCommand[]>(() => {
  // The base name only when it isn't the base you're in (as in Cmd+K's Recent section).
  const baseHint = (baseId: string, name?: string) => (baseId === scopeBaseId.value ? undefined : name)

  const views = allRecentViews.value.filter(inScope).map((view) => ({
    viewedAt: view.viewedAt ?? '',
    command: {
      id: `recent:${view.tableID}:${view.viewId ?? ''}`,
      // A default view is its table, named once.
      title: view.isDefault ? view.tableName || view.viewName : view.viewName,
      hint: [
        baseHint(view.baseId, view.baseName),
        view.isDefault || view.tableName === view.viewName ? undefined : view.tableName,
      ]
        .filter(Boolean)
        .join(' / '),
      section: dayBucket(view.viewedAt),
      icon: { type: 'view', viewType: view.viewType },
      checked: view.viewId === activeView.value?.id && view.tableID === activeView.value?.fk_model_id,
      run: () => viewStore.changeView({ viewId: view.viewId ?? null, tableId: view.tableID, baseId: view.baseId }),
    } satisfies CmdCommand,
  }))

  const others = recentItems.value.filter(inScope).map((item) => ({
    viewedAt: item.viewedAt,
    command: {
      id: `recent:${item.kind}:${item.id}`,
      title: item.title,
      hint: [baseHint(item.baseId, item.baseTitle), item.parentTitle].filter(Boolean).join(' / '),
      section: dayBucket(item.viewedAt),
      icon: item.icon,
      checked: route.path === item.path,
      run: () => navigateTo(item.path),
    } satisfies CmdCommand,
  }))

  return [...views, ...others]
    .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))
    .slice(0, 30)
    .map(({ command }) => command)
})

const results = computed(() => searchCmdCommands(commands.value, search.value))

const rows = computed<CmdRow[]>(() =>
  groupCmdCommands(results.value).flatMap(({ section, commands: sectionCommands }) => [
    { kind: 'section' as const, title: section },
    ...sectionCommands.map((command) => ({ kind: 'command' as const, command })),
  ]),
)

const selectableIds = computed(() => results.value.map((command) => command.id))

const { list, containerProps, wrapperProps } = useVirtualList(rows, { itemHeight: ROW_HEIGHT })

function hide() {
  vOpen.value = false
}

function ensureVisible(id: string) {
  const container = containerProps.ref.value
  const rowIndex = rows.value.findIndex((row) => row.kind === 'command' && row.command.id === id)
  if (!container || rowIndex === -1) return

  const top = (rowIndex > 0 && rows.value[rowIndex - 1].kind === 'section' ? rowIndex - 1 : rowIndex) * ROW_HEIGHT
  const bottom = (rowIndex + 1) * ROW_HEIGHT
  if (top < container.scrollTop) container.scrollTop = top
  else if (bottom > container.scrollTop + container.clientHeight) container.scrollTop = bottom - container.clientHeight
}

function moveSelection(step: number) {
  const ids = selectableIds.value
  if (!ids.length) return

  const index = selectedId.value ? ids.indexOf(selectedId.value) : -1
  navigated.value = true
  selectedId.value = ids[(index + step + ids.length) % ids.length]
  ensureVisible(selectedId.value)
}

/** The view after the current one, so Cmd+L then Enter jumps back; while searching, the best match. */
function defaultSelectedId() {
  const ids = selectableIds.value
  if (search.value) return ids[0]
  const currentIndex = results.value.findIndex((command) => command.checked)
  return ids[currentIndex + 1] ?? ids[0]
}

function hoverRow(id: string) {
  navigated.value = true
  selectedId.value = id
}

function execute(command: CmdCommand) {
  $e('a:cmdL:changeView')
  hide()
  command.run?.()
}

function onKeydown(e: KeyboardEvent) {
  if (e.isComposing || e.keyCode === 229) return

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      moveSelection(1)
      return
    case 'ArrowUp':
      e.preventDefault()
      moveSelection(-1)
      return
    case 'Enter': {
      e.preventDefault()
      const command = results.value.find((c) => c.id === selectedId.value)
      if (command) execute(command)
      return
    }
    case 'Escape':
      e.preventDefault()
      e.stopPropagation()
      hide()
  }
}

// app.vue opens it; while open Cmd+L steps forward (Shift steps back), like an app switcher.
// The press that opened it reaches this listener too, so skip events older than the open.
useEventListener('keydown', (e: KeyboardEvent) => {
  if (!vOpen.value || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'l') return
  e.preventDefault()
  if (e.timeStamp <= openedAt) return
  moveSelection(e.shiftKey ? -1 : 1)
})

watch(vOpen, (isOpen) => {
  if (!isOpen) return

  openedAt = performance.now()
  viewStore.pruneRecentViews()
  // Only the base is checked for other objects: their own stores load per kind, on demand.
  // As in pruneRecentViews, only a successful load of this workspace's base list counts.
  const wsBases = workspaceBasesMap.value.get(activeWorkspaceId.value)
  if (wsBases) {
    recentItems.value = recentItems.value.flatMap((item) => {
      if (item.workspaceId !== activeWorkspaceId.value) return [item]
      const base = wsBases.get(item.baseId) ?? bases.value.get(item.baseId)
      if (!base) return item.isLane ? [item] : []
      return [{ ...item, baseTitle: base.title ?? item.baseTitle }]
    })
  }
  search.value = ''
  navigated.value = false
  selectedId.value = defaultSelectedId()
  nextTick(() => {
    inputEl.value?.focus()
    if (selectedId.value) ensureVisible(selectedId.value)
  })
})

watch(search, () => {
  navigated.value = false
  selectedId.value = defaultSelectedId()
  containerProps.ref.value?.scrollTo({ top: 0 })
})

watch(selectableIds, (ids) => {
  if (!vOpen.value) return
  if (!navigated.value || !selectedId.value || !ids.includes(selectedId.value)) selectedId.value = defaultSelectedId()
})
</script>

<template>
  <CmdKShell
    v-model:open="vOpen"
    active-cmd="cmd-l"
    :set-active-cmd-view="setActiveCmdView"
    modal-class="cmdl-modal cmdl-modal-active"
  >
    <template #header>
      <div class="nc-cmdk-input-row">
        <GeneralIcon class="nc-cmdk-input-icon" icon="ncClock" />
        <input
          ref="inputEl"
          v-model="search"
          class="cmdk-input"
          type="text"
          data-testid="nc-cmdl-input"
          :placeholder="$t('labels.commandPalette.searchRecentViews')"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="!!rows.length"
          aria-controls="nc-cmdl-listbox"
          :aria-activedescendant="selectedId ? cmdRowDomId(selectedId) : undefined"
          @keydown="onKeydown"
        />
        <div class="flex items-center gap-1.5 text-bodySm text-nc-content-gray-muted flex-none">
          <GeneralShortcutLabel :keys="[cmdOrCtrlKey, 'L']" />
        </div>
      </div>
    </template>

    <div v-if="!rows.length" class="nc-cmdk-empty">
      <GeneralIcon :icon="search ? 'search' : 'ncClock'" class="h-6 w-6 text-nc-content-gray-muted" />
      <div class="text-body text-nc-content-gray">
        {{ search ? $t('placeholder.noResultsFoundForYourSearch') : $t('labels.noRecentViews') }}
      </div>
    </div>
    <div v-else v-bind="containerProps" class="cmdk-actions nc-scrollbar-thin">
      <div id="nc-cmdl-listbox" v-bind="wrapperProps" role="listbox">
        <template v-for="item in list" :key="item.index">
          <div
            v-if="item.data.kind === 'section'"
            class="nc-cmdk-section"
            role="presentation"
            :style="{ height: `${ROW_HEIGHT}px` }"
          >
            {{ item.data.title }}
          </div>
          <CmdKRow
            v-else
            class="cmd-l"
            :command="item.data.command"
            :selected="selectedId === item.data.command.id"
            :height="ROW_HEIGHT"
            @hover="hoverRow(item.data.command.id)"
            @select="execute(item.data.command)"
          />
        </template>
      </div>
    </div>
  </CmdKShell>
</template>
