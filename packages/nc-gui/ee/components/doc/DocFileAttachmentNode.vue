<script setup lang="ts">
/**
 * NodeView component for doc editor file attachments.
 *
 * Renders a card with:
 * - Colored file type badge (e.g. "PNG", "PDF", "DOCX")
 * - File name (truncated)
 * - File size (human-readable)
 * - Download on click (when path is available)
 * - Delete button on hover/selection
 */
import { NodeViewWrapper } from '@tiptap/vue-3'
import { formatFileSize } from '~/utils/attachmentUtils'

const props = defineProps<{
  node: any
  updateAttributes: (attrs: Record<string, any>) => void
  deleteNode: () => void
  selected: boolean
  editor: any
}>()

const { getPossibleAttachmentSrc } = useAttachment()

/** Extract short file extension label from MIME type or file name. */
const fileExtLabel = computed(() => {
  const { fileName, fileType } = props.node.attrs

  // Try extension from filename first
  if (fileName) {
    const parts = fileName.split('.')
    if (parts.length > 1) {
      return parts.pop()!.toUpperCase()
    }
  }

  // Fallback: derive from MIME type
  if (fileType) {
    const sub = fileType.split('/')[1] || ''
    // Clean up common MIME subtypes
    const clean = sub
      .replace(/^x-/, '')
      .replace(/^vnd\.openxmlformats-officedocument\.\w+\./, '')
      .replace(/^vnd\.ms-/, '')
      .replace(/^vnd\./, '')
    return clean.toUpperCase().slice(0, 6)
  }

  return 'FILE'
})

/** Badge color based on file type category. */
const badgeColor = computed(() => {
  const ext = fileExtLabel.value.toLowerCase()

  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
    return { bg: '#dbeafe', text: '#2563eb' } // blue
  }
  // PDFs
  if (ext === 'pdf') {
    return { bg: '#fee2e2', text: '#dc2626' } // red
  }
  // Spreadsheets
  if (['xls', 'xlsx', 'csv', 'tsv', 'sheet'].includes(ext)) {
    return { bg: '#dcfce7', text: '#16a34a' } // green
  }
  // Documents
  if (['doc', 'docx', 'document', 'txt', 'rtf', 'md'].includes(ext)) {
    return { bg: '#dbeafe', text: '#2563eb' } // blue
  }
  // Presentations
  if (['ppt', 'pptx', 'presentation'].includes(ext)) {
    return { bg: '#ffedd5', text: '#ea580c' } // orange
  }
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { bg: '#fef9c3', text: '#a16207' } // yellow
  }
  // Code
  if (['js', 'ts', 'py', 'json', 'html', 'css', 'xml', 'yaml', 'yml'].includes(ext)) {
    return { bg: '#f3e8ff', text: '#7c3aed' } // purple
  }
  // Default
  return { bg: '#f3f4f6', text: '#6b7280' } // gray
})

const formattedSize = computed(() => {
  const size = props.node.attrs.fileSize
  if (!size) return ''
  return formatFileSize(size)
})

const isUploading = computed(() => {
  // Still uploading if no permanent path yet but we have a blob src
  const { path, src } = props.node.attrs
  return !path && src?.startsWith('blob:')
})

/** Download the file when clicked (only if upload is complete). */
const onDownload = () => {
  const { path, src, fileName } = props.node.attrs
  if (isUploading.value) return

  let url = ''
  if (path) {
    const sources = getPossibleAttachmentSrc({ path })
    url = sources[0] || ''
  } else if (src) {
    url = src
  }

  if (!url) return

  const a = document.createElement('a')
  a.href = url
  a.download = fileName || 'download'
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.click()
}
</script>

<template>
  <NodeViewWrapper class="nc-file-attachment-wrapper" data-drag-handle>
    <div
      class="nc-file-attachment-card"
      :class="{
        'nc-file-attachment-selected': selected,
        'nc-file-attachment-uploading': isUploading,
      }"
      @click="onDownload"
    >
      <!-- File type badge -->
      <div
        class="nc-file-attachment-badge"
        :style="{ backgroundColor: badgeColor.bg, color: badgeColor.text }"
      >
        {{ fileExtLabel }}
      </div>

      <!-- File info -->
      <div class="nc-file-attachment-info">
        <div class="nc-file-attachment-name" :title="node.attrs.fileName">
          {{ node.attrs.fileName || 'Untitled' }}
        </div>
        <div v-if="formattedSize" class="nc-file-attachment-size">
          {{ formattedSize }}
        </div>
      </div>

      <!-- Upload spinner -->
      <div v-if="isUploading" class="nc-file-attachment-spinner">
        <GeneralLoader size="small" />
      </div>

      <!-- Delete button (on hover) -->
      <div
        v-else-if="editor?.isEditable"
        class="nc-file-attachment-delete"
        @click.stop="deleteNode"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
    </div>
  </NodeViewWrapper>
</template>
