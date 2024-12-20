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
  if (isFormField.value) return !hiddenOptions.value.includes(option)

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
      'flex bg-gray-100 px-1 py-1': !isFormField,
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

    <div v-if="enableCloseButton" class="!sticky right-0 pr-0.5 bg-white">
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
  @apply px-1.5 py-0 border-1 border-gray-300 rounded-sm items-center justify-center;
  font-size: 0.8rem;
  font-weight: 600;
}
.bubble-text-format-button {
  @apply rounded-md py-1 my-0 pl-2.5 pr-3 cursor-pointer items-center gap-x-2.5 hover:bg-gray-100;
}

.bubble-menu.full-mode {
  @apply border-gray-100
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
    @apply my-0 !h-11 border-gray-100;
  }

  .nc-button {
    @apply !mt-1.65;
  }
}

.bubble-menu {
  // shadow
  @apply bg-white;
  border-width: 1px;

  &.nc-form-field-bubble-menu {
    .divider {
      @apply border-r-1 border-gray-200 my-0;
    }
  }

  .nc-button.is-active {
    @apply !hover:outline-gray-200 bg-gray-100 text-brand-500;
    outline: 1px;
  }
  &:not(.nc-form-field-bubble-menu) {
    .divider {
      @apply border-r-1 border-gray-200 !h-6 !mx-0.5 my-1;
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
</style>
