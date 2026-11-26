<script setup lang="ts">
import type { CommentThread } from '~/composables/useRowComments'
import { COLLAPSE_AFTER_REPLIES } from '~/composables/useCommentThreadList'

defineProps<{
  thread: CommentThread
  /** Draw the "New" line above this thread. */
  showNewDivider?: boolean
  /** The host draws the root author's avatar outside the card (Discussion). */
  avatarOutside?: boolean
}>()

const { user, appInfo } = useGlobal()

const { isUIAllowed } = useRoles()

const {
  deleteComment,
  resolveComment,
  parsedHtmlComments,
  isCommentExtrasEnabled,
  getReactionSummary,
  toggleReaction,
  pinComment,
  isCommentUnread,
  threadSummaries,
  summarizeThread,
  dismissThreadSummary,
} = useRowCommentsOrThrow()

const {
  isCommentAttachmentsEnabled,
  hasEditPermission,
  hideCopyUrl,
  hideRoleInfo,
  assignableUsers,
  getUserRoleLabel,
  userName,
  createdBy,
  firstName,
  commentPlainText,
  imageAnnotations,
  annotationLabels,
  annotationRefByCommentId,
  viewAnnotationComment,
  hoveredCommentId,
  isThreadExpanded,
  isResolvedCollapsed,
  shownComments,
  setThreadExpanded,
  setResolvedOpen,
  unreadReplyCount,
  threadRepliers,
  canSummarize,
  handleResetHoverEffect,
  replyThreadId,
  reply,
  replyAttachments,
  isReplyAttachmentUploading,
  openReplyFilePicker,
  handleReplyAttachmentPaste,
  handleReplyAttachmentDrop,
  removeReplyAttachment,
  startReply,
  saveReply,
  onReplyEscape,
  onReplyBlur,
  editCommentValue,
  editAttachments,
  isEditAttachmentUploading,
  openEditFilePicker,
  handleEditAttachmentPaste,
  handleEditAttachmentDrop,
  removeEditAttachment,
  editValue,
  editComment,
  onEditCancel,
  onEditBlur,
  onEditComment,
  taskFormCommentId,
  toggleTaskDone,
  saveTask,
  removeTask,
  copyComment,
  handleKeyPress,
} = useCommentThreadListOrThrow()
</script>

<template>
  <div
    class="nc-comment-thread"
    :class="{ 'nc-comment-thread-resolved': !!thread.root.resolved_by }"
    :data-testid="`nc-comment-thread-${thread.root.id}`"
  >
    <div
      v-if="showNewDivider"
      class="nc-comment-new-divider flex items-center gap-2 px-3 py-1 text-[11px] font-semibold uppercase text-nc-content-red-medium"
      data-testid="nc-comment-new-divider"
    >
      <span class="h-px flex-1 bg-nc-border-red" />
      {{ $t('activity.commentThread.newDivider') }}
      <span class="h-px flex-1 bg-nc-border-red" />
    </div>

    <!-- Resolved: one line until opened -->
    <button
      v-if="isResolvedCollapsed(thread)"
      type="button"
      class="nc-comment-resolved-row mx-3 my-1 flex w-[calc(100%_-_24px)] items-center gap-2 rounded-lg border-1 border-nc-border-gray-light bg-nc-bg-gray-extralight px-2.5 py-1.5 text-left text-small cursor-pointer hover:bg-nc-bg-gray-light"
      :class="thread.root.id"
      data-testid="nc-comment-resolved-row"
      @click="setResolvedOpen(thread, true)"
    >
      <GeneralIcon icon="checkFill" class="flex-none w-3.5 h-3.5 rounded-full bg-nc-fill-green-dark text-white" />
      <span class="min-w-0 flex-1 truncate text-nc-content-gray-subtle">
        <span class="font-semibold text-nc-content-gray">{{ firstName(thread.root) }}:</span>
        {{ commentPlainText(thread.root) }}
      </span>
      <span class="flex-none text-xs text-nc-content-gray-muted">
        {{ $t('activity.commentThread.commentCount', { count: thread.replies.length + 1 }, thread.replies.length + 1) }}
      </span>
      <GeneralIcon icon="chevronDown" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />
    </button>

    <template v-else>
      <div
        v-for="commentItem of shownComments(thread)"
        :key="commentItem.id"
        :class="[
          commentItem.id,
          {
            'nc-comment-reply': commentItem !== thread.root,
            'opacity-75': !!thread.root.resolved_by,
          },
        ]"
        class="nc-comment-item"
        :data-testid="`nc-comment-item-${commentItem.id}`"
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
            'pl-3': commentItem !== thread.root,
          }"
          class="group relative min-w-0 px-3 py-2 transition-colors"
        >
          <div class="flex items-start gap-3">
            <GeneralUserIcon
              v-if="!(avatarOutside && commentItem === thread.root)"
              :user="{
                display_name: commentItem?.created_display_name,
                email: commentItem?.created_by_email,
                meta: commentItem?.created_by_meta,
              }"
              class="mt-0.5 flex-none"
              :size="commentItem === thread.root ? 'medium' : 'small'"
            />
            <div class="flex min-h-[24px] min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
              <NcDropdown placement="topLeft" :trigger="['hover']" class="min-w-0 max-w-full">
                <div
                  class="nc-comment-author truncate text-nc-content-gray font-medium !text-small !leading-[18px] overflow-hidden"
                >
                  {{ createdBy(commentItem) }}
                </div>

                <template #overlay>
                  <div class="bg-nc-bg-elevated rounded-lg">
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
                      v-if="!hideRoleInfo && isUIAllowed('dataEdit')"
                      keypath="labels.hasRoleInBase"
                      tag="div"
                      class="px-3 rounded-b-lg !text-[13px] items-center text-nc-content-gray-subtle2 flex gap-1 bg-nc-bg-gray-light py-1.5"
                    >
                      <template #role>
                        <span class="font-semibold text-nc-content-gray">
                          {{ getUserRoleLabel(commentItem.created_by_email!) }}
                        </span>
                      </template>
                    </i18n-t>
                  </div>
                </template>
              </NcDropdown>
              <div class="flex-none text-xs text-nc-content-gray-muted">
                {{ timeAgo(commentItem.created_at!) }}
              </div>
              <span
                v-if="isCommentUnread(commentItem)"
                class="nc-comment-unread-dot h-1.5 w-1.5 flex-none rounded-full bg-nc-fill-red-medium"
                data-testid="nc-comment-unread-dot"
              />
              <span
                v-if="isCommentExtrasEnabled && getCommentMeta(commentItem).pinned"
                class="inline-flex flex-none items-center gap-0.5 text-[11px] font-medium text-nc-content-brand"
              >
                <GeneralIcon icon="ncPin" class="w-3 h-3" />
              </span>
              <NcTooltip
                v-if="commentItem === thread.root && commentItem.resolved_by"
                class="flex flex-none"
                data-testid="nc-comment-resolved-badge"
              >
                <template #title>{{ `${$t('activity.resolvedBy')} ${commentItem.resolved_display_name_short}` }}</template>
                <span
                  class="inline-flex items-center gap-1 rounded-md bg-nc-bg-green-light px-1.5 py-0.5 text-[11px] font-medium text-nc-content-green-dark"
                >
                  <GeneralIcon icon="check" class="w-3 h-3" />
                  {{ $t('activity.commentThread.resolvedByName', { name: commentItem.resolved_display_name_short }) }}
                </span>
              </NcTooltip>
            </div>
          </div>

          <!-- Hover action bar -->
          <div
            v-if="!editCommentValue && !commentItem.id?.startsWith('temp-')"
            class="nc-comment-actions !hidden !group-hover:flex !group-focus-within:flex absolute right-2 -top-3.5 z-10 items-center gap-0.5 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-elevated p-0.5 shadow-sm"
            data-testid="nc-comment-actions"
          >
            <SmartsheetExpandedFormSidebarCommentReactionPicker
              v-if="isCommentExtrasEnabled && hasEditPermission"
              :reacted="
                getReactionSummary(commentItem.id)
                  .filter((item) => item.hasReacted)
                  .map((item) => item.emoji)
              "
              @react="toggleReaction(commentItem.id!, $event)"
            >
              <NcTooltip :title="$t('general.react')" placement="top" class="flex">
                <NcButton
                  class="!w-7 !h-7"
                  size="xsmall"
                  type="text"
                  :aria-label="$t('general.react')"
                  data-testid="nc-comment-react-btn"
                >
                  <GeneralIcon icon="ncSmile" class="w-3.5 h-3.5" />
                </NcButton>
              </NcTooltip>
            </SmartsheetExpandedFormSidebarCommentReactionPicker>

            <NcTooltip v-if="hasEditPermission" :title="$t('general.reply')" placement="top" class="flex">
              <NcButton
                v-e="['c:comment:reply']"
                class="!w-7 !h-7"
                size="xsmall"
                type="text"
                :aria-label="$t('general.reply')"
                data-testid="nc-comment-reply-btn"
                @click="startReply(commentItem)"
              >
                <GeneralIcon icon="ncCornerDownLeft" class="w-3.5 h-3.5" />
              </NcButton>
            </NcTooltip>

            <template v-if="appInfo.ee && commentItem === thread.root">
              <NcTooltip v-if="!commentItem.resolved_by && hasEditPermission" placement="top" class="flex">
                <NcButton
                  class="nc-resolve-comment-btn !w-7 !h-7"
                  size="xsmall"
                  type="text"
                  :aria-label="$t('activity.clickToResolve')"
                  @click="resolveComment(commentItem.id!)"
                >
                  <GeneralIcon icon="checkCircle" class="w-3.5 h-3.5" />
                </NcButton>
                <template #title>{{ $t('activity.clickToResolve') }}</template>
              </NcTooltip>
              <NcTooltip v-else-if="commentItem.resolved_by && hasEditPermission" placement="top" class="flex">
                <NcButton
                  class="nc-reopen-comment-btn !w-7 !h-7"
                  size="xsmall"
                  type="text"
                  :aria-label="$t('activity.commentThread.reopen')"
                  data-testid="nc-comment-reopen-btn"
                  @click="resolveComment(commentItem.id!)"
                >
                  <GeneralIcon icon="checkFill" class="w-3.5 h-3.5 rounded-full bg-nc-fill-green-dark text-white" />
                </NcButton>
                <template #title>{{ $t('activity.commentThread.reopen') }}</template>
              </NcTooltip>
            </template>

            <NcDropdown
              v-if="
                !hideCopyUrl ||
                (isCommentExtrasEnabled && hasEditPermission) ||
                (user && commentItem.created_by_email === user.email && hasEditPermission)
              "
              class="nc-comment-more-actions"
              overlay-class-name="!min-w-[180px]"
              placement="bottomRight"
            >
              <NcButton class="nc-expand-form-more-actions !w-7 !h-7" size="xsmall" type="text" :aria-label="$t('general.more')">
                <GeneralIcon icon="threeDotVertical" class="w-3.5 h-3.5" />
              </NcButton>
              <template #overlay>
                <NcMenu variant="small">
                  <template v-if="isCommentExtrasEnabled && hasEditPermission">
                    <NcMenuItem
                      data-testid="nc-comment-pin"
                      @click="pinComment(commentItem.id!, !getCommentMeta(commentItem).pinned)"
                    >
                      <div class="flex gap-2 items-center">
                        <GeneralIcon
                          :icon="getCommentMeta(commentItem).pinned ? 'ncPinOff' : 'ncPin'"
                          class="flex-none w-4 h-4"
                        />
                        {{
                          getCommentMeta(commentItem).pinned
                            ? $t('activity.commentThread.unpin')
                            : $t('activity.commentThread.pin')
                        }}
                      </div>
                    </NcMenuItem>
                    <NcMenuItem data-testid="nc-comment-task-menu" @click="taskFormCommentId = commentItem.id!">
                      <div class="flex gap-2 items-center">
                        <GeneralIcon icon="ncCheckSquare" />
                        {{
                          getCommentMeta(commentItem).task
                            ? $t('activity.commentThread.editTodo')
                            : $t('activity.commentThread.assignTodo')
                        }}
                      </div>
                    </NcMenuItem>
                  </template>
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
                  <NcMenuItem v-if="!hideCopyUrl" v-e="['c:comment-expand:comment:copy']" @click="copyComment(commentItem)">
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
                v-model:value="editValue"
                autofocus
                autofocus-to-end
                :hide-options="false"
                :extra-save-enabled="editAttachments.length > 0"
                class="expanded-form-comment-edit-input cursor-text expanded-form-comment-input !py-2 !px-2 !m-0 w-full !border-1 !border-nc-border-gray-medium !rounded-lg !bg-nc-bg-elevated !text-nc-content-gray !text-small !leading-18px !max-h-[240px]"
                data-testid="expanded-form-comment-input"
                @save="onEditComment"
                @keydown.esc="onEditCancel"
                @keydown="handleKeyPress"
                @blur="onEditBlur"
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
                      :aria-label="$t('activity.attachFile')"
                      @click="openEditFilePicker"
                    >
                      <GeneralIcon v-if="!isEditAttachmentUploading" icon="lucidePaperclip" class="h-3.5 w-3.5" />
                    </NcButton>
                  </NcTooltip>
                </template>
              </SmartsheetExpandedFormRichComment>
            </div>

            <div v-else class="space-y-1.5" :class="commentItem !== thread.root ? 'pl-7' : avatarOutside ? '' : 'pl-9'">
              <div
                v-if="annotationRefByCommentId[commentItem.id!] && commentItem.id === annotationRefByCommentId[commentItem.id!].rootId"
                class="nc-annotation-attachment inline-flex max-w-full items-center gap-2 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-elevated px-1.5 py-1"
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
                class="nc-comment-body nc-rich-text-content !text-small !leading-5 !text-nc-content-gray [overflow-wrap:anywhere]"
                @click="handleDompurifyLinkClick"
              ></div>
              <SmartsheetExpandedFormCommentAttachments
                v-if="commentItem.attachments?.length"
                :attachments="commentItem.attachments"
                :comment-id="commentItem.id"
                class="mt-1"
              />

              <div
                v-if="annotationLabels[commentItem.id] || (annotationRefByCommentId[commentItem.id!]?.matched && commentItem.id === annotationRefByCommentId[commentItem.id!].rootId)"
                class="nc-annotation-ref mt-1 inline-flex items-center gap-1.5 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-elevated px-1.5 py-0.5 cursor-pointer hover:bg-nc-bg-gray-light"
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

              <SmartsheetExpandedFormSidebarCommentTaskForm
                v-if="taskFormCommentId === commentItem.id"
                :task="getCommentMeta(commentItem).task"
                :users="assignableUsers"
                @save="saveTask(commentItem, $event)"
                @remove="removeTask(commentItem)"
                @cancel="taskFormCommentId = null"
              />
              <SmartsheetExpandedFormSidebarCommentTask
                v-else-if="isCommentExtrasEnabled && getCommentMeta(commentItem).task"
                :task="getCommentMeta(commentItem).task!"
                :assignee-name="userName(getCommentMeta(commentItem).task!.assignee)"
                :can-edit="hasEditPermission"
                @toggle="toggleTaskDone(commentItem, $event)"
                @edit="taskFormCommentId = commentItem.id!"
              />

              <SmartsheetExpandedFormSidebarCommentReactions
                v-if="isCommentExtrasEnabled"
                :summary="getReactionSummary(commentItem.id)"
                :can-react="hasEditPermission"
                @react="toggleReaction(commentItem.id!, $event)"
              />

              <!-- Thread controls under the root comment -->
              <div
                v-if="commentItem === thread.root && (thread.replies.length || thread.root.resolved_by)"
                class="flex flex-wrap items-center gap-x-3 gap-y-1"
              >
                <button
                  v-if="thread.replies.length && !isThreadExpanded(thread)"
                  type="button"
                  class="nc-comment-thread-summary-btn -ml-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md text-left px-1 py-0.5 text-xs font-semibold text-nc-content-brand hover:bg-nc-bg-brand cursor-pointer"
                  data-testid="nc-comment-thread-expand"
                  @click="setThreadExpanded(thread, true)"
                >
                  <span class="flex -space-x-1">
                    <GeneralUserIcon
                      v-for="replier of threadRepliers(thread)"
                      :key="replier.id"
                      :user="{
                        display_name: replier.created_display_name,
                        email: replier.created_by_email,
                        meta: replier.created_by_meta,
                      }"
                      size="small"
                      class="border-1 border-nc-bg-default rounded-full"
                    />
                  </span>
                  <span class="whitespace-nowrap">
                    {{ $t('activity.commentThread.replyCount', { count: thread.replies.length }, thread.replies.length) }}
                  </span>
                  <template v-if="unreadReplyCount(thread)">
                    <span class="inline-flex items-center gap-1 whitespace-nowrap text-nc-content-red-medium">
                      <span class="h-1.5 w-1.5 rounded-full bg-nc-fill-red-medium" />
                      {{ $t('activity.commentThread.newCount', { count: unreadReplyCount(thread) }) }}
                    </span>
                  </template>
                  <span class="whitespace-nowrap font-normal text-nc-content-gray-muted">
                    {{
                      $t('activity.commentThread.lastReply', {
                        time: timeAgo(thread.replies[thread.replies.length - 1]!.created_at!),
                      })
                    }}
                  </span>
                </button>
                <button
                  v-else-if="thread.replies.length > COLLAPSE_AFTER_REPLIES"
                  type="button"
                  class="-ml-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-nc-content-gray-subtle hover:bg-nc-bg-gray-medium cursor-pointer"
                  data-testid="nc-comment-thread-collapse"
                  @click="setThreadExpanded(thread, false)"
                >
                  <GeneralIcon icon="ncChevronUp" class="w-3.5 h-3.5" />
                  {{ $t('activity.commentThread.hideReplies', { count: thread.replies.length }, thread.replies.length) }}
                </button>

                <button
                  v-if="canSummarize(thread) && !threadSummaries[thread.root.id!]"
                  type="button"
                  class="flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-semibold text-nc-content-purple-dark hover:bg-nc-bg-purple-light cursor-pointer"
                  data-testid="nc-comment-thread-summarize"
                  @click="summarizeThread(thread.root.id!)"
                >
                  <GeneralIcon icon="ncAutoAwesome" class="w-3.5 h-3.5 !text-current" />
                  {{ $t('activity.commentThread.summarize') }}
                </button>

                <button
                  v-if="thread.root.resolved_by"
                  type="button"
                  class="flex items-center gap-1 rounded-md px-1 py-0.5 text-xs text-nc-content-gray-subtle hover:bg-nc-bg-gray-medium cursor-pointer"
                  data-testid="nc-comment-resolved-collapse"
                  @click="setResolvedOpen(thread, false)"
                >
                  <GeneralIcon icon="ncChevronUp" class="w-3.5 h-3.5" />
                  {{ $t('general.collapse') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="threadSummaries[thread.root.id!]" class="px-3 pb-2 pl-12">
        <SmartsheetExpandedFormSidebarCommentSummary
          :summary="threadSummaries[thread.root.id!]!"
          @dismiss="dismissThreadSummary(thread.root.id!)"
        />
      </div>

      <div
        v-if="replyThreadId === thread.root.id && hasEditPermission"
        class="nc-comment-reply-composer nc-comment-reply flex flex-col gap-1 py-2 pl-3 pr-3"
        @paste="isCommentAttachmentsEnabled ? handleReplyAttachmentPaste($event) : undefined"
        @dragover.prevent
        @drop="isCommentAttachmentsEnabled ? handleReplyAttachmentDrop($event) : undefined"
        @keydown.esc.capture="onReplyEscape"
      >
        <div class="flex items-start gap-2">
          <GeneralUserIcon :user="user" size="small" class="mt-2 flex-none" />
          <SmartsheetExpandedFormRichComment
            v-model:value="reply"
            autofocus
            hide-options
            :placeholder="$t('activity.commentThread.replyPlaceholder')"
            class="expanded-form-comment-input nc-comment-reply-input !py-1 !px-1.5 cursor-text border-1 rounded-lg min-w-0 flex-1 bg-transparent !text-nc-content-gray !text-small !leading-18px !max-h-[200px]"
            data-testid="nc-comment-reply-input"
            @keydown="handleKeyPress"
            @blur="onReplyBlur"
            @save="saveReply"
            @keydown.enter.exact.prevent="saveReply"
          />
          <div class="flex flex-none items-center gap-0.5 pt-0.5">
            <NcTooltip v-if="isCommentAttachmentsEnabled" :title="$t('activity.attachFile')" placement="top">
              <NcButton
                v-e="['c:comment:attach-file']"
                type="text"
                size="xsmall"
                class="nc-comment-attach-btn !h-7 !w-7"
                :loading="isReplyAttachmentUploading"
                :disabled="isReplyAttachmentUploading"
                :aria-label="$t('activity.attachFile')"
                @mousedown.prevent
                @click="openReplyFilePicker"
              >
                <GeneralIcon v-if="!isReplyAttachmentUploading" icon="lucidePaperclip" class="h-3.5 w-3.5" />
              </NcButton>
            </NcTooltip>
            <NcButton
              class="nc-comment-reply-send !h-7 !w-7 !shadow-none"
              size="xsmall"
              :disabled="(!reply.trim() && !replyAttachments.length) || isReplyAttachmentUploading"
              :aria-label="$t('general.send')"
              data-testid="nc-comment-reply-send"
              @mousedown.prevent
              @click="saveReply"
            >
              <GeneralIcon icon="ncSendAlt" />
            </NcButton>
          </div>
        </div>
        <SmartsheetExpandedFormCommentAttachments
          v-if="replyAttachments.length"
          :attachments="replyAttachments"
          editable
          class="pl-7"
          @remove="removeReplyAttachment"
        />
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
:deep(.expanded-form-comment-input) {
  @apply transition-all duration-150 min-h-8;
  box-shadow: none;
  &:focus,
  &:focus-within {
    @apply min-h-16 !bg-nc-bg-elevated border-nc-border-brand;
    box-shadow: 0px 0px 0px 2px rgba(var(--nc-brand-accent-rgb), 0.24);
  }
  &::placeholder {
    @apply !text-gray-400;
  }
}

:deep(.expanded-form-comment-edit-input .nc-comment-rich-editor) {
  @apply bg-nc-bg-elevated;
}

.nc-hovered-comment .nc-comment-actions,
.nc-comment-actions:focus-within {
  @apply !flex;
}

.nc-comment-reply {
  @apply ml-6 border-l-1 border-nc-border-gray-medium;
}

:deep(.nc-rich-link-tooltip) {
  @apply text-nc-content-gray-muted;
}

.nc-rich-text-content {
  p {
    @apply !m-0 !leading-5;
  }
}

[theme='dark'] .expanded-form-comment-input {
  background-color: var(--nc-bg-input) !important;
}
</style>
