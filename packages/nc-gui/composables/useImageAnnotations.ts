import type { AttachmentType, CommentAnnotationRegion, CommentImageAnnotation, CommentType } from 'nocodb-sdk'
import { getAttachmentAnnotationKey, ncIsString } from 'nocodb-sdk'

export interface AnnotationMarker {
  commentId: string
  /** Display label — A, B, C, … assigned per attachment in creation order. */
  label: string
  region: CommentAnnotationRegion
}

export interface AnnotationDraft {
  region: CommentAnnotationRegion
  /** Container-local pixel anchor for positioning the comment popup. */
  anchor: { x: number; y: number }
}

/** Index (0-based) → letter label: 0→A, 25→Z, 26→AA … */
function indexToLabel(index: number): string {
  let label = ''
  let n = index
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

/** Pull a typed annotation out of a comment's `meta` (object or JSON string). */
export function extractCommentAnnotation(comment?: CommentType | null): CommentImageAnnotation | undefined {
  if (!comment?.meta) return undefined

  let meta: any = comment.meta
  if (ncIsString(meta)) {
    try {
      meta = JSON.parse(meta)
    } catch {
      return undefined
    }
  }

  return meta?.annotation as CommentImageAnnotation | undefined
}

const [useProvideImageAnnotations, useImageAnnotations] = useInjectionState(
  (selectedFile: Ref<AttachmentType | false>, visibleItems: Ref<AttachmentType[]>) => {
    // May be absent (e.g. public views) — annotations then stay read-only/empty.
    const rowComments = useRowComments()

    const comments = computed<CommentType[]>(() => rowComments?.comments.value ?? [])

    const saveComment = rowComments?.saveComment ?? (async () => {})

    // ─── state ───────────────────────────────────────────────────────────
    const draft = ref<AnnotationDraft | null>(null)

    const activeAnnotationId = ref<string | null>(null)

    const hoveredAnnotationId = ref<string | null>(null)

    /** Set by the sidebar "View" action; the Carousel watches and focuses it. */
    const pendingFocusCommentId = ref<string | null>(null)

    // ─── derived ─────────────────────────────────────────────────────────
    const selectedFileKey = computed(() => (selectedFile.value ? getAttachmentAnnotationKey(selectedFile.value) : undefined))

    /** All comments that carry an annotation, in creation order. */
    const annotatedComments = computed(() =>
      comments.value
        .filter((c) => c.id && !`${c.id}`.startsWith('temp-') && extractCommentAnnotation(c))
        .map((c) => ({ comment: c, annotation: extractCommentAnnotation(c)! })),
    )

    /**
     * commentId → label, scoped per attachment (each image's annotations are
     * labelled A, B, C … in their own creation order).
     */
    const labelByCommentId = computed(() => {
      const perFileCount = new Map<string, number>()
      const map: Record<string, string> = {}

      for (const { comment, annotation } of annotatedComments.value) {
        const key = getAttachmentAnnotationKey(annotation.attachment) ?? '__unknown__'
        const idx = perFileCount.get(key) ?? 0
        map[comment.id!] = indexToLabel(idx)
        perFileCount.set(key, idx + 1)
      }

      return map
    })

    /** Markers to render on the currently-selected image. */
    const markers = computed<AnnotationMarker[]>(() => {
      if (!selectedFileKey.value) return []

      return annotatedComments.value
        .filter(({ annotation }) => getAttachmentAnnotationKey(annotation.attachment) === selectedFileKey.value)
        .map(({ comment, annotation }) => ({
          commentId: comment.id!,
          label: labelByCommentId.value[comment.id!] ?? '',
          region: annotation.region,
        }))
    })

    // ─── actions ─────────────────────────────────────────────────────────
    function startDraft(region: CommentAnnotationRegion, anchor: { x: number; y: number }) {
      activeAnnotationId.value = null
      draft.value = { region, anchor }
    }

    function cancelDraft() {
      draft.value = null
    }

    async function commitDraft(commentText: string) {
      if (!draft.value || !selectedFile.value || !commentText?.trim()) {
        draft.value = null
        return
      }

      const annotation: CommentImageAnnotation = {
        attachment: {
          path: selectedFile.value.path,
          url: selectedFile.value.url,
          title: selectedFile.value.title,
        },
        region: draft.value.region,
      }

      draft.value = null

      await saveComment(commentText, undefined, { annotation })
    }

    function setHovered(commentId: string | null) {
      hoveredAnnotationId.value = commentId
    }

    function setActive(commentId: string | null) {
      activeAnnotationId.value = commentId
    }

    /** Triggered by the sidebar "View" link — focus the comment's region. */
    function viewAnnotation(comment: CommentType) {
      if (!comment.id) return
      pendingFocusCommentId.value = comment.id
    }

    /** Resolved focus request — Carousel watches this to switch file + highlight. */
    const focusTarget = computed(() => {
      if (!pendingFocusCommentId.value) return null
      const entry = annotatedComments.value.find((e) => e.comment.id === pendingFocusCommentId.value)
      if (!entry) return null
      const key = getAttachmentAnnotationKey(entry.annotation.attachment)
      const attachment = visibleItems.value.find((item) => getAttachmentAnnotationKey(item) === key)
      return { commentId: pendingFocusCommentId.value, attachment, region: entry.annotation.region }
    })

    function clearFocus() {
      pendingFocusCommentId.value = null
    }

    return {
      draft,
      markers,
      activeAnnotationId,
      hoveredAnnotationId,
      pendingFocusCommentId,
      selectedFileKey,
      annotatedComments,
      labelByCommentId,
      startDraft,
      cancelDraft,
      commitDraft,
      setHovered,
      setActive,
      viewAnnotation,
      focusTarget,
      clearFocus,
      extractCommentAnnotation,
    }
  },
)

export { useProvideImageAnnotations, useImageAnnotations }
