<script setup lang="ts">
import { Client } from 'typesense'
import type { CmdCommand, CommandPaletteType } from '~/lib/types'
import { cmdRowDomId } from '~/utils/commandPaletteUtils'

const props = defineProps<{
  open: boolean
  setActiveCmdView: (cmd: CommandPaletteType) => void
}>()

const emits = defineEmits(['update:open'])

const vOpen = useVModel(props, 'open', emits)

const ROW_HEIGHT = 36

const inputEl = ref<HTMLInputElement>()

const selectedId = ref<string>()

/** Set once the user moves the selection; new results reset it to the first row until then. */
const navigated = ref(false)

const typesenseClient = new Client({
  apiKey: 'lNKDTZdJrE76Sg8WEyeN9mXT29l1xq7Q',
  nodes: [
    {
      host: 'rqf5uvajyeczwt3xp-1.a1.typesense.net',
      port: 443,
      protocol: 'https',
    },
  ],
})

// An empty query lists popular pages, fetched only while the palette is open.
const { search, query } = useTypesenseSearch(typesenseClient, 'noco-docs-v2', 100, () => vOpen.value)

const { docsQuery } = useCommand()

const cmdOrCtrlKey = isMac() ? 'Meta' : 'Ctrl'

const isLoading = computed(() => query.isLoading.value)

// Results come page first, then its headings and text; a result without a url has nowhere to go.
const commands = computed<CmdCommand[]>(() => {
  const data = query.data.value
  if (!Array.isArray(data)) return []

  // Many pages share headings like "Filter", so the hint is the lvl1 › lvl2 path. The index has two levels:
  // a heading row is itself lvl2, so its path is just the page.
  const seen = new Set<string>()
  return data
    .filter((result) => !!result.url)
    .flatMap((result): CmdCommand[] => {
      const pageUrl = result.url.split('#')[0]!
      const hint =
        result.type === 'page'
          ? undefined
          : [result.page, result.section !== result.content ? result.section : undefined].filter(Boolean).join(' › ')
      // Two "Filter" headings on one page would be the same row twice.
      const key = `${pageUrl}\n${result.content}\n${hint ?? ''}`
      if (seen.has(key)) return []
      seen.add(key)
      return [
        {
          id: result.id,
          title: result.content,
          hint,
          icon: {
            type: 'icon',
            name: result.type === 'page' ? 'ncFileText' : result.type === 'heading' ? 'ncHash' : 'ncAlignLeft',
          },
          run: () => window.open(`https://nocodb.com${result.url}`, '_blank', 'noopener,noreferrer'),
        },
      ]
    })
})

const rows = computed(() => commands.value)

const { list, containerProps, wrapperProps } = useVirtualList(rows, { itemHeight: ROW_HEIGHT })

function hide() {
  vOpen.value = false
}

function ensureVisible(id: string) {
  const container = containerProps.ref.value
  const rowIndex = rows.value.findIndex((command) => command.id === id)
  if (!container || rowIndex === -1) return

  const top = rowIndex * ROW_HEIGHT
  const bottom = top + ROW_HEIGHT
  if (top < container.scrollTop) container.scrollTop = top
  else if (bottom > container.scrollTop + container.clientHeight) container.scrollTop = bottom - container.clientHeight
}

function moveSelection(step: number) {
  const ids = rows.value.map((command) => command.id)
  if (!ids.length) return

  const index = selectedId.value ? ids.indexOf(selectedId.value) : -1
  navigated.value = true
  selectedId.value = ids[(index + step + ids.length) % ids.length]
  ensureVisible(selectedId.value)
}

function hoverRow(id: string) {
  navigated.value = true
  selectedId.value = id
}

function execute(command: CmdCommand) {
  command.run?.()
  hide()
}

function onKeydown(e: KeyboardEvent) {
  if (e.isComposing) return

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
      const command = rows.value.find((c) => c.id === selectedId.value)
      if (command) execute(command)
      return
    }
    case 'Escape':
      e.preventDefault()
      e.stopPropagation()
      hide()
  }
}

watch(vOpen, (isOpen) => {
  if (!isOpen) return
  // "Search docs for …" from Cmd+K opens on its query; Cmd+J itself opens empty.
  search.value = docsQuery.value
  docsQuery.value = ''
  selectedId.value = undefined
  navigated.value = false
  nextTick(() => inputEl.value?.focus())
})

watch(search, () => {
  navigated.value = false
})

watch(rows, (list) => {
  if (!navigated.value || !selectedId.value || !list.some((command) => command.id === selectedId.value)) {
    selectedId.value = list[0]?.id
    containerProps.ref.value?.scrollTo({ top: 0 })
  }
})
</script>

<template>
  <CmdKShell v-model:open="vOpen" active-cmd="cmd-j" :set-active-cmd-view="setActiveCmdView" modal-class="cmdj-modal">
    <template #header>
      <div class="nc-cmdk-input-row">
        <GeneralIcon class="nc-cmdk-input-icon" icon="ncFileSearch" />
        <input
          ref="inputEl"
          v-model="search"
          class="cmdk-input cmdj-input"
          type="text"
          data-testid="nc-cmdj-input"
          :placeholder="$t('labels.commandPalette.searchDocsPlaceholder')"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="!!rows.length"
          aria-controls="nc-cmdj-listbox"
          :aria-activedescendant="selectedId ? cmdRowDomId(selectedId) : undefined"
          @keydown="onKeydown"
        />
        <GeneralLoader v-if="isLoading && search" />
        <GeneralShortcutLabel v-else :keys="[cmdOrCtrlKey, 'J']" class="text-nc-content-gray-muted" />
      </div>
    </template>

    <div v-if="isLoading && !rows.length" class="nc-cmdk-empty">
      <GeneralLoader :size="24" />
    </div>
    <div v-else-if="!search && !rows.length" class="nc-cmdk-empty">
      <GeneralIcon icon="ncFileSearch" class="h-6 w-6 text-nc-content-gray-muted" />
      <div class="text-body text-nc-content-gray">{{ $t('labels.docsSearchPrompt') }}</div>
    </div>
    <div v-else-if="!rows.length" class="nc-cmdk-empty">
      <GeneralIcon icon="search" class="h-6 w-6 text-nc-content-gray-muted" />
      <div class="text-body text-nc-content-gray">{{ $t('msg.info.docsSearchNoResults') }}</div>
    </div>
    <!-- Outside the virtual list so row offsets stay exact; px-2 matches .cmdk-actions, and the
         inline flex beats the shell's `.nc-cmdk-body > *` flex-1. -->
    <div v-if="!search && rows.length" class="px-2" style="flex: none" role="presentation">
      <div class="nc-cmdk-section" :style="{ height: `${ROW_HEIGHT}px` }">
        {{ $t('labels.commandPalette.sections.popularDocs') }}
      </div>
    </div>
    <div v-if="rows.length" v-bind="containerProps" class="cmdk-actions nc-scrollbar-thin">
      <div id="nc-cmdj-listbox" v-bind="wrapperProps" role="listbox">
        <CmdKRow
          v-for="item in list"
          :key="item.data.id"
          class="cmdj-action"
          :class="{ 'pl-4': item.data.icon?.type === 'icon' && item.data.icon.name !== 'ncFileText' }"
          :command="item.data"
          :selected="selectedId === item.data.id"
          :height="ROW_HEIGHT"
          @hover="hoverRow(item.data.id)"
          @select="execute(item.data)"
        >
          <template #trailing>
            <GeneralIcon icon="ncExternalLink" class="h-3.5 w-3.5 text-nc-content-gray-muted opacity-0 nc-cmdk-row-hover-icon" />
          </template>
        </CmdKRow>
      </div>
    </div>
  </CmdKShell>
</template>
