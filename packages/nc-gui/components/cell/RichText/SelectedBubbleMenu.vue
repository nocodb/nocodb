<script lang="ts" setup>
import type { AttachmentType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { Editor } from '@tiptap/vue-3'
import { NOCO } from '~/lib/constants'
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
const { base } = storeToRefs(useBase())
const { getPossibleAttachmentSrc, batchUploadFiles } = useAttachment()

const isEditColumn = inject(EditColumnInj, ref(false))
const column = inject(ColumnInj, ref())
const meta = inject(MetaInj, ref())
const row = inject(RowInj, ref())

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

const mediaMenuVisible = ref(false)
const isUploadingMedia = ref(false)
const mediaFileInputRef = ref<HTMLInputElement | null>(null)

const storagePath = computed(() => {
  if (!base.value?.id || !meta.value?.id || !column.value?.id) return null
  return [NOCO, base.value.id, meta.value.id, column.value.id].join('/')
})

const currentRowData = computed<Record<string, any> | null>(() => {
  return row.value?.row || null
})

const attachmentColumns = computed(() => meta.value?.columns?.filter((col) => col.uidt === UITypes.Attachment) ?? [])

type MediaAttachmentType = 'image' | 'video' | 'audio' | 'pdf' | 'file'
interface MediaAttachmentOption {
  id: string
  columnTitle: string
  attachment: AttachmentType
  url: string
  type: MediaAttachmentType
}

const mediaOptions = computed<MediaAttachmentOption[]>(() => {
  if (!currentRowData.value) return []

  const items: MediaAttachmentOption[] = []

  for (const attachmentColumn of attachmentColumns.value) {
    const rawValue = currentRowData.value[attachmentColumn.title]
    const attachments = parseAttachmentValue(rawValue)

    attachments.forEach((attachment, index) => {
      const url = getPossibleAttachmentSrc(attachment)?.[0]
      if (!url) return

      items.push({
        id: `${attachmentColumn.id}-${index}`,
        columnTitle: attachmentColumn.title,
        attachment,
        url,
        type: detectAttachmentType(attachment),
      })
    })
  }

  return items
})

const canUploadMedia = computed(() => !!storagePath.value)

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

function onMediaButtonClick() {
  mediaMenuVisible.value = true
}

function triggerFilePicker() {
  if (!canUploadMedia.value) {
    message.error(t('richText.mediaUploadUnavailable'))
    return
  }
  mediaFileInputRef.value?.click()
}

function resetFileInput() {
  if (mediaFileInputRef.value) {
    mediaFileInputRef.value.value = ''
  }
}

async function handleMediaFilesSelected(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target?.files ? Array.from(target.files) : []
  resetFileInput()
  if (!files.length) return

  await uploadAndInsertFiles(files)
}

async function uploadAndInsertFiles(files: File[]) {
  if (!storagePath.value) {
    message.error(t('richText.mediaUploadUnavailable'))
    return
  }

  try {
    isUploadingMedia.value = true
    const uploaded = await batchUploadFiles(files, storagePath.value)
    insertMediaFromAttachments(uploaded)
    mediaMenuVisible.value = false
  } catch (error) {
    message.error((await extractSdkResponseErrorMsg(error)) || t('msg.error.internalError'))
  } finally {
    isUploadingMedia.value = false
  }
}

function insertMediaFromAttachments(attachments: AttachmentType[]) {
  attachments.forEach((attachment) => {
    const url = getPossibleAttachmentSrc(attachment)?.[0]
    if (!url) return

    insertAttachmentContent(attachment, url, detectAttachmentType(attachment))
  })
}

function insertAttachmentContent(attachment: AttachmentType, url: string, type: MediaAttachmentType) {
  if (!editor.value) return

  const safeUrl = escapeHtml(url)
  const label = escapeHtml(attachment?.title || attachment?.fileName || t('richText.unnamedFile'))

  const chain = editor.value.chain().focus()

  if (type === 'image') {
    chain.setImage({ src: url, alt: label }).run()
    return
  }

  if (type === 'video') {
    chain
      .insertContent(
        `<figure class="nc-rich-text-media-block"><video controls class="nc-rich-text-video" src="${safeUrl}" data-filename="${label}"></video><figcaption>${label}</figcaption></figure>`,
      )
      .run()
    return
  }

  if (type === 'audio') {
    chain
      .insertContent(
        `<div class="nc-rich-text-media-block"><audio controls src="${safeUrl}" data-filename="${label}"></audio><div class="nc-rich-text-media-label">${label}</div></div>`,
      )
      .run()
    return
  }

  if (type === 'pdf') {
    chain
      .insertContent(
        `<div class="nc-rich-text-media-block"><iframe class="nc-rich-text-pdf" src="${safeUrl}" title="${label}"></iframe><div class="nc-rich-text-media-label">${label}</div></div>`,
      )
      .run()
    return
  }

  chain.insertContent(`<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`).run()
}

function onSelectExistingAttachment(option: MediaAttachmentOption) {
  insertAttachmentContent(option.attachment, option.url, option.type)
  mediaMenuVisible.value = false
}

function parseAttachmentValue(value: any): AttachmentType[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function detectAttachmentType(attachment: AttachmentType): MediaAttachmentType {
  const mime = (attachment?.mimetype || attachment?.type || '').toLowerCase()
  const title = (attachment?.title || attachment?.fileName || '').toLowerCase()

  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|bmp|svg|webp|avif)$/.test(title)) return 'image'
  if (mime.startsWith('video/') || /\.(mp4|mov|webm|mkv|ogg)$/i.test(title)) return 'video'
  if (mime.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac)$/i.test(title)) return 'audio'
  if (mime === 'application/pdf' || title.endsWith('.pdf')) return 'pdf'
  return 'file'
}

function mediaIcon(type: MediaAttachmentType) {
  if (type === 'image') return 'image'
  if (type === 'video') return 'ncPlayCircle'
  return 'paperclip'
}

function escapeHtml(value = '') {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
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

    <NcTooltip v-if="isOptionVisible(RichTextBubbleMenuOptions.media)">
      <template #title>
        <div class="flex flex-col items-center">
          <div>{{ $t('richText.insertMedia') }}</div>
        </div>
      </template>
      <NcDropdown
        v-model:visible="mediaMenuVisible"
        :trigger="['click']"
        placement="bottomLeft"
        :auto-close="false"
        overlay-class-name="!p-0 !bg-transparent"
      >
        <NcButton size="small" type="text" :tabindex="tabIndex" class="nc-media-dropdown-trigger" @click="onMediaButtonClick">
          <div class="flex flex-row items-center px-0.5">
            <GeneralIcon icon="image" class="mr-1" />
            <div class="!text-xs">{{ $t('richText.media') }}</div>
          </div>
        </NcButton>
        <template #overlay>
          <div class="nc-rich-text-media-menu" @click.stop>
            <div class="nc-rich-text-media-section">
              <div class="nc-rich-text-media-section-title">
                {{ $t('richText.uploadSection') }}
              </div>
              <NcButton block size="small" type="secondary" :loading="isUploadingMedia" @click.stop="triggerFilePicker">
                <template v-if="isUploadingMedia">
                  {{ $t('labels.uploading') }}
                </template>
                <template v-else>
                  {{ $t('richText.uploadFiles') }}
                </template>
              </NcButton>
              <p class="nc-rich-text-media-hint">
                {{ $t('richText.uploadDescription') }}
              </p>
            </div>

            <div class="nc-rich-text-media-section">
              <div class="nc-rich-text-media-section-title">
                {{ $t('richText.fromAttachments') }}
              </div>
              <div v-if="!mediaOptions.length" class="nc-rich-text-media-empty">
                {{ $t('richText.noAttachments') }}
              </div>
              <div v-else class="nc-rich-text-media-list">
                <button
                  v-for="option in mediaOptions"
                  :key="option.id"
                  type="button"
                  class="nc-rich-text-media-option"
                  @click="onSelectExistingAttachment(option)"
                >
                  <GeneralIcon :icon="mediaIcon(option.type)" class="nc-rich-text-media-option-icon" />
                  <div class="nc-rich-text-media-option-text">
                    <span class="title">{{
                      option.attachment.title || option.attachment.fileName || $t('richText.unnamedFile')
                    }}</span>
                    <span class="column">{{ option.columnTitle }}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </template>
      </NcDropdown>
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

    <div v-if="enableCloseButton" class="!sticky right-0 pr-0.5 bg-nc-bg-default">
      <NcButton type="text" size="small" @click="closeTextArea">
        <GeneralIcon icon="close" />
      </NcButton>
    </div>

    <input
      ref="mediaFileInputRef"
      class="hidden"
      type="file"
      multiple
      accept="image/*,video/*,audio/*,application/pdf"
      @change="handleMediaFilesSelected"
    />
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
  border-width: 1px;

  &.nc-form-field-bubble-menu {
    .divider {
      @apply border-r-1 border-nc-border-gray-medium my-0;
    }
  }

  .nc-button.is-active {
    @apply !hover:outline-nc-gray-200 bg-nc-bg-gray-light text-nc-content-brand;
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

.nc-rich-text-media-menu {
  @apply w-64 p-3 bg-white rounded-lg shadow-lg flex flex-col gap-3;

  .nc-rich-text-media-section {
    @apply flex flex-col gap-2;
  }

  .nc-rich-text-media-section-title {
    @apply text-2xs font-semibold text-gray-500 uppercase;
  }

  .nc-rich-text-media-hint {
    @apply text-2xs text-gray-400;
  }

  .nc-rich-text-media-list {
    @apply max-h-48 overflow-y-auto flex flex-col gap-2;
  }

  .nc-rich-text-media-empty {
    @apply text-xs text-gray-400 py-2;
  }

  .nc-rich-text-media-option {
    @apply flex items-center gap-2 px-2 py-1 rounded-md border border-transparent hover:border-gray-200 hover:bg-gray-50 text-left;
  }

  .nc-rich-text-media-option-icon {
    @apply text-gray-500 h-4 w-4;
  }

  .nc-rich-text-media-option-text {
    @apply flex flex-col leading-tight min-w-0;

    .title {
      @apply text-xs font-medium truncate;
    }

    .column {
      @apply text-2xs text-gray-400;
    }
  }
}
</style>
