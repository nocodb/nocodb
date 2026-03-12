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

// Recently used — kept for current session
const recentColors = ref<Array<{ type: 'text' | 'bg'; color: string }>>([])
const MAX_RECENT = 5

const addRecent = (type: 'text' | 'bg', color: string) => {
  if (!color) return
  const entry = { type, color }
  recentColors.value = [entry, ...recentColors.value.filter((r) => !(r.type === type && r.color === color))].slice(
    0,
    MAX_RECENT,
  )
}

// Active state
const activeTextColor = computed(() => {
  for (const t of textColors) {
    if (t.color === '#1f2937') continue // skip default
    if (editor.value?.isActive('textColor', { color: t.color })) return t.color
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

// Dismiss dropdown on any click outside the button / dropdown
const onDocClick = (e: MouseEvent) => {
  if (!showColorPicker.value) return
  const hit = (e.target as HTMLElement)?.closest?.('.nc-color-picker-dropdown, .nc-highlight-btn')
  if (!hit) showColorPicker.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))

const { appInfo } = useGlobal()

const isEditColumn = inject(EditColumnInj, ref(false))

const cmdOrCtrlKey = computed(() => {
  return isMac() ? '⌘' : 'CTRL'
})

const shiftKey = computed(() => {
  return isMac() ? '⇧' : 'Shift'
})

const altKey = computed(() => {
  return isMac() ? '⌥' : 'Alt'
})

const tooltipPlacement = computed(() => {
  if (isFormField.value) return 'bottom'
})

const tabIndex = computed(() => {
  return isFormField.value ? -1 : 0
})

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

const isOptionVisible = (option: RichTextBubbleMenuOptions) => {
  if (option === RichTextBubbleMenuOptions.image && editor.value?.storage?.markdown?.options?.renderImagesAsLinks) {
    return false
  }

  if (hiddenOptions.value.includes(option)) return false

  return true
}

const showDivider = (options: RichTextBubbleMenuOptions[]) => {
  return !isFormField.value || options.some((o) => !hiddenOptions.value.includes(o))
}

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

const closeTextArea = () => {
  emits('close')
}
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
    <NcTooltip :placement="tooltipPlacement" :disabled="editor.isActive('codeBlock')">
      <template #title>
        <div class="flex flex-col items-center">
          <div>
            {{ $t('labels.bold') }}
          </div>
          <div class="text-xs">{{ cmdOrCtrlKey }} B</div>
        </div>
      </template>
      <NcButton
        size="small"
        type="text"
        :class="{ 'is-active': editor.isActive('bold') }"
        :disabled="editor.isActive('codeBlock')"
        :tabindex="tabIndex"
        @click="editor!.chain().focus().toggleBold().run()"
      >
        <GeneralIcon icon="bold" />
      </NcButton>
    </NcTooltip>
    <NcTooltip :placement="tooltipPlacement" :disabled="editor.isActive('codeBlock')">
      <template #title>
        <div class="flex flex-col items-center">
          <div>
            {{ $t('labels.italic') }}
          </div>
          <div>{{ cmdOrCtrlKey }} I</div>
        </div>
      </template>
      <NcButton
        size="small"
        type="text"
        :disabled="editor.isActive('codeBlock')"
        :class="{ 'is-active': editor.isActive('italic') }"
        :tabindex="tabIndex"
        @click=";(editor!.chain().focus() as any).toggleItalic().run()"
      >
        <GeneralIcon icon="italic" />
      </NcButton>
    </NcTooltip>
    <NcTooltip :placement="tooltipPlacement" :disabled="editor.isActive('codeBlock')">
      <template #title>
        <div class="flex flex-col items-center">
          <div>
            {{ $t('labels.underline') }}
          </div>
          <div>{{ cmdOrCtrlKey }} U</div>
        </div>
      </template>

      <NcButton
        size="small"
        type="text"
        :class="{ 'is-active': editor.isActive('underline') }"
        :disabled="editor.isActive('codeBlock')"
        :tabindex="tabIndex"
        @click="editor!.chain().focus().toggleUnderline().run()"
      >
        <GeneralIcon icon="underline" />
      </NcButton>
    </NcTooltip>
    <NcTooltip v-if="embedMode && !isEditColumn" :placement="tooltipPlacement" :disabled="editor.isActive('codeBlock')">
      <template #title>
        <div class="flex flex-col items-center">
          <div>
            {{ $t('labels.strike') }}
          </div>
          <div>{{ shiftKey }} {{ cmdOrCtrlKey }} S</div>
        </div>
      </template>
      <NcButton
        size="small"
        type="text"
        :class="{ 'is-active': editor.isActive('strike') }"
        :disabled="editor.isActive('codeBlock')"
        :tabindex="tabIndex"
        @click="editor!.chain().focus().toggleStrike().run()"
      >
        <GeneralIcon icon="strike" />
      </NcButton>
    </NcTooltip>
    <!-- Color picker button — doc editor (embedMode) only -->
    <NcTooltip v-if="embedMode && !isEditColumn" :disabled="editor.isActive('codeBlock') || showColorPicker">
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
        >A</span>
      </NcButton>
    </NcTooltip>
    <!-- Color picker dropdown -->
    <div v-if="embedMode && showColorPicker" class="nc-color-picker-dropdown" @mousedown.prevent>
      <!-- Recently used -->
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
            :style="r.type === 'text'
              ? { borderColor: `color-mix(in srgb, ${r.color} 30%, transparent)` }
              : { backgroundColor: r.color, borderColor: r.color }"
            :title="r.type === 'text' ? $t('labels.textColor') : $t('labels.backgroundColor')"
            @click="applyRecent(r)"
          >
            <span
              v-if="r.type === 'text'"
              class="nc-color-swatch-letter"
              :style="{ color: r.color }"
            >A</span>
          </button>
        </div>
      </template>

      <!-- Text color -->
      <div class="nc-color-picker-label">{{ $t('labels.textColor') }}</div>
      <div class="nc-color-picker-grid">
        <button
          v-for="t in textColors"
          :key="t.color"
          class="nc-color-swatch"
          :class="{ 'is-active': t.color !== '#1f2937' && activeTextColor === t.color }"
          :style="{ borderColor: `color-mix(in srgb, ${t.color} 30%, transparent)` }"
          :title="t.name"
          @click="applyTextColor(t.color)"
        >
          <span class="nc-color-swatch-letter" :style="{ color: t.color }">A</span>
        </button>
      </div>

      <!-- Background color -->
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

    <NcTooltip
      v-if="isFormField ? isOptionVisible(RichTextBubbleMenuOptions.quote) : !embedMode"
      :placement="tooltipPlacement"
      :disabled="editor.isActive('codeBlock')"
    >
      <template #title> {{ $t('general.code') }}</template>
      <NcButton
        size="small"
        type="text"
        :tabindex="tabIndex"
        :class="{ 'is-active': editor.isActive('code') }"
        :disabled="editor.isActive('codeBlock')"
        @click="editor!.chain().focus().toggleCode().run()"
      >
        <GeneralIcon icon="code" />
      </NcButton>
    </NcTooltip>
    <NcTooltip v-if="embedMode && isOptionVisible(RichTextBubbleMenuOptions.code)" :placement="tooltipPlacement">
      <template #title> {{ $t('general.codeBlock') }}</template>
      <NcButton
        size="small"
        type="text"
        :tabindex="tabIndex"
        :class="{ 'is-active': editor.isActive('codeBlock') }"
        @click="editor!.chain().focus().toggleCodeBlock().run()"
      >
        <GeneralIcon icon="ncCodeBlock" />
      </NcButton>
    </NcTooltip>

    <div class="divider"></div>

    <template v-if="embedMode && !isFormField">
      <NcTooltip>
        <template #title>
          <div class="flex flex-col items-center">
            <div>
              {{ $t('labels.heading1') }}
            </div>
            <div>{{ cmdOrCtrlKey }} {{ altKey }} 1</div>
          </div>
        </template>
        <NcButton
          size="small"
          type="text"
          :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }"
          @click="editor!.chain().focus().toggleHeading({ level: 1 }).run()"
        >
          <GeneralIcon icon="ncHeading1" />
        </NcButton>
      </NcTooltip>
      <NcTooltip>
        <template #title>
          <div class="flex flex-col items-center">
            <div>
              {{ $t('labels.heading2') }}
            </div>
            <div>{{ cmdOrCtrlKey }} {{ altKey }} 2</div>
          </div>
        </template>
        <NcButton
          size="small"
          type="text"
          :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }"
          @click="editor!.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          <GeneralIcon icon="ncHeading2" />
        </NcButton>
      </NcTooltip>
      <NcTooltip>
        <template #title>
          <div class="flex flex-col items-center">
            <div>
              {{ $t('labels.heading3') }}
            </div>
            <div>{{ cmdOrCtrlKey }} {{ altKey }} 3</div>
          </div>
        </template>
        <NcButton
          size="small"
          type="text"
          :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }"
          @click="editor!.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          <GeneralIcon icon="ncHeading3" />
        </NcButton>
      </NcTooltip>

      <div class="divider"></div>
    </template>

    <NcTooltip
      v-if="embedMode && !isEditColumn && isOptionVisible(RichTextBubbleMenuOptions.blockQuote)"
      :placement="tooltipPlacement"
    >
      <template #title> {{ $t('labels.blockQuote') }}</template>
      <NcButton
        size="small"
        type="text"
        :tabindex="tabIndex"
        :class="{ 'is-active': editor.isActive('blockquote') }"
        @click="editor!.chain().focus().toggleBlockquote().run()"
      >
        <GeneralIcon icon="ncQuote" />
      </NcButton>
    </NcTooltip>

    <NcTooltip v-if="isOptionVisible(RichTextBubbleMenuOptions.bulletList)" :placement="tooltipPlacement">
      <template #title> {{ $t('labels.bulletList') }}</template>
      <NcButton
        size="small"
        type="text"
        :tabindex="tabIndex"
        :class="{ 'is-active': editor.isActive('bulletList') }"
        @click="editor!.chain().focus().toggleBulletList().run()"
      >
        <GeneralIcon icon="ncList" />
      </NcButton>
    </NcTooltip>

    <NcTooltip v-if="isOptionVisible(RichTextBubbleMenuOptions.numberedList)" :placement="tooltipPlacement">
      <template #title> {{ $t('labels.numberedList') }}</template>
      <NcButton
        size="small"
        type="text"
        :tabindex="tabIndex"
        :class="{ 'is-active': editor.isActive('orderedList') }"
        @click="editor!.chain().focus().toggleOrderedList().run()"
      >
        <GeneralIcon icon="ncNumberList" />
      </NcButton>
    </NcTooltip>

    <NcTooltip v-if="isOptionVisible(RichTextBubbleMenuOptions.taskList)" :placement="tooltipPlacement">
      <template #title> {{ $t('labels.taskList') }}</template>
      <NcButton
        size="small"
        type="text"
        :tabindex="tabIndex"
        :class="{ 'is-active': editor.isActive('taskList') }"
        @click="editor!.chain().focus().toggleTaskList().run()"
      >
        <GeneralIcon icon="ncCheckList" />
      </NcButton>
    </NcTooltip>

    <NcTooltip v-if="appInfo.ee && !props.hideMention">
      <template #title>
        <div class="flex flex-col items-center">
          <div>
            {{ $t('labels.mention') }}
          </div>
          <div>@</div>
        </div>
      </template>
      <NcButton
        size="small"
        :class="{ 'is-active': editor?.isActive('suggestions') }"
        :tabindex="tabIndex"
        type="text"
        @click="newMentionNode"
      >
        <GeneralIcon icon="atSign" />
      </NcButton>
    </NcTooltip>

    <div
      v-if="
        showDivider([
          RichTextBubbleMenuOptions.blockQuote,
          RichTextBubbleMenuOptions.bulletList,
          RichTextBubbleMenuOptions.numberedList,
          RichTextBubbleMenuOptions.taskList,
        ])
      "
      class="divider"
    ></div>

    <NcTooltip
      v-if="isOptionVisible(RichTextBubbleMenuOptions.link)"
      :placement="tooltipPlacement"
      :disabled="editor.isActive('codeBlock')"
    >
      <template #title> {{ $t('general.link') }}</template>
      <NcButton
        size="small"
        type="text"
        :class="{ 'is-active': editor.isActive('link') }"
        :disabled="editor.isActive('codeBlock')"
        :tabindex="tabIndex"
        @click="onToggleLink"
      >
        <GeneralIcon v-if="isFormField" icon="link2"></GeneralIcon>
        <div v-else class="flex flex-row items-center px-0.5">
          <GeneralIcon icon="link2"></GeneralIcon>
          <div class="!text-xs !ml-1">{{ $t('general.link') }}</div>
        </div>
      </NcButton>
    </NcTooltip>
    <CellRichTextImageMenu
      v-if="isOptionVisible(RichTextBubbleMenuOptions.image)"
      :placement="tooltipPlacement"
      :editor="editor"
      :tab-index="tabIndex"
    />

    <NcTooltip v-if="isOptionVisible(RichTextBubbleMenuOptions.table)" :placement="tooltipPlacement">
      <template #title> {{ $t('objects.table') }} </template>
      <NcButton
        size="small"
        type="text"
        :tabindex="tabIndex"
        :class="{ 'is-active': editor.isActive('table') }"
        @click="editor!.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"
      >
        <GeneralIcon icon="table" />
      </NcButton>
    </NcTooltip>

    <div v-if="enableCloseButton" class="!sticky right-0 pr-0.5 bg-nc-bg-default">
      <NcButton type="text" size="small" @click="closeTextArea">
        <GeneralIcon icon="close" />
      </NcButton>
    </div>
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
