<script setup lang="ts">
import tippy from 'tippy.js'
import { ProjectRoles, WorkspaceRolesToProjectRoles } from 'nocodb-sdk'
import type { CommentType, WorkspaceUserRoles } from 'nocodb-sdk'

const { user, appInfo } = useGlobal()

const { dashboardUrl } = useDashboard()

const { isUIAllowed } = useRoles()

const { copy } = useCopy()

const route = useRoute()

const hasEditPermission = computed(() => isUIAllowed('commentEdit'))

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const meta = inject(MetaInj, ref())

const {
  deleteComment,
  resolveComment,
  isCommentsLoading,
  comments,
  threadedComments,
  replyingTo,
  loadComments,
  updateComment,
  saveComment: _saveComment,
  primaryKey,
  parsedHtmlComments,
  groupedReactions,
  toggleReaction,
} = useRowCommentsOrThrow()

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉']

const editCommentValue = ref<CommentType>()

const commentsWrapperEl = ref<HTMLDivElement>()

const isEditing = ref<boolean>(false)

const isCommentMode = ref(false)

const hoveredCommentId = ref<null | string>(null)

const commentInputRef = ref<any>()

const comment = ref('')

const replyComment = ref('')

const replyInputRef = ref<any>()

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
  if (!comment.value.trim()) return

  while (comment.value.endsWith('<br />') || comment.value.endsWith('\n')) {
    if (comment.value.endsWith('<br />')) {
      comment.value = comment.value.slice(0, -6)
    } else {
      comment.value = comment.value.slice(0, -2)
    }
  }

  isCommentMode.value = true

  // Optimistic Insert
  comments.value = [
    ...comments.value,
    {
      id: `temp-${new Date().getTime()}`,
      comment: comment.value,
      created_at: new Date().toISOString(),
      created_by: user.value?.id,
      created_by_email: user.value?.email,
      created_display_name: user.value?.display_name ?? '',
      created_display_name_short: user.value?.display_name ?? extractNameFromEmail(user.value?.email),
      created_by_meta: user.value?.meta ?? '',
    },
  ]

  const tempCom = comment.value
  comment.value = ''

  commentInputRef?.value?.setEditorContent('', true)
  await nextTick(() => {
    scrollComments()
  })

  try {
    await _saveComment(tempCom)
    await nextTick(() => {
      isExpandedFormCommentMode.value = true
    })
    scrollComments()
  } catch {
    // Error already handled by _saveComment
  }
}

const cancelReply = () => {
  replyingTo.value = null
  replyComment.value = ''
}

const saveReply = async () => {
  if (!replyComment.value.trim() || !replyingTo.value) return

  while (replyComment.value.endsWith('<br />') || replyComment.value.endsWith('\n')) {
    if (replyComment.value.endsWith('<br />')) {
      replyComment.value = replyComment.value.slice(0, -6)
    } else {
      replyComment.value = replyComment.value.slice(0, -2)
    }
  }

  const parentId = replyingTo.value

  comments.value = [
    ...comments.value,
    {
      id: `temp-${new Date().getTime()}`,
      comment: replyComment.value,
      parent_comment_id: parentId,
      created_at: new Date().toISOString(),
      created_by: user.value?.id,
      created_by_email: user.value?.email,
      created_display_name: user.value?.display_name ?? '',
      created_display_name_short: user.value?.display_name ?? extractNameFromEmail(user.value?.email),
      created_by_meta: user.value?.meta ?? '',
    },
  ]

  const tempCom = replyComment.value
  replyComment.value = ''
  replyingTo.value = null

  try {
    await _saveComment(tempCom, parentId)
    scrollComments()
  } catch {
    // Error already handled by _saveComment
  }
}

const copyComment = async (comment: CommentType) => {
  await copy(
    encodeURI(
      `${dashboardUrl?.value}/${route.params.typeOrId}/${route.params.baseId}/${meta.value?.id}?rowId=${primaryKey.value}&commentId=${comment.id}`,
    ),
  )
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

function onCancel(e: KeyboardEvent) {
  if (!isEditing.value) return
  e.preventDefault()
  e.stopPropagation()
  editCommentValue.value = undefined
  loadComments()
  isEditing.value = false
  editCommentValue.value = undefined
}

function editComment(comment: CommentType) {
  editCommentValue.value = {
    ...comment,
  }
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
  if (!isEditing.value || !editCommentValue.value?.comment) return

  while (editCommentValue.value.comment.endsWith('<br />') || editCommentValue.value.comment.endsWith('\n')) {
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

  isEditing.value = false
  editCommentValue.value = undefined
  await updateComment(tempCom.id!, {
    comment: tempCom.comment,
  })

  loadComments()
}

const createdBy = (
  comment: CommentType & {
    created_display_name_short?: string
  },
) => {
  if (comment.created_by === user.value?.id) {
    return 'You'
  } else if (comment.created_display_name_short?.trim()) {
    return comment.created_display_name_short || 'Shared source'
  } else if (comment.created_by_email) {
    return comment.created_by_email
  } else {
    return 'Shared source'
  }
}

function handleResetHoverEffect() {
  if (!hoveredCommentId.value) return

  hoveredCommentId.value = null
}

watch(commentsWrapperEl, () => {
  setTimeout(() => {
    nextTick(() => {
      const query = router.currentRoute.value.query
      const commentId = query.commentId
      if (commentId) {
        router.push({
          query: {
            rowId: query.rowId,
          },
        })
        scrollToComment(commentId as string)

        hoveredCommentId.value = commentId as string

        onClickOutside(document.querySelector(`.${hoveredCommentId.value}`)! as HTMLDivElement, handleResetHoverEffect)
      } else {
        scrollComments()
      }
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

    const instance = tippy(el, {
      content: `<span class="tooltip nc-rich-link-tooltip-popup">${tooltip.value}</span>`,
      placement: 'top',
      allowHTML: true,
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
        <div class="text-center text-3xl text-nc-content-gray-subtle">
          <GeneralIcon icon="commentHere" />
        </div>
        <div class="font-medium text-center my-6 text-nc-content-gray-muted">
          {{ hasEditPermission ? $t('activity.startCommenting') : $t('activity.noCommentsYet') }}
        </div>
      </div>
      <div v-else ref="commentsWrapperEl" class="flex flex-col h-full py-1 nc-scrollbar-thin">
        <div
          v-for="(commentItem, index) of threadedComments"
          :key="commentItem.id"
          :class="[
            {
              'mt-auto': index === 0,
            },
            commentItem.id,
          ]"
          class="nc-comment-item"
          @mouseover="handleResetHoverEffect"
        >
          <div
            :class="{
              'hover:bg-nc-bg-gray-light': editCommentValue?.id !== commentItem!.id,
              'nc-hovered-comment bg-nc-bg-gray-light': hoveredCommentId === commentItem!.id
        }"
            class="group gap-3 overflow-hidden px-3 py-2 transition-colors"
          >
            <div class="flex items-start justify-between">
              <div
                class="flex items-start gap-3 flex-1"
                :class="{
                  'w-[calc(100%_-_78px)]': !appInfo.ee && hasEditPermission,
                  'w-[calc(100%_-_50px)]': !appInfo.ee && !hasEditPermission,
                  'w-[calc(100%_-_100px)]': appInfo.ee && hasEditPermission,
                  'w-[calc(100%_-_56px)]': appInfo.ee && commentItem.resolved_by && !hasEditPermission,
                  'w-[calc(100%_-_44px)]': appInfo.ee && !commentItem.resolved_by && !hasEditPermission,
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
                        <div
                          v-if="isUIAllowed('dataEdit')"
                          class="px-3 rounded-b-lg !text-[13px] items-center text-nc-content-gray-subtle2 flex gap-1 bg-nc-bg-gray-light py-1.5"
                        >
                          Has <RolesBadge size="sm" :border="false" :role="getUserRole(commentItem.created_by_email!)" />
                          role in base
                        </div>
                      </div>
                    </template>
                  </NcDropdown>
                  <div class="text-xs text-nc-content-gray-muted">
                    {{ timeAgo(commentItem.created_at!) }}
                  </div>
                </div>
              </div>
              <div class="flex items-center">
                <NcTooltip v-if="hasEditPermission && !editCommentValue">
                  <NcButton
                    v-e="['c:comment-expand:comment:reply']"
                    class="nc-reply-comment-btn !w-7 !h-7 !bg-transparent !hover:bg-nc-bg-gray-medium opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150"
                    size="xsmall"
                    type="text"
                    data-testid="nc-comment-reply-btn"
                    @click="replyingTo = replyingTo === commentItem.id ? null : commentItem.id!"
                  >
                    <GeneralIcon class="text-md" icon="ncCornerDownLeft" />
                  </NcButton>
                  <template #title>{{ $t('general.reply') }}</template>
                </NcTooltip>
                <NcDropdown
                  v-if="!editCommentValue"
                  class="nc-comment-more-actions opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150"
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
                        v-if="hasEditPermission"
                        v-e="['c:comment-expand:comment:reply']"
                        @click="replyingTo = replyingTo === commentItem.id ? null : commentItem.id!"
                      >
                        <div class="flex gap-2 items-center">
                          <GeneralIcon icon="ncCornerDownLeft" class="cursor-pointer" />
                          {{ $t('general.reply') }}
                        </div>
                      </NcMenuItem>
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
                      <NcMenuItem v-e="['c:comment-expand:comment:copy']" @click="copyComment(commentItem)">
                        <div class="flex gap-2 items-center">
                          <component :is="iconMap.copy" class="cursor-pointer" />
                          {{ $t('general.copy') }} URL
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
                      class="nc-resolve-comment-btn !w-7 !h-7 !bg-transparent !hover:bg-nc-bg-gray-medium opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150"
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
              <SmartsheetExpandedFormRichComment
                v-if="commentItem.id === editCommentValue?.id && hasEditPermission"
                v-model:value="value"
                autofocus
                autofocus-to-end
                :hide-options="false"
                class="expanded-form-comment-edit-input cursor-text expanded-form-comment-input !py-2 !px-2 !m-0 w-full !border-1 !border-nc-border-gray-medium !rounded-lg !bg-nc-bg-default !text-nc-content-gray !text-small !leading-18px !max-h-[240px]"
                data-testid="expanded-form-comment-input"
                @save="onEditComment"
                @keydown.esc="onCancel"
                @keydown="handleKeyPress"
                @blur="
                  () => {
                    editCommentValue = undefined
                    isEditing = false
                  }
                "
                @keydown.enter.exact.prevent="onEditComment"
              />

              <div v-else class="space-y-1 pl-9">
                <div
                  v-dompurify-html="parsedHtmlComments[commentItem.id]"
                  class="nc-rich-text-content !text-small !leading-18px !text-nc-content-gray"
                  @click="handleDompurifyLinkClick"
                ></div>
              </div>

              <!-- Reactions row -->
              <div
                v-if="commentItem.id && (groupedReactions[commentItem.id]?.length || !editCommentValue)"
                class="flex items-center gap-1 flex-wrap pl-9 mt-1"
              >
                <NcTooltip
                  v-for="gr in groupedReactions[commentItem.id] || []"
                  :key="gr.reaction"
                >
                  <template #title>
                    {{ gr.users.map((u) => (u.id === user?.id ? 'You' : u.display_name || u.email || 'User')).join(', ') }}
                  </template>
                  <button
                    class="nc-comment-reaction-chip"
                    :class="{ 'nc-active': gr.isMyReaction }"
                    data-testid="nc-comment-reaction-chip"
                    @click="toggleReaction(commentItem.id!, gr.reaction)"
                  >
                    <span class="text-sm leading-none">{{ gr.reaction }}</span>
                    <span class="text-xs leading-none">{{ gr.count }}</span>
                  </button>
                </NcTooltip>

                <NcDropdown
                  v-if="isUIAllowed('commentReactionAdd') && !editCommentValue"
                  :trigger="['click']"
                  placement="bottomLeft"
                  overlay-class-name="nc-reaction-picker-dropdown"
                >
                  <button
                    v-e="['c:comment-expand:reaction:open']"
                    class="nc-comment-reaction-add"
                    data-testid="nc-comment-reaction-add"
                  >
                    <GeneralIcon icon="ncSmile" class="text-nc-content-gray-muted" />
                    <span class="text-nc-content-gray-muted text-xs">+</span>
                  </button>
                  <template #overlay>
                    <div class="nc-reaction-quick-pick" @click.stop>
                      <button
                        v-for="emoji in QUICK_REACTIONS"
                        :key="emoji"
                        class="nc-reaction-quick-btn"
                        @click="toggleReaction(commentItem.id!, emoji)"
                      >
                        {{ emoji }}
                      </button>
                      <NcDivider type="vertical" class="!h-6 !mx-0.5" />
                      <NcDropdown :trigger="['click']" placement="bottomLeft">
                        <button class="nc-reaction-quick-btn">
                          <GeneralIcon icon="ncPlus" class="text-nc-content-gray-subtle" />
                        </button>
                        <template #overlay>
                          <GeneralEmojiPicker
                            disable-clearing
                            @emoji-selected="(emoji: string) => { toggleReaction(commentItem.id!, emoji) }"
                          />
                        </template>
                      </NcDropdown>
                    </div>
                  </template>
                </NcDropdown>
              </div>

            </div>
          </div>

          <!-- Replies -->
          <div v-if="commentItem.replies?.length" class="nc-comment-replies">
            <div
              v-for="reply of commentItem.replies"
              :key="reply.id"
              class="nc-comment-item nc-comment-reply"
            >
              <div class="group gap-2 overflow-hidden pl-12 pr-3 py-1.5 transition-colors hover:bg-nc-bg-gray-light">
                <div class="flex items-start gap-2">
                  <GeneralUserIcon
                    :user="{
                      display_name: reply.created_display_name,
                      email: reply.created_by_email,
                      meta: reply.created_by_meta,
                    }"
                    class="mt-0.5"
                    size="small"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="truncate text-nc-content-gray font-medium !text-small !leading-[18px]">
                        {{ createdBy(reply) }}
                      </span>
                      <span class="text-xs text-nc-content-gray-muted flex-shrink-0">
                        {{ timeAgo(reply.created_at!) }}
                      </span>
                      <div class="flex-1" />
                      <NcButton
                        v-if="!editCommentValue && user && reply.created_by_email === user.email && hasEditPermission"
                        v-e="['c:row-expand:reply:delete']"
                        class="nc-comment-more-actions opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 !w-6 !h-6 !bg-transparent !hover:bg-nc-bg-gray-medium"
                        size="xsmall"
                        type="text"
                        @click="deleteComment(reply.id!)"
                      >
                        <GeneralIcon class="text-md" icon="delete" />
                      </NcButton>
                    </div>
                    <div
                      v-dompurify-html="parsedHtmlComments[reply.id]"
                      class="nc-rich-text-content !text-small !leading-18px !text-nc-content-gray mt-0.5"
                      @click="handleDompurifyLinkClick"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Reply input -->
          <div v-if="replyingTo === commentItem.id && hasEditPermission" class="nc-comment-reply-input pl-12 pr-3 py-2">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs text-nc-content-gray-muted">{{ $t('general.reply') }}</span>
              <NcButton class="!w-5 !h-5 !bg-transparent" size="xsmall" type="text" @click="cancelReply">
                <GeneralIcon class="text-nc-content-gray-muted" icon="close" />
              </NcButton>
            </div>
            <SmartsheetExpandedFormRichComment
              ref="replyInputRef"
              v-model:value="replyComment"
              :hide-options="false"
              :placeholder="`${$t('general.reply')}...`"
              class="expanded-form-comment-input !py-2 !px-2 cursor-text border-1 rounded-lg w-full bg-transparent !text-nc-content-gray !text-small !leading-18px !max-h-[160px]"
              autofocus
              data-testid="expanded-form-reply-input"
              @keydown="handleKeyPress"
              @keydown.enter.exact.prevent="saveReply"
              @keydown.esc="cancelReply"
              @save="saveReply"
            />
          </div>
        </div>
      </div>
      <div v-if="hasEditPermission" class="px-3 pb-3 nc-comment-input !rounded-br-2xl gap-2 flex">
        <SmartsheetExpandedFormRichComment
          ref="commentInputRef"
          v-model:value="comment"
          :hide-options="false"
          :placeholder="`${$t('general.comment')}...`"
          class="expanded-form-comment-input !py-2 !px-2 cursor-text border-1 rounded-lg w-full bg-transparent !text-nc-content-gray !text-small !leading-18px !max-h-[240px]"
          :autofocus="isExpandedFormCommentMode"
          data-testid="expanded-form-comment-input"
          @focus="isExpandedFormCommentMode = false"
          @keydown="handleKeyPress"
          @save="saveComment"
          @keydown.enter.exact.prevent="saveComment"
        />
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
    box-shadow: 0px 0px 0px 2px rgba(51, 102, 255, 0.24);
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
  .nc-resolve-comment-btn,
  .nc-reply-comment-btn,
  .nc-comment-more-actions {
    @apply !opacity-100 !pointer-events-auto;
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

.nc-comment-reaction-chip {
  @apply inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border-1 border-nc-border-gray-medium
    bg-nc-bg-default hover:bg-nc-bg-gray-light cursor-pointer transition-colors;

  &.nc-active {
    @apply border-nc-border-brand bg-nc-bg-brand-soft;
  }
}

.nc-comment-reaction-add {
  @apply inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border-1 border-dashed border-nc-border-gray-medium
    bg-nc-bg-default hover:bg-nc-bg-gray-light cursor-pointer transition-colors;
}

.nc-reaction-quick-pick {
  @apply flex items-center gap-0.5 p-1.5 bg-nc-bg-default rounded-lg;
}

.nc-reaction-quick-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-md text-lg hover:bg-nc-bg-gray-light cursor-pointer transition-colors;
}

.nc-comment-reply-input {
  @apply border-l-2 border-nc-border-gray-medium ml-3;
}
</style>

<style lang="scss">
.nc-rich-link-tooltip-popup {
  @apply text-xs bg-nc-content-gray text-nc-content-inverted-primary px-2 py-1 rounded-lg;
}
</style>
