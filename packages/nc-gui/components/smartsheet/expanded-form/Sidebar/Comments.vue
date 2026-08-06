<script setup lang="ts">
import tippy from 'tippy.js'
import { ProjectRoles, UITypes, WorkspaceRolesToProjectRoles, getAttachmentAnnotationKey } from 'nocodb-sdk'
import type { ColumnType, CommentImageAnnotation, CommentType, WorkspaceUserRoles } from 'nocodb-sdk'

/**
 * Copy URL builds a base-data deep link — hosts whose consumers have no data
 * route (interface record sheets) hide it.
 */
const props = defineProps<{
  hideCopyUrl?: boolean
  hideRoleInfo?: boolean
  /**
   * Narrow the feed to a comment kind (the interface discussion panel's
   * comment filters). When SET, resolved comments are hidden unless
   * `showResolved` — classic mounts pass nothing and see everything.
   */
  commentFilter?: 'all' | 'record' | 'onAttachments' | 'withAttachments'
  /**
   * Include resolved comments (the "Show resolved comments" toggle —
   * offered for the all/record filters only; attachment filters stay
   * open-comments-only).
   */
  showResolved?: boolean
}>()

const { user, appInfo } = useGlobal()

const { t } = useI18n()

const { dashboardUrl } = useDashboard()

const { isUIAllowed } = useRoles()

const { copy } = useCopy()

const route = useRoute()

const hasEditPermission = computed(() => isUIAllowed('commentEdit'))

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

// Hosted inside the attachment viewer — new comments tag the open image
// (pin-less annotation) so they count toward its badge.
const viewerCommentAnchor = inject(AttachmentViewerCommentAnchorInj, ref(null))

const {
  deleteComment,
  resolveComment,
  isCommentsLoading,
  comments,
  loadComments,
  updateComment,
  saveComment: _saveComment,
  primaryKey,
  parsedHtmlComments,
  row,
} = useRowCommentsOrThrow()

const {
  isCommentAttachmentsEnabled,
  pendingAttachments,
  isUploading: isAttachmentUploading,
  openFilePicker,
  handlePaste: handleAttachmentPaste,
  handleDrop: handleAttachmentDrop,
  removeAttachment,
  clearAttachments,
} = useCommentAttachments()

// Independent attachment state for the edit composer (initialised from the
// comment being edited so the user can add/remove files).
const {
  pendingAttachments: editAttachments,
  isUploading: isEditAttachmentUploading,
  openFilePicker: openEditFilePicker,
  handlePaste: handleEditAttachmentPaste,
  handleDrop: handleEditAttachmentDrop,
  removeAttachment: removeEditAttachment,
  clearAttachments: clearEditAttachments,
} = useCommentAttachments()

// Present only inside the attachment carousel — exposes image-annotation state.
const imageAnnotations = useImageAnnotations()

const { request: annotationFocusRequest } = useAnnotationFocusRequest()

const { getPossibleAttachmentSrc } = useAttachment()

// Annotations are EE-only — hide the label pills entirely in CE.
const annotationLabels = computed(() => (isEeUI ? imageAnnotations?.labelByCommentId.value ?? {} : {}))

// Row attachments keyed by their annotation key — resolves a comment's stored
// annotation back to the live cell attachment (signed URLs, thumbnails).
const rowAttachmentByKey = computed<Record<string, any>>(() => {
  const map: Record<string, any> = {}
  for (const col of (meta.value?.columns ?? []) as ColumnType[]) {
    if (col.uidt !== UITypes.Attachment) continue

    let value: any = row?.value?.row?.[col.title!]
    if (ncIsString(value)) {
      try {
        value = JSON.parse(value)
      } catch {
        continue
      }
    }
    if (!ncIsArray(value)) continue

    for (const att of value) {
      const key = getAttachmentAnnotationKey(att)
      if (key && !(key in map)) map[key] = att
    }
  }
  return map
})

// Attachment context (thumbnail + filename) for annotation comments — shown on
// the comment so it's clear which image it was made on. Replies don't carry
// their own annotation; they inherit the anchor of their (root) parent.
const annotationRefByCommentId = computed(() => {
  const map: Record<string, { title: string; key: string; thumbnailSrc?: string; matched: boolean; rootId: string }> = {}
  if (!isEeUI) return map

  const annotationById: Record<string, CommentImageAnnotation> = {}
  for (const c of comments.value) {
    if (!c.id) continue
    const annotation = extractCommentAnnotation(c)
    if (annotation?.attachment) annotationById[c.id] = annotation
  }

  for (const c of comments.value) {
    if (!c.id) continue
    const rootId = annotationById[c.id]
      ? c.id
      : c.parent_comment_id && annotationById[c.parent_comment_id]
      ? c.parent_comment_id
      : undefined
    if (!rootId) continue

    const annotation = annotationById[rootId]!
    const key = getAttachmentAnnotationKey(annotation.attachment) ?? ''
    const matched = key ? rowAttachmentByKey.value[key] : undefined
    map[c.id] = {
      title: annotation.attachment.title || matched?.title || '',
      key,
      thumbnailSrc: matched ? getPossibleAttachmentSrc(matched, 'tiny')[0] : undefined,
      matched: !!matched,
      rootId,
    }
  }
  return map
})

// The rendered list — the caller's filter applied over the loaded comments.
// Annotation anchoring is inherited by replies (annotationRefByCommentId), so
// a thread filters as a unit; 'record' is its complement. Resolved comments
// are hidden unless the toggle is on — the toggle is only offered for the
// all/record filters, so the attachment filters stay open-comments-only.
const visibleComments = computed(() => {
  const filter = props.commentFilter
  if (!filter) return comments.value

  let list = comments.value

  if (filter === 'record') list = list.filter((c) => !c.id || !annotationRefByCommentId.value[c.id])
  else if (filter === 'onAttachments') list = list.filter((c) => !!c.id && !!annotationRefByCommentId.value[c.id])
  else if (filter === 'withAttachments') list = list.filter((c) => !!c.attachments?.length)

  const includeResolved = props.showResolved && (filter === 'all' || filter === 'record')
  if (!includeResolved) list = list.filter((c) => !c.resolved_by)

  return list
})

const editCommentValue = ref<CommentType>()

const commentsWrapperEl = ref<HTMLDivElement>()

const isEditing = ref<boolean>(false)

const isCommentMode = ref(false)

const hoveredCommentId = ref<null | string>(null)

const commentInputRef = ref<any>()

const comment = ref('')

// Holds the deep-linked commentId for the lifetime of the current row's
// comment session. Side-panel mode triggers loadComments twice (via
// triggerRowLoad AND the activity-tab watcher), which toggles
// isCommentsLoading on/off and unmounts+remounts the wrapper element.
// On remount, the URL has already been stripped of `commentId`, so we
// need our own copy to know whether to anchor on the deep-link or fall
// back to bottom-scroll. Cleared when the user posts a comment or
// switches rows (primaryKey changes).
const deepLinkCommentId = ref<string | null>(null)

const router = useRouter()

const baseUsers = computed(() => (meta.value?.base_id ? basesUser.value.get(meta.value?.base_id) || [] : []))

const debouncedLoadCommentEditedTooltip = useDebounceFn(loadCommentEditedTooltip, 1000)

function scrollComments() {
  if (commentsWrapperEl.value) {
    commentsWrapperEl.value.scrollTo({
      top: commentsWrapperEl.value.scrollHeight,
      behavior: 'smooth',
    })
  }
}

const saveComment = async () => {
  if (!comment.value.trim() && !pendingAttachments.value.length) return

  // don't post mid-upload — wait for files to finish
  if (isAttachmentUploading.value) return

  while (comment.value.endsWith('<br />') || comment.value.endsWith('\n')) {
    if (comment.value.endsWith('<br />')) {
      comment.value = comment.value.slice(0, -6)
    } else {
      comment.value = comment.value.slice(0, -2)
    }
  }

  // User is posting — drop any pending deep-link so the scroll watchers
  // scroll to their new comment at the bottom instead of jumping back.
  deepLinkCommentId.value = null

  isCommentMode.value = true

  const tempAttachments = [...pendingAttachments.value]

  // Optimistic Insert
  comments.value = [
    ...comments.value,
    {
      id: `temp-${new Date().getTime()}`,
      comment: comment.value,
      attachments: tempAttachments,
      created_at: new Date().toISOString(),
      created_by: user.value?.id,
      created_by_email: user.value?.email,
      created_display_name: user.value?.display_name ?? '',
      created_display_name_short: extractUserDisplayNameOrEmail(user.value),
      created_by_meta: user.value?.meta ?? '',
    },
  ]

  const tempCom = comment.value
  comment.value = ''
  clearAttachments()

  commentInputRef?.value?.setEditorContent('', true)
  await nextTick(() => {
    scrollComments()
  })

  try {
    await _saveComment(
      tempCom,
      tempAttachments,
      viewerCommentAnchor.value ? { annotation: { attachment: viewerCommentAnchor.value } } : undefined,
    )
    await nextTick(() => {
      isExpandedFormCommentMode.value = true
    })
    scrollComments()
  } catch (e) {
    console.error(e)
  }
}

const copyComment = async (comment: CommentType) => {
  const viewId = activeView.value?.fk_model_id === meta.value?.id ? activeView.value?.id : undefined

  // Mirror copy-record-URL: include &path=… so the link still resolves when
  // the source view is grouped (without it the deep-link can't open the row
  // in another tab).
  const pathParam = route.query?.path ? `&path=${route.query.path}` : ''

  await copy(
    encodeURI(
      `${dashboardUrl?.value}/${route.params.typeOrId}/${route.params.baseId}/${meta.value?.id}${
        viewId ? `/${viewId}` : ''
      }?rowId=${primaryKey.value}&commentId=${comment.id}${pathParam}`,
    ),
  )
}

function viewAnnotationComment(commentItem: CommentType) {
  if (!commentItem.id) return

  // Inside the carousel — focus the annotation directly.
  if (imageAnnotations) {
    imageAnnotations.viewAnnotation(commentItem)
    return
  }

  // Outside (expanded record sidebar) — ask the owning attachment cell to open
  // its carousel focused on this annotation.
  const refInfo = annotationRefByCommentId.value[commentItem.id]
  if (!refInfo?.matched || !primaryKey.value) return

  annotationFocusRequest.value = {
    rowId: primaryKey.value,
    attachmentKey: refInfo.key,
    // Replies resolve to their root annotation comment — that's what the
    // carousel focuses (same conversation, same region).
    commentId: refInfo.rootId,
  }
}

function scrollToComment(commentId: string) {
  const commentEl = document.querySelector(`.${commentId}`)
  if (commentEl) {
    commentEl.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }
}

function tryScrollToDeepLinkComment(): boolean {
  const id = deepLinkCommentId.value
  if (!id) return false
  const el = document.querySelector(`.${id}`)
  if (!el) return false
  scrollToComment(id)
  hoveredCommentId.value = id
  onClickOutside(el as HTMLDivElement, handleResetHoverEffect)
  return true
}

// Capture commentId from the URL into our own ref before stripping it,
// so subsequent wrapper remounts (caused by isCommentsLoading toggles)
// still know there's a deep-link in progress. Also fires when the user
// clicks another notification while the panel is already open.
watch(
  () => route.query.commentId,
  (newId) => {
    if (!newId) return
    deepLinkCommentId.value = newId as string
    // Preserve `path` so the group context survives a reload after the
    // comment deep-link is consumed; only commentId needs to be stripped.
    const { commentId: _drop, ...rest } = router.currentRoute.value.query
    router.push({ query: rest })
  },
  { immediate: true },
)

// Reset deep-link state when row changes so a new row defaults back to
// the usual scroll-to-bottom behavior on first open.
watch(primaryKey, () => {
  deepLinkCommentId.value = null
})

function onCancel(e: KeyboardEvent) {
  if (!isEditing.value) return
  e.preventDefault()
  e.stopPropagation()
  editCommentValue.value = undefined
  clearEditAttachments()
  loadComments()
  isEditing.value = false
  editCommentValue.value = undefined
}

function editComment(comment: CommentType) {
  editCommentValue.value = {
    ...comment,
  }
  editAttachments.value = [...(comment.attachments ?? [])]
  isEditing.value = true
  nextTick(() => {
    scrollToComment(comment.id!)
  })
}

const value = computed({
  get() {
    return editCommentValue.value?.comment || ''
  },
  set(val) {
    if (!editCommentValue.value) return
    editCommentValue.value.comment = val
  },
})

async function onEditComment() {
  if (!isEditing.value) return

  if (isEditAttachmentUploading.value) return

  if (!editCommentValue.value?.comment && !editAttachments.value.length) return

  while (
    editCommentValue.value?.comment &&
    (editCommentValue.value.comment.endsWith('<br />') || editCommentValue.value.comment.endsWith('\n'))
  ) {
    if (editCommentValue.value.comment.endsWith('<br />')) {
      editCommentValue.value.comment = editCommentValue.value.comment.slice(0, -6)
    } else {
      editCommentValue.value.comment = editCommentValue.value.comment.slice(0, -2)
    }
  }

  isCommentMode.value = true

  const tempCom = {
    ...editCommentValue.value,
  }
  const tempAttachments = [...editAttachments.value]

  isEditing.value = false
  editCommentValue.value = undefined
  clearEditAttachments()
  await updateComment(tempCom.id!, {
    comment: tempCom.comment,
    attachments: tempAttachments,
  })

  loadComments()
}

/**
 * Interfaces route comments through the injected adapter — its presence marks
 * an interface surface, where the author hover card keeps its avatar +
 * name + email but drops the base-role footer (backed by the base user
 * list, which interface-only collaborators can't read — and base
 * membership is base-scoped info regardless).
 */
const isInterfaceSurface = inject(InterfaceRecordSidebarInj, undefined)

const createdBy = (
  comment: CommentType & {
    created_display_name_short?: string
  },
) => {
  if (comment.created_by === user.value?.id) {
    return t('general.you')
  } else if (comment.created_display_name_short?.trim()) {
    return comment.created_display_name_short || t('labels.sharedSource')
  } else if (comment.created_by_email) {
    // Canonical helper — alias when configured, else a name derived from the
    // email's local part (never the raw address).
    return extractUserDisplayNameOrEmail({
      display_name: comment.created_display_name as string,
      email: comment.created_by_email,
    })
  } else {
    return t('labels.sharedSource')
  }
}

function handleResetHoverEffect() {
  if (!hoveredCommentId.value) return

  hoveredCommentId.value = null
}

watch(commentsWrapperEl, (el) => {
  if (!el) return
  setTimeout(() => {
    nextTick(() => {
      // Deep-link in progress (initial mount OR remount after the loader
      // toggled) — anchor on the linked comment. If the comment isn't in
      // the DOM yet, the length watcher will retry once comments load.
      // Either way, skip the bottom-scroll so we don't jump away from the
      // linked comment.
      if (deepLinkCommentId.value) {
        tryScrollToDeepLinkComment()
        return
      }
      scrollComments()
    })
  }, 100)
})

const getUserRole = (email: string) => {
  const user = baseUsers.value.find((user) => user.email === email)
  if (!user) return ProjectRoles.NO_ACCESS

  return (
    user.roles ??
    (user.workspace_roles
      ? WorkspaceRolesToProjectRoles[user.workspace_roles as WorkspaceUserRoles] ?? ProjectRoles.NO_ACCESS
      : ProjectRoles.NO_ACCESS)
  )
}

const tooltipInstances: any[] = []

function loadCommentEditedTooltip() {
  resetTooltipInstances()

  document.querySelectorAll('.nc-rich-link-tooltip').forEach((el) => {
    const tooltip = Object.values(el.attributes).find((attr) => attr.name === 'data-tooltip')
    if (!tooltip) return

    const content = document.createElement('span')
    content.className = 'tooltip nc-rich-link-tooltip-popup'
    content.textContent = tooltip.value

    const instance = tippy(el, {
      content,
      placement: 'top',
      allowHTML: false,
      arrow: true,
      animation: 'fade',
      duration: 0,
    })

    tooltipInstances.push(instance)
  })
}

function resetTooltipInstances() {
  tooltipInstances.forEach((instance) => instance?.destroy())
  tooltipInstances.length = 0
}

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    event.stopPropagation()
  }
}

watch(
  comments,
  () => {
    debouncedLoadCommentEditedTooltip()
  },
  { immediate: true },
)

watch(
  () => comments.value?.length,
  () => {
    nextTick(() => {
      // Deep-link target still in scope (only cleared on user post / row
      // change) — keep anchoring on it rather than snapping to bottom.
      if (deepLinkCommentId.value) {
        tryScrollToDeepLinkComment()
        return
      }
      scrollComments()
    })
  },
)

onBeforeUnmount(() => {
  resetTooltipInstances()
})
</script>

<template>
  <div
    class="h-full"
    :class="{
      'pb-1': !hasEditPermission,
    }"
  >
    <div v-if="isCommentsLoading" class="flex flex-col items-center justify-center w-full h-full">
      <GeneralLoader size="xlarge" />
    </div>
    <div v-else class="flex flex-col h-full">
      <div v-if="comments.length === 0" class="flex flex-col my-1 text-center justify-center h-full nc-scrollbar-thin">
        <div class="text-center text-3xl text-nc-content-gray-subtle opacity-40">
          <GeneralIcon icon="commentHere" />
        </div>
        <div class="text-center my-4 px-6">
          <div class="font-medium text-nc-content-gray-muted">
            {{ hasEditPermission ? $t('activity.startCommenting') : $t('activity.noCommentsYet') }}
          </div>
          <div v-if="hasEditPermission" class="text-xs text-nc-content-gray-subtle2 mt-2">
            {{ $t('activity.startCommentingDescription') }}
          </div>
        </div>
      </div>
      <!-- Comments exist but the active filter matches none -->
      <div
        v-else-if="visibleComments.length === 0"
        class="flex flex-col my-1 text-center justify-center h-full nc-scrollbar-thin"
        data-testid="nc-comments-no-filter-match"
      >
        <div class="text-center text-3xl text-nc-content-gray-subtle opacity-40">
          <GeneralIcon icon="commentHere" />
        </div>
        <div class="text-center my-4 px-6 font-medium text-nc-content-gray-muted">
          {{ $t('labels.noCommentsMatchFilter') }}
        </div>
      </div>
      <div v-else ref="commentsWrapperEl" class="flex flex-col h-full py-1 nc-scrollbar-thin">
        <div
          v-for="(commentItem, index) of visibleComments"
          :key="commentItem.id"
          :class="[
            {
              'mt-auto': index === 0,
            },
            commentItem.id,
          ]"
          class="nc-comment-item"
          @mouseover="handleResetHoverEffect"
          @mouseenter="imageAnnotations?.setHovered(commentItem.id!)"
          @mouseleave="imageAnnotations?.setHovered(null)"
        >
          <div
            :class="{
              'hover:bg-nc-bg-gray-light': editCommentValue?.id !== commentItem!.id,
              'nc-hovered-comment bg-nc-bg-gray-light': hoveredCommentId === commentItem!.id,
              'bg-nc-bg-gray-light':
                imageAnnotations &&
                (imageAnnotations.activeAnnotationId.value === commentItem.id ||
                  imageAnnotations.hoveredAnnotationId.value === commentItem.id),
        }"
            class="group gap-3 overflow-hidden px-3 py-2 transition-colors"
          >
            <div class="flex items-start justify-between">
              <div
                class="flex items-start gap-3 flex-1"
                :class="{
                  'w-[calc(100%)] group-hover:w-[calc(100%_-_50px)]': !appInfo.ee,
                  'w-[calc(100%_-_44px)] group-hover:w-[calc(100%_-_72px)]': appInfo.ee && commentItem.resolved_by,
                  'w-[calc(100%_-_16px)] group-hover:w-[calc(100%_-_72px)]':
                    appInfo.ee && !commentItem.resolved_by && hasEditPermission,
                  'w-[calc(100%_-_16px)] group-hover:w-[calc(100%_-_44px)]':
                    appInfo.ee && !commentItem.resolved_by && !hasEditPermission,
                }"
              >
                <GeneralUserIcon
                  :user="{
                    display_name: commentItem?.created_display_name,
                    email: commentItem?.created_by_email,
                    meta: commentItem?.created_by_meta,
                  }"
                  class="mt-0.5"
                  size="medium"
                />
                <div class="flex h-[28px] items-center gap-3 w-[calc(100%_-_40px)]">
                  <NcDropdown placement="topLeft" :trigger="['hover']" class="flex-none max-w-[calc(100%_-_72px)]">
                    <div class="truncate text-nc-content-gray font-medium !text-small !leading-[18px] overflow-hidden">
                      {{ createdBy(commentItem) }}
                    </div>

                    <template #overlay>
                      <div class="bg-nc-bg-default rounded-lg">
                        <div class="flex items-center gap-4 py-3 px-2">
                          <GeneralUserIcon
                            class="border-1 border-nc-border-gray-medium rounded-full"
                            :user="{
                              display_name: commentItem?.created_display_name,
                              email: commentItem?.created_by_email,
                              meta: commentItem?.created_by_meta,
                            }"
                            size="base"
                          />
                          <div class="flex flex-col">
                            <div class="font-semibold text-nc-content-gray">
                              {{ createdBy(commentItem) }}
                            </div>
                            <div class="text-xs text-nc-content-gray-subtle2">
                              {{ commentItem.created_by_email }}
                            </div>
                          </div>
                        </div>
                        <!-- Base-role footer stays off interface surfaces: interface-only
                             collaborators have no base user list to resolve the role from
                             (and the base membership itself is base-scoped info). -->
                        <i18n-t
                          v-if="!props.hideRoleInfo && !isInterfaceSurface && isUIAllowed('dataEdit')"
                          keypath="labels.hasRoleInBase"
                          tag="div"
                          class="px-3 rounded-b-lg !text-[13px] items-center text-nc-content-gray-subtle2 flex gap-1 bg-nc-bg-gray-light py-1.5"
                        >
                          <template #role>
                            <RolesBadge size="sm" :border="false" :role="getUserRole(commentItem.created_by_email!)" />
                          </template>
                        </i18n-t>
                      </div>
                    </template>
                  </NcDropdown>
                  <div class="text-xs text-nc-content-gray-muted">
                    {{ timeAgo(commentItem.created_at!) }}
                  </div>
                </div>
              </div>
              <div class="flex items-center">
                <NcDropdown
                  v-if="
                    !editCommentValue &&
                    (!props.hideCopyUrl || (user && commentItem.created_by_email === user.email && hasEditPermission))
                  "
                  class="nc-comment-more-actions !hidden !group-hover:block"
                  overlay-class-name="!min-w-[160px]"
                  placement="bottomRight"
                >
                  <NcButton
                    class="nc-expand-form-more-actions !hover:bg-nc-bg-gray-medium !w-7 !h-7 !bg-transparent"
                    size="xsmall"
                    type="text"
                  >
                    <GeneralIcon class="text-md" icon="threeDotVertical" />
                  </NcButton>
                  <template #overlay>
                    <NcMenu variant="small">
                      <NcMenuItem
                        v-if="user && commentItem.created_by_email === user.email && hasEditPermission"
                        v-e="['c:comment-expand:comment:edit']"
                        @click="editComment(commentItem)"
                      >
                        <div class="flex gap-2 items-center">
                          <component :is="iconMap.rename" class="cursor-pointer" />
                          {{ $t('general.edit') }}
                        </div>
                      </NcMenuItem>
                      <NcMenuItem
                        v-if="!props.hideCopyUrl"
                        v-e="['c:comment-expand:comment:copy']"
                        @click="copyComment(commentItem)"
                      >
                        <div class="flex gap-2 items-center">
                          <component :is="iconMap.copy" class="cursor-pointer" />
                          {{ $t('activity.copyUrl') }}
                        </div>
                      </NcMenuItem>
                      <template v-if="user && commentItem.created_by_email === user.email && hasEditPermission">
                        <NcDivider />
                        <NcMenuItem v-e="['c:row-expand:comment:delete']" danger @click="deleteComment(commentItem.id!)">
                          <div class="flex gap-2 items-center">
                            <GeneralIcon icon="delete" class="cursor-pointer" />
                            {{ $t('general.delete') }}
                          </div>
                        </NcMenuItem>
                      </template>
                    </NcMenu>
                  </template>
                </NcDropdown>
                <div v-if="appInfo.ee">
                  <NcTooltip v-if="!commentItem.resolved_by && hasEditPermission">
                    <NcButton
                      class="nc-resolve-comment-btn !w-7 !h-7 !bg-transparent !hover:bg-nc-bg-gray-medium !hidden !group-hover:block"
                      size="xsmall"
                      type="text"
                      @click="resolveComment(commentItem.id!)"
                    >
                      <GeneralIcon class="text-md" icon="checkCircle" />
                    </NcButton>

                    <template #title>{{ $t('activity.clickToResolve') }}</template>
                  </NcTooltip>

                  <NcTooltip v-else-if="commentItem.resolved_by">
                    <template #title>{{ `${$t('activity.resolvedBy')} ${commentItem.resolved_display_name_short}` }}</template>
                    <NcButton
                      class="!h-7 !w-7 !bg-transparent !hover:bg-nc-bg-gray-medium text-semibold"
                      size="xsmall"
                      type="text"
                      @click="resolveComment(commentItem.id!)"
                    >
                      <GeneralIcon class="text-md rounded-full bg-nc-fill-green-dark text-white" icon="checkFill" />
                    </NcButton>
                  </NcTooltip>
                </div>
              </div>
            </div>
            <div
              :class="{
                'mt-3': commentItem.id === editCommentValue?.id,
              }"
              class="flex-1 flex flex-col gap-1 max-w-[calc(100%)]"
            >
              <div
                v-if="commentItem.id === editCommentValue?.id && hasEditPermission"
                @paste="isCommentAttachmentsEnabled ? handleEditAttachmentPaste($event) : undefined"
                @dragover.prevent
                @drop="isCommentAttachmentsEnabled ? handleEditAttachmentDrop($event) : undefined"
              >
                <SmartsheetExpandedFormRichComment
                  v-model:value="value"
                  autofocus
                  autofocus-to-end
                  :hide-options="false"
                  :extra-save-enabled="editAttachments.length > 0"
                  class="expanded-form-comment-edit-input cursor-text expanded-form-comment-input !py-2 !px-2 !m-0 w-full !border-1 !border-nc-border-gray-medium !rounded-lg !bg-nc-bg-default !text-nc-content-gray !text-small !leading-18px !max-h-[240px]"
                  data-testid="expanded-form-comment-input"
                  @save="onEditComment"
                  @keydown.esc="onCancel"
                  @keydown="handleKeyPress"
                  @blur="
                    () => {
                      editCommentValue = undefined
                      isEditing = false
                      clearEditAttachments()
                    }
                  "
                  @keydown.enter.exact.prevent="onEditComment"
                >
                  <template v-if="editAttachments.length" #attachments>
                    <SmartsheetExpandedFormCommentAttachments
                      :attachments="editAttachments"
                      :comment-id="editCommentValue?.id"
                      editable
                      class="px-1 pt-1"
                      @remove="removeEditAttachment"
                    />
                  </template>
                  <template v-if="isCommentAttachmentsEnabled" #bottom-bar-start>
                    <NcTooltip :title="$t('activity.attachFile')" placement="top">
                      <NcButton
                        v-e="['c:comment:attach-file']"
                        type="text"
                        size="xsmall"
                        class="nc-comment-attach-btn !h-7 !w-7"
                        :loading="isEditAttachmentUploading"
                        :disabled="isEditAttachmentUploading"
                        data-testid="nc-comment-attach-btn"
                        @click="openEditFilePicker"
                      >
                        <GeneralIcon v-if="!isEditAttachmentUploading" icon="lucidePaperclip" class="h-3.5 w-3.5" />
                      </NcButton>
                    </NcTooltip>
                  </template>
                </SmartsheetExpandedFormRichComment>
              </div>

              <div v-else class="space-y-1 pl-9">
                <div
                  v-if="annotationRefByCommentId[commentItem.id!]"
                  class="nc-annotation-attachment inline-flex max-w-full items-center gap-2 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default px-1.5 py-1"
                  :class="{
                    'cursor-pointer hover:bg-nc-bg-gray-light':
                      !!imageAnnotations || annotationRefByCommentId[commentItem.id!].matched,
                  }"
                  :data-testid="`nc-annotation-attachment-${commentItem.id}`"
                  @click="viewAnnotationComment(commentItem)"
                >
                  <img
                    v-if="annotationRefByCommentId[commentItem.id!].thumbnailSrc"
                    :src="annotationRefByCommentId[commentItem.id!].thumbnailSrc"
                    class="h-6 w-6 flex-none rounded object-cover"
                  />
                  <GeneralIcon v-else icon="image" class="h-4 w-4 flex-none text-nc-content-gray-muted" />
                  <NcTooltip show-on-truncate-only class="truncate text-small text-nc-content-gray">
                    {{ annotationRefByCommentId[commentItem.id!].title }}
                  </NcTooltip>
                </div>
                <div
                  v-if="parsedHtmlComments[commentItem.id]"
                  v-dompurify-html="parsedHtmlComments[commentItem.id]"
                  class="nc-rich-text-content !text-small !leading-18px !text-nc-content-gray"
                  @click="handleDompurifyLinkClick"
                ></div>
                <SmartsheetExpandedFormCommentAttachments
                  v-if="commentItem.attachments?.length"
                  :attachments="commentItem.attachments"
                  :comment-id="commentItem.id"
                  class="mt-1"
                />

                <div
                  v-if="annotationLabels[commentItem.id] || annotationRefByCommentId[commentItem.id!]?.matched"
                  class="nc-annotation-ref mt-1 inline-flex items-center gap-1.5 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default px-1.5 py-0.5 cursor-pointer hover:bg-nc-bg-gray-light"
                  :data-testid="`nc-annotation-ref-${annotationLabels[commentItem.id] ?? commentItem.id}`"
                  @click="viewAnnotationComment(commentItem)"
                >
                  <span
                    v-if="annotationLabels[commentItem.id]"
                    class="flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full bg-nc-fill-primary text-white text-[9px] font-semibold"
                  >
                    {{ annotationLabels[commentItem.id] }}
                  </span>
                  <span v-e="['c:attachment:annotation:view']" class="text-[11px] font-medium text-nc-content-brand">
                    {{ $t('general.view') }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="hasEditPermission"
        class="px-3 pt-1 pb-3 nc-comment-input !rounded-br-2xl gap-2 flex relative z-10 bg-nc-bg-default"
        @paste="isCommentAttachmentsEnabled ? handleAttachmentPaste($event) : undefined"
        @dragover.prevent
        @drop="isCommentAttachmentsEnabled ? handleAttachmentDrop($event) : undefined"
      >
        <SmartsheetExpandedFormRichComment
          ref="commentInputRef"
          v-model:value="comment"
          :hide-options="false"
          :extra-save-enabled="pendingAttachments.length > 0"
          :placeholder="`${$t('general.comment')}...`"
          class="expanded-form-comment-input !py-2 !px-2 cursor-text border-1 rounded-lg w-full bg-transparent !text-nc-content-gray !text-small !leading-18px !max-h-[240px]"
          :autofocus="isExpandedFormCommentMode"
          data-testid="expanded-form-comment-input"
          @focus="isExpandedFormCommentMode = false"
          @keydown="handleKeyPress"
          @save="saveComment"
          @keydown.enter.exact.prevent="saveComment"
        >
          <template v-if="pendingAttachments.length" #attachments>
            <SmartsheetExpandedFormCommentAttachments
              :attachments="pendingAttachments"
              editable
              class="px-1 pt-1"
              @remove="removeAttachment"
            />
          </template>
          <template v-if="isCommentAttachmentsEnabled" #bottom-bar-start>
            <NcTooltip :title="$t('activity.attachFile')" placement="top">
              <NcButton
                v-e="['c:comment:attach-file']"
                type="text"
                size="xsmall"
                class="nc-comment-attach-btn !h-7 !w-7"
                :loading="isAttachmentUploading"
                :disabled="isAttachmentUploading"
                data-testid="nc-comment-attach-btn"
                @click="openFilePicker"
              >
                <GeneralIcon v-if="!isAttachmentUploading" icon="lucidePaperclip" class="h-3.5 w-3.5" />
              </NcButton>
            </NcTooltip>
          </template>
        </SmartsheetExpandedFormRichComment>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.expanded-form-comment-input) {
  @apply transition-all duration-150 min-h-8;
  box-shadow: none;
  &:focus,
  &:focus-within {
    @apply min-h-16 !bg-nc-bg-default border-nc-border-brand;
    box-shadow: 0px 0px 0px 2px rgba(var(--nc-brand-accent-rgb), 0.24);
  }
  &::placeholder {
    @apply !text-gray-400;
  }
}

:deep(.expanded-form-comment-edit-input .nc-comment-rich-editor) {
  @apply bg-nc-bg-default;
}

.nc-hovered-comment {
  .nc-expand-form-more-actions,
  .nc-resolve-comment-btn {
    @apply !block;
  }
}

:deep(.nc-rich-link-tooltip) {
  @apply text-nc-content-gray-muted;
}

.nc-rich-text-content {
  p {
    @apply !m-0 !leading-5;
  }
}
</style>

<style lang="scss">
.nc-rich-link-tooltip-popup {
  @apply text-xs bg-nc-content-gray text-nc-content-inverted-primary px-2 py-1 rounded-lg;
}
</style>
