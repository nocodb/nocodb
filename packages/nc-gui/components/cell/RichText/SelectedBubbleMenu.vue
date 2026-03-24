<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'
import { RichTextBubbleMenuOptions } from '#imports'

interface Props {
  editor: Editor
  embedMode?: boolean
  isFormField?: boolean
  hiddenOptions?: RichTextBubbleMenuOptions[]
  enableCloseButton?: boolean
  hideMention?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  embedMode: false,
  isFormField: false,
  hiddenOptions: () => [],
  enableCloseButton: false,
  hideMention: false,
})

const emits = defineEmits(['close'])

const { editor, embedMode, isFormField, hiddenOptions, enableCloseButton } = toRefs(props)

const { appInfo } = useGlobal()

const { t } = useI18n()

const isEditColumn = inject(EditColumnInj, ref(false))

// ── Color picker (text color + background color) — doc editor / embedMode only ──

const showColorPicker = ref(false)

const textColors = [
  { name: 'Default', color: '#1f2937' },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Brown', color: '#92400e' },
  { name: 'Yellow', color: '#a16207' },
  { name: 'Green', color: '#15803d' },
  { name: 'Blue', color: '#1d4ed8' },
  { name: 'Purple', color: '#7c3aed' },
  { name: 'Pink', color: '#db2777' },
  { name: 'Orange', color: '#ea580c' },
  { name: 'Red', color: '#dc2626' },
] as const

const bgColors = [
  { name: 'None', color: '' },
  { name: 'Gray', color: '#e5e7eb' },
  { name: 'Orange', color: '#fed7aa' },
  { name: 'Pink', color: '#fbcfe8' },
  { name: 'Yellow', color: '#fef08a' },
  { name: 'Green', color: '#bbf7d0' },
  { name: 'Blue', color: '#bfdbfe' },
  { name: 'Purple', color: '#e9d5ff' },
  { name: 'Rose', color: '#fecdd3' },
  { name: 'Red', color: '#fecaca' },
] as const

const recentColors = ref<Array<{ type: 'text' | 'bg'; color: string }>>([])
const MAX_RECENT = 5

const addRecent = (type: 'text' | 'bg', color: string) => {
  if (!color) return
  const entry = { type, color }
  recentColors.value = [entry, ...recentColors.value.filter((r) => !(r.type === type && r.color === color))].slice(0, MAX_RECENT)
}

const activeTextColor = computed(() => {
  for (const tc of textColors) {
    if (tc.color === '#1f2937') continue
    if (editor.value?.isActive('textColor', { color: tc.color })) return tc.color
  }
  return null
})

const activeHighlightColor = computed(() => {
  for (const h of bgColors) {
    if (!h.color) continue
    if (editor.value?.isActive('highlight', { color: h.color })) return h.color
  }
  return null
})

const applyTextColor = (color: string) => {
  if (color === '#1f2937' || !color) {
    editor.value?.chain().focus().unsetTextColor().run()
  } else if (editor.value?.isActive('textColor', { color })) {
    editor.value?.chain().focus().unsetTextColor().run()
  } else {
    editor.value?.chain().focus().setTextColor({ color }).run()
    addRecent('text', color)
  }
}

const applyBgColor = (color: string) => {
  if (!color) {
    editor.value?.chain().focus().unsetHighlight().run()
  } else if (editor.value?.isActive('highlight', { color })) {
    editor.value?.chain().focus().unsetHighlight().run()
  } else {
    editor.value?.chain().focus().setHighlight({ color }).run()
    addRecent('bg', color)
  }
}

const applyRecent = (entry: { type: 'text' | 'bg'; color: string }) => {
  if (entry.type === 'text') applyTextColor(entry.color)
  else applyBgColor(entry.color)
}

const onDocClick = (e: MouseEvent) => {
  if (!showColorPicker.value) return
  const hit = (e.target as HTMLElement)?.closest?.('.nc-color-picker-dropdown, .nc-highlight-btn')
  if (!hit) showColorPicker.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))

// ── Helpers ──

const cmdOrCtrlKey = computed(() => (isMac() ? '⌘' : 'CTRL'))

const shiftKey = computed(() => (isMac() ? '⇧' : 'Shift'))

const altKey = computed(() => (isMac() ? '⌥' : 'Alt'))

const tooltipPlacement = computed(() => {
  if (isFormField.value) return 'bottom'
})

const tabIndex = computed(() => (isFormField.value ? -1 : 0))

const hasExtension = (name: string) => {
  return editor.value?.extensionManager.extensions.some((ext: any) => ext.name === name) ?? false
}

const isOptionVisible = (option: RichTextBubbleMenuOptions) => {
  if (option === RichTextBubbleMenuOptions.image && editor.value?.storage?.markdown?.options?.renderImagesAsLinks) {
    return false
  }

  if (hiddenOptions.value.includes(option)) return false

  const optionToExtName: Partial<Record<RichTextBubbleMenuOptions, string>> = {
    [RichTextBubbleMenuOptions.quote]: 'code',
    [RichTextBubbleMenuOptions.code]: 'codeBlock',
    [RichTextBubbleMenuOptions.numberedList]: 'orderedList',
    [RichTextBubbleMenuOptions.blockQuote]: 'blockquote',
  }
  const extName = optionToExtName[option] ?? option
  if (!hasExtension(extName)) return false

  return true
}

// ── Link toggle ──

const onToggleLink = () => {
  const activeNode = editor.value?.state?.selection?.$from?.nodeBefore || editor.value?.state?.selection?.$from?.nodeAfter

  const isLinkMarkedStoredInEditor = editor.value?.state?.storedMarks?.some((mark: any) => mark.type.name === 'link')

  const isActiveNodeMarkActive = activeNode?.marks?.some((mark: any) => mark.type.name === 'link') || isLinkMarkedStoredInEditor

  if (isActiveNodeMarkActive) {
    editor.value!.chain().focus().unsetLink().run()
  } else {
    if (editor.value.state.selection.empty) {
      editor
        .value!.chain()
        .focus()
        .insertContent(' ')
        .setTextSelection({ from: editor.value!.state.selection.$from.pos, to: editor.value!.state.selection.$from.pos + 1 })
        .toggleLink({
          href: '',
        })
        .setTextSelection({ from: editor.value!.state.selection.$from.pos, to: editor.value!.state.selection.$from.pos + 1 })
        .deleteSelection()
        .run()
    } else {
      editor
        .value!.chain()
        .focus()
        .setLink({
          href: '',
        })
        .selectTextblockEnd()
        .run()
    }

    setTimeout(() => {
      const linkInput = document.querySelector('.nc-text-area-rich-link-option-input')
      if (linkInput) {
        ;(linkInput as any).focus()
      }
    }, 100)
  }
}

// ── Mention ──

const newMentionNode = () => {
  if (!editor.value) return

  const lastCharacter = editor.value.state.doc.textBetween(
    editor.value.state.selection.$from.pos - 1,
    editor.value.state.selection.$from.pos,
  )

  if (lastCharacter === '@') {
    editor.value
      .chain()
      .deleteRange({ from: editor.value.state.selection.$from.pos - 1, to: editor.value.state.selection.$from.pos })
      .run()
  } else if (lastCharacter !== ' ') {
    editor.value?.commands.insertContent(' @')
    editor.value?.chain().focus().run()
  } else {
    editor.value?.commands.insertContent('@')
    editor.value?.chain().focus().run()
  }
}

// ── Menu entries factory ──

interface BubbleMenuButton {
  type: 'button'
  key: string
  icon: IconMapKey
  tooltip: string
  shortcut?: string
  isActive: () => boolean
  disabled: () => boolean
  action: () => void
}

interface BubbleMenuDivider {
  type: 'divider'
  key: string
}

interface BubbleMenuCustom {
  type: 'colorPicker' | 'link' | 'image' | 'mention' | 'close'
  key: string
}

type MenuEntry = BubbleMenuButton | BubbleMenuDivider | BubbleMenuCustom

const menuEntries = computed<MenuEntry[]>(() => {
  const e = editor.value
  if (!e) return []

  const entries: MenuEntry[] = []
  const codeBlockActive = () => e.isActive('codeBlock')
  const neverDisabled = () => false

  const btn = (
    key: string,
    icon: IconMapKey,
    tooltip: string,
    activeName: string,
    action: () => void,
    opts?: { shortcut?: string; activeParams?: any; disableOnCodeBlock?: boolean },
  ): BubbleMenuButton => ({
    type: 'button',
    key,
    icon,
    tooltip,
    shortcut: opts?.shortcut,
    isActive: () => e.isActive(activeName, opts?.activeParams),
    disabled: opts?.disableOnCodeBlock === false ? neverDisabled : codeBlockActive,
    action,
  })

  // ── Format marks ──
  entries.push(
    btn('bold', 'bold', t('labels.bold'), 'bold', () => e.chain().focus().toggleBold().run(), {
      shortcut: `${cmdOrCtrlKey.value} B`,
    }),
    btn('italic', 'italic', t('labels.italic'), 'italic', () => (e.chain().focus() as any).toggleItalic().run(), {
      shortcut: `${cmdOrCtrlKey.value} I`,
    }),
    btn('underline', 'underline', t('labels.underline'), 'underline', () => e.chain().focus().toggleUnderline().run(), {
      shortcut: `${cmdOrCtrlKey.value} U`,
    }),
  )

  if (embedMode.value && !isEditColumn.value && hasExtension('strike')) {
    entries.push(
      btn('strike', 'strike', t('labels.strike'), 'strike', () => e.chain().focus().toggleStrike().run(), {
        shortcut: `${shiftKey.value} ${cmdOrCtrlKey.value} S`,
      }),
    )
  }

  // ── Color picker ──
  if (embedMode.value && !isEditColumn.value && hasExtension('textColor') && hasExtension('highlight')) {
    entries.push({ type: 'colorPicker', key: 'colorPicker' })
  }

  // ── Code ──
  if (
    hasExtension('code') &&
    (isFormField.value ? !hiddenOptions.value.includes(RichTextBubbleMenuOptions.quote) : !embedMode.value)
  ) {
    entries.push(btn('inlineCode', 'code', t('general.code'), 'code', () => e.chain().focus().toggleCode().run()))
  }

  if (embedMode.value && isOptionVisible(RichTextBubbleMenuOptions.code)) {
    entries.push(
      btn('codeBlock', 'ncCodeBlock', t('general.codeBlock'), 'codeBlock', () => e.chain().focus().toggleCodeBlock().run(), {
        disableOnCodeBlock: false,
      }),
    )
  }

  entries.push({ type: 'divider', key: 'div1' })

  // ── Headings ──
  if (embedMode.value && !isFormField.value && hasExtension('heading')) {
    entries.push(
      btn('h1', 'ncHeading1', t('labels.heading1'), 'heading', () => e.chain().focus().toggleHeading({ level: 1 }).run(), {
        shortcut: `${cmdOrCtrlKey.value} ${altKey.value} 1`,
        activeParams: { level: 1 },
        disableOnCodeBlock: false,
      }),
      btn('h2', 'ncHeading2', t('labels.heading2'), 'heading', () => e.chain().focus().toggleHeading({ level: 2 }).run(), {
        shortcut: `${cmdOrCtrlKey.value} ${altKey.value} 2`,
        activeParams: { level: 2 },
        disableOnCodeBlock: false,
      }),
      btn('h3', 'ncHeading3', t('labels.heading3'), 'heading', () => e.chain().focus().toggleHeading({ level: 3 }).run(), {
        shortcut: `${cmdOrCtrlKey.value} ${altKey.value} 3`,
        activeParams: { level: 3 },
        disableOnCodeBlock: false,
      }),
      { type: 'divider' as const, key: 'div2' },
    )
  }

  // ── Block elements ──
  if (embedMode.value && !isEditColumn.value && isOptionVisible(RichTextBubbleMenuOptions.blockQuote)) {
    entries.push(
      btn('blockquote', 'ncQuote', t('labels.blockQuote'), 'blockquote', () => e.chain().focus().toggleBlockquote().run(), {
        disableOnCodeBlock: false,
      }),
    )
  }

  if (isOptionVisible(RichTextBubbleMenuOptions.bulletList)) {
    entries.push(
      btn('bulletList', 'ncList', t('labels.bulletList'), 'bulletList', () => e.chain().focus().toggleBulletList().run(), {
        disableOnCodeBlock: false,
      }),
    )
  }

  if (isOptionVisible(RichTextBubbleMenuOptions.numberedList)) {
    entries.push(
      btn(
        'numberedList',
        'ncNumberList',
        t('labels.numberedList'),
        'orderedList',
        () => e.chain().focus().toggleOrderedList().run(),
        {
          disableOnCodeBlock: false,
        },
      ),
    )
  }

  if (isOptionVisible(RichTextBubbleMenuOptions.taskList)) {
    entries.push(
      btn('taskList', 'ncCheckList', t('labels.taskList'), 'taskList', () => e.chain().focus().toggleTaskList().run(), {
        disableOnCodeBlock: false,
      }),
    )
  }

  // ── Mention ──
  if (appInfo.value.ee && !props.hideMention) {
    entries.push({ type: 'mention', key: 'mention' })
  }

  // ── Divider before insert group ──
  const blockOptions = [
    RichTextBubbleMenuOptions.blockQuote,
    RichTextBubbleMenuOptions.bulletList,
    RichTextBubbleMenuOptions.numberedList,
    RichTextBubbleMenuOptions.taskList,
  ]
  if (!isFormField.value || blockOptions.some((o) => !hiddenOptions.value.includes(o))) {
    entries.push({ type: 'divider', key: 'div3' })
  }

  // ── Insert: Link, Image, Table ──
  if (isOptionVisible(RichTextBubbleMenuOptions.link)) {
    entries.push({ type: 'link', key: 'link' })
  }

  if (isOptionVisible(RichTextBubbleMenuOptions.image)) {
    entries.push({ type: 'image', key: 'image' })
  }

  if (isOptionVisible(RichTextBubbleMenuOptions.table)) {
    entries.push(
      btn(
        'table',
        'table',
        t('objects.table'),
        'table',
        () => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        {
          disableOnCodeBlock: false,
        },
      ),
    )
  }

  // ── Close ──
  if (enableCloseButton.value) {
    entries.push({ type: 'close', key: 'close' })
  }

  return entries
})
</script>

<template>
  <div
    class="bubble-menu flex-row gap-x-1 rounded-lg"
    :class="{
      'nc-form-field-bubble-menu inline-flex py-0': isFormField,
      'flex bg-nc-bg-gray-light px-1 py-1': !isFormField,
      'embed-mode': embedMode,
      'full-mode': !embedMode,
      'edit-column-mode': isEditColumn,
    }"
  >
    <template v-for="entry in menuEntries" :key="entry.key">
      <!-- Standard button -->
      <NcTooltip v-if="entry.type === 'button'" :placement="tooltipPlacement" :disabled="entry.disabled()">
        <template #title>
          <div class="flex flex-col items-center">
            <div>{{ entry.tooltip }}</div>
            <div v-if="entry.shortcut">{{ entry.shortcut }}</div>
          </div>
        </template>
        <NcButton
          size="small"
          type="text"
          :class="{ 'is-active': entry.isActive() }"
          :disabled="entry.disabled()"
          :tabindex="tabIndex"
          @click="entry.action"
        >
          <GeneralIcon :icon="entry.icon" />
        </NcButton>
      </NcTooltip>

      <!-- Divider -->
      <div v-else-if="entry.type === 'divider'" class="divider" />

      <!-- Color picker -->
      <template v-else-if="entry.type === 'colorPicker'">
        <NcTooltip :disabled="editor.isActive('codeBlock') || showColorPicker">
          <template #title> {{ $t('general.color') }} </template>
          <NcButton
            size="small"
            type="text"
            class="nc-highlight-btn"
            :class="{ 'is-active': activeHighlightColor || activeTextColor }"
            :disabled="editor.isActive('codeBlock')"
            @click="showColorPicker = !showColorPicker"
          >
            <span
              class="nc-color-btn-preview"
              :style="{
                color: activeTextColor || 'var(--nc-content-gray)',
                backgroundColor: activeHighlightColor || 'transparent',
                borderColor: activeHighlightColor || 'var(--nc-border-gray-medium)',
              }"
              >A</span
            >
          </NcButton>
        </NcTooltip>
        <div v-if="showColorPicker" class="nc-color-picker-dropdown" @mousedown.prevent>
          <template v-if="recentColors.length">
            <div class="nc-color-picker-label">{{ $t('labels.recentlyUsed') }}</div>
            <div class="nc-color-picker-grid">
              <button
                v-for="(r, idx) in recentColors"
                :key="idx"
                class="nc-color-swatch"
                :class="{
                  'is-active': r.type === 'text' ? activeTextColor === r.color : activeHighlightColor === r.color,
                }"
                :style="
                  r.type === 'text'
                    ? { borderColor: `color-mix(in srgb, ${r.color} 30%, transparent)` }
                    : { backgroundColor: r.color, borderColor: r.color }
                "
                :title="r.type === 'text' ? $t('labels.textColor') : $t('labels.backgroundColor')"
                @click="applyRecent(r)"
              >
                <span v-if="r.type === 'text'" class="nc-color-swatch-letter" :style="{ color: r.color }">A</span>
              </button>
            </div>
          </template>
          <div class="nc-color-picker-label">{{ $t('labels.textColor') }}</div>
          <div class="nc-color-picker-grid">
            <button
              v-for="tc in textColors"
              :key="tc.color"
              class="nc-color-swatch"
              :class="{ 'is-active': tc.color !== '#1f2937' && activeTextColor === tc.color }"
              :style="{ borderColor: `color-mix(in srgb, ${tc.color} 30%, transparent)` }"
              :title="tc.name"
              @click="applyTextColor(tc.color)"
            >
              <span class="nc-color-swatch-letter" :style="{ color: tc.color }">A</span>
            </button>
          </div>
          <div class="nc-color-picker-label">{{ $t('labels.backgroundColor') }}</div>
          <div class="nc-color-picker-grid">
            <button
              v-for="b in bgColors"
              :key="b.color || 'none'"
              class="nc-color-swatch"
              :class="{ 'is-active': b.color && activeHighlightColor === b.color }"
              :style="b.color ? { backgroundColor: b.color, borderColor: b.color } : {}"
              :title="b.name"
              @click="applyBgColor(b.color)"
            />
          </div>
        </div>
      </template>

      <!-- Link -->
      <NcTooltip v-else-if="entry.type === 'link'" :placement="tooltipPlacement" :disabled="editor.isActive('codeBlock')">
        <template #title> {{ $t('general.link') }}</template>
        <NcButton
          size="small"
          type="text"
          :class="{ 'is-active': editor.isActive('link') }"
          :disabled="editor.isActive('codeBlock')"
          :tabindex="tabIndex"
          @click="onToggleLink"
        >
          <GeneralIcon v-if="isFormField" icon="link2" />
          <div v-else class="flex flex-row items-center px-0.5">
            <GeneralIcon icon="link2" />
            <div class="!text-xs !ml-1">{{ $t('general.link') }}</div>
          </div>
        </NcButton>
      </NcTooltip>

      <!-- Image -->
      <CellRichTextImageMenu
        v-else-if="entry.type === 'image'"
        :placement="tooltipPlacement"
        :editor="editor"
        :tab-index="tabIndex"
      />

      <!-- Mention -->
      <NcTooltip v-else-if="entry.type === 'mention'">
        <template #title>
          <div class="flex flex-col items-center">
            <div>{{ $t('labels.mention') }}</div>
            <div>@</div>
          </div>
        </template>
        <NcButton
          size="small"
          type="text"
          :class="{ 'is-active': editor?.isActive('suggestions') }"
          :tabindex="tabIndex"
          @click="newMentionNode"
        >
          <GeneralIcon icon="atSign" />
        </NcButton>
      </NcTooltip>

      <!-- Close -->
      <div v-else-if="entry.type === 'close'" class="!sticky right-0 pr-0.5 bg-nc-bg-default">
        <NcButton type="text" size="small" @click="emits('close')">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>
    </template>
  </div>
</template>

<style lang="scss">
.bubble-menu-hidden {
  [data-tippy-root] {
    opacity: 0;
    height: 0;
    overflow: hidden;
    z-index: -1;
    user-select: none;
  }
}

.bubble-text-format-button-icon {
  @apply px-1.5 py-0 border-1 border-nc-border-gray-dark rounded-sm items-center justify-center;
  font-size: 0.8rem;
  font-weight: 600;
}
.bubble-text-format-button {
  @apply rounded-md py-1 my-0 pl-2.5 pr-3 cursor-pointer items-center gap-x-2.5 hover:bg-nc-bg-gray-light;
}

.bubble-menu.full-mode {
  @apply border-nc-border-gray-light
  box-shadow: 0px 0px 1.2rem 0 rgb(230, 230, 230) !important;
}

.bubble-menu.embed-mode:not(.nc-form-field-bubble-menu) {
  @apply border-transparent !shadow-none;
}
.bubble-menu.form-field-mode {
  @apply bg-transparent px-0;
}

.embed-mode.bubble-menu:not(.nc-form-field-bubble-menu) {
  @apply !py-0 !my-0 !border-0;

  .divider {
    @apply my-0 !h-11 border-nc-border-gray-light;
  }

  .nc-button {
    @apply !mt-1.65;
  }
}

.bubble-menu {
  // shadow
  @apply bg-nc-bg-default;
  position: relative;
  border-width: 1px;

  &.nc-form-field-bubble-menu {
    .divider {
      @apply border-r-1 border-nc-border-gray-medium my-0;
    }
  }

  .nc-button.is-active {
    @apply !hover:outline-nc-gray-200 bg-nc-bg-gray-light text-nc-content-brand hover:text-nc-content-brand;
    outline: 1px;
  }
  &:not(.nc-form-field-bubble-menu) {
    .divider {
      @apply border-r-1 border-nc-border-gray-medium !h-6 !mx-0.5 my-1;
    }
  }
  .ant-select-selector {
    @apply !rounded-md;
  }
  .ant-select-selector .ant-select-selection-item {
    @apply !text-xs;
  }
  .ant-btn-loading-icon {
    @apply pb-0.5;
  }
}

.nc-color-btn-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1.5px solid;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}

/* ── Color picker dropdown ─────────────────────────────── */

.nc-color-picker-dropdown {
  position: absolute;
  bottom: 0;
  transform: translateY(calc(100% + 4px));
  background: var(--nc-bg-default);
  border: 1px solid var(--nc-border-gray-medium);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  z-index: 10;
  width: 196px;
}

.nc-color-picker-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--nc-content-gray-subtle);
  margin-bottom: 6px;
  margin-top: 10px;

  &:first-child {
    margin-top: 0;
  }
}

.nc-color-picker-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.nc-color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1.5px solid var(--nc-border-gray-medium);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--nc-bg-default);
  transition: border-color 0.1s, transform 0.1s;
  padding: 0;

  &:hover {
    transform: scale(1.08);
    border-color: var(--nc-content-gray-subtle);
  }

  &.is-active {
    border-color: var(--nc-content-gray);
    border-width: 2px;
  }
}

.nc-color-swatch-letter {
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}
</style>
