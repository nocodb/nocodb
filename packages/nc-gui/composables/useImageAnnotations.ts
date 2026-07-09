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

/**
 * One-shot request to open an attachment carousel focused on an annotation
 * comment. Set by comment lists rendered outside the carousel (expanded record
 * sidebar); the owning attachment cell watches it to open its carousel, and
 * the annotation provider consumes the comment id to focus the region.
 */
const useAnnotationFocusRequest = createGlobalState(() => {
  const request = ref<{ rowId: string; attachmentKey: string; commentId: string } | null>(null)

  return { request }
})

const [useProvideImageAnnotations, useImageAnnotations] = useInjectionState(
  (selectedFile: Ref<AttachmentType | false>, visibleItems: Ref<AttachmentType[]>) => {
    // May be absent (e.g. public views) — annotations then stay read-only/empty.
    const rowComments = useRowComments()

    const comments = computed<CommentType[]>(() => rowComments?.comments.value ?? [])

    const saveComment = rowComments?.saveComment ?? (async () => {})

    const parsedHtmlComments = computed<Record<string, string>>(() => rowComments?.parsedHtmlComments.value ?? {})

    // ─── state ───────────────────────────────────────────────────────────
    const draft = ref<AnnotationDraft | null>(null)

    const activeAnnotationId = ref<string | null>(null)

    const hoveredAnnotationId = ref<string | null>(null)

    /** Set by the sidebar "View" action; the Carousel watches and focuses it. */
    const pendingFocusCommentId = ref<string | null>(null)

    // Consume any external focus request — it's what opened this carousel, so
    // focus the annotation it points at (focusTarget resolves once comments load).
    const { request: externalFocusRequest } = useAnnotationFocusRequest()

    if (externalFocusRequest.value) {
      pendingFocusCommentId.value = externalFocusRequest.value.commentId
      externalFocusRequest.value = null
    }

    // ─── derived ─────────────────────────────────────────────────────────
    const selectedFileKey = computed(() => (selectedFile.value ? getAttachmentAnnotationKey(selectedFile.value) : undefined))

    /** Root annotation comments (carry meta.annotation), in creation order. */
    const annotatedComments = computed(() =>
      comments.value
        .filter((c) => c.id && !`${c.id}`.startsWith('temp-') && extractCommentAnnotation(c))
        .map((c) => ({ comment: c, annotation: extractCommentAnnotation(c)! })),
    )

    const rootIds = computed(() => new Set(annotatedComments.value.map((e) => e.comment.id)))

    /**
     * Every comment id → the root annotation comment id of its thread. A root
     * maps to itself; a reply maps to its (annotated) parent. Lets the whole
     * conversation resolve back to one pill.
     */
    const rootIdByCommentId = computed(() => {
      const map: Record<string, string> = {}
      for (const c of comments.value) {
        if (!c.id) continue
        if (rootIds.value.has(c.id)) map[c.id] = c.id
        else if (c.parent_comment_id && rootIds.value.has(c.parent_comment_id)) map[c.id] = c.parent_comment_id
      }
      return map
    })

    /** Root id → label (A, B, C …), scoped per attachment, in creation order. */
    const labelByRootId = computed(() => {
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

    /** Every comment id (root OR reply) → its pill label (replies inherit root). */
    const labelByCommentId = computed(() => {
      const map: Record<string, string> = {}
      for (const c of comments.value) {
        if (!c.id) continue
        const root = rootIdByCommentId.value[c.id]
        if (root && labelByRootId.value[root]) map[c.id] = labelByRootId.value[root]
      }
      return map
    })

    /** Markers (one pill per root annotation) on the currently-selected image. */
    const markers = computed<AnnotationMarker[]>(() => {
      if (!selectedFileKey.value) return []

      return annotatedComments.value
        .filter(({ annotation }) => getAttachmentAnnotationKey(annotation.attachment) === selectedFileKey.value)
        .map(({ comment, annotation }) => ({
          commentId: comment.id!,
          label: labelByRootId.value[comment.id!] ?? '',
          region: annotation.region,
        }))
    })

    /** The active pill's root comment. */
    const activeComment = computed(() =>
      activeAnnotationId.value ? comments.value.find((c) => c.id === activeAnnotationId.value) ?? null : null,
    )

    /** Full conversation for the active pill: root + replies, oldest first. */
    const activeThread = computed<CommentType[]>(() => {
      const rootId = activeAnnotationId.value
      if (!rootId) return []
      return comments.value
        .filter((c) => c.id && rootIdByCommentId.value[c.id] === rootId)
        .sort((a, b) => `${a.created_at ?? ''}`.localeCompare(`${b.created_at ?? ''}`))
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
      // Always resolve to the thread's root so the whole conversation opens.
      activeAnnotationId.value = commentId ? rootIdByCommentId.value[commentId] ?? commentId : null
    }

    function closeActive() {
      activeAnnotationId.value = null
    }

    /** Reply within the active pill's conversation. */
    async function replyToActive(text: string) {
      const rootId = activeAnnotationId.value
      if (!rootId || !text?.trim()) return
      await saveComment(text, undefined, undefined, rootId)
    }

    /**
     * Sidebar "View" — open the whole conversation. The clicked comment may be
     * a reply; resolve it to its root pill so any thread item opens the same
     * conversation + focuses the same region.
     */
    function viewAnnotation(comment: CommentType) {
      if (!comment.id) return
      pendingFocusCommentId.value = rootIdByCommentId.value[comment.id] ?? comment.id
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
      activeComment,
      activeThread,
      parsedHtmlComments,
      startDraft,
      cancelDraft,
      commitDraft,
      setHovered,
      setActive,
      closeActive,
      replyToActive,
      viewAnnotation,
      focusTarget,
      clearFocus,
      extractCommentAnnotation,
    }
  },
)

export { useProvideImageAnnotations, useImageAnnotations, useAnnotationFocusRequest }
