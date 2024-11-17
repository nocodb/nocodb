<script setup lang="ts">
import { type CommentType, ProjectRoles } from 'nocodb-sdk'

const { user, appInfo } = useGlobal()

const { dashboardUrl } = useDashboard()

const { isUIAllowed } = useRoles()

const { copy } = useClipboard()

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
  loadComments,
  updateComment,
  saveComment: _saveComment,
  primaryKey,
} = useRowCommentsOrThrow()

const editCommentValue = ref<CommentType>()

const commentsWrapperEl = ref<HTMLDivElement>()

const isEditing = ref<boolean>(false)

const isCommentMode = ref(false)

const hoveredCommentId = ref<null | string>(null)

const commentInputRef = ref<any>()

const comment = ref('')

const router = useRouter()

const baseUsers = computed(() => (meta.value?.base_id ? basesUser.value.get(meta.value?.base_id) || [] : []))

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
  } catch (e) {
    console.error(e)
  }
}

const copyComment = async (comment: CommentType) => {
  await copy(
    encodeURI(
      `${dashboardUrl?.value}#/${route.params.typeOrId}/${route.params.baseId}/${meta.value?.id}?rowId=${primaryKey.value}&commentId=${comment.id}`,
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
    created_display_name?: string
  },
) => {
  if (comment.created_by === user.value?.id) {
    return 'You'
  } else if (comment.created_display_name?.trim()) {
    return comment.created_display_name || 'Shared source'
  } else if (comment.created_by_email) {
    return comment.created_by_email
  } else {
    return 'Shared source'
  }
}

const editedAt = (comment: CommentType) => {
  if (comment.updated_at !== comment.created_at && comment.updated_at) {
    const str = timeAgo(comment.updated_at).replace(' ', '_')
    return `[(edited)](a~~~###~~~Edited_${str}) `
  }
  return ''
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

  return user.roles || ProjectRoles.NO_ACCESS
}
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
        <div class="text-center text-3xl text-gray-700">
          <GeneralIcon icon="commentHere" />
        </div>
        <div class="font-medium text-center my-6 text-gray-500">
          {{ hasEditPermission ? $t('activity.startCommenting') : $t('activity.noCommentsYet') }}
        </div>
      </div>
      <div v-else ref="commentsWrapperEl" class="flex flex-col h-full py-1 nc-scrollbar-thin">
        <div
          v-for="commentItem of comments"
          :key="commentItem.id"
          :class="`${commentItem.id}`"
          class="nc-comment-item"
          @mouseover="handleResetHoverEffect"
        >
          <div
            :class="{
                  'hover:bg-gray-100': editCommentValue?.id !== commentItem!.id,
                  'nc-hovered-comment bg-gray-100': hoveredCommentId === commentItem!.id
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
                  :email="commentItem.created_by_email"
                  :name="commentItem.created_display_name"
                  class="mt-0.5"
                  size="medium"
                />
                <div class="flex h-[28px] items-center gap-3 w-[calc(100%_-_40px)]">
                  <NcDropdown placement="topLeft" :trigger="['hover']" class="flex-none max-w-[calc(100%_-_72px)]">
                    <div class="truncate text-gray-800 font-medium !text-small !leading-[18px] overflow-hidden">
                      {{ createdBy(commentItem) }}
                    </div>

                    <template #overlay>
                      <div class="bg-white rounded-lg">
                        <div class="flex items-center gap-4 py-3 px-2">
                          <GeneralUserIcon
                            class="!w-8 !h-8 border-1 border-gray-200 rounded-full"
                            :name="commentItem.created_display_name"
                            :email="commentItem.created_by_email"
                          />
                          <div class="flex flex-col">
                            <div class="font-semibold text-gray-800">
                              {{ createdBy(commentItem) }}
                            </div>
                            <div class="text-xs text-gray-600">
                              {{ commentItem.created_by_email }}
                            </div>
                          </div>
                        </div>
                        <div
                          v-if="isUIAllowed('dataEdit')"
                          class="px-3 rounded-b-lg !text-[13px] items-center text-gray-600 flex gap-1 bg-gray-100 py-1.5"
                        >
                          Has <RolesBadge size="sm" :border="false" :role="getUserRole(commentItem.created_by_email!)" />
                          role in base
                        </div>
                      </div>
                    </template>
                  </NcDropdown>
                  <div class="text-xs text-gray-500">
                    {{ timeAgo(commentItem.created_at!) }}
                  </div>
                </div>
              </div>
              <div class="flex items-center">
                <NcDropdown
                  v-if="!editCommentValue"
                  class="nc-comment-more-actions !hidden !group-hover:block"
                  overlay-class-name="!min-w-[160px]"
                  placement="bottomRight"
                >
                  <NcButton
                    class="nc-expand-form-more-actions !hover:bg-gray-200 !w-7 !h-7 !bg-transparent"
                    size="xsmall"
                    type="text"
                  >
                    <GeneralIcon class="text-md" icon="threeDotVertical" />
                  </NcButton>
                  <template #overlay>
                    <NcMenu>
                      <NcMenuItem
                        v-if="user && commentItem.created_by_email === user.email && hasEditPermission"
                        v-e="['c:comment-expand:comment:edit']"
                        class="text-gray-700"
                        @click="editComment(commentItem)"
                      >
                        <div class="flex gap-2 items-center">
                          <component :is="iconMap.rename" class="cursor-pointer" />
                          {{ $t('general.edit') }}
                        </div>
                      </NcMenuItem>
                      <NcMenuItem v-e="['c:comment-expand:comment:copy']" class="text-gray-700" @click="copyComment(commentItem)">
                        <div class="flex gap-2 items-center">
                          <component :is="iconMap.copy" class="cursor-pointer" />
                          {{ $t('general.copy') }} URL
                        </div>
                      </NcMenuItem>
                      <template v-if="user && commentItem.created_by_email === user.email && hasEditPermission">
                        <NcDivider />
                        <NcMenuItem
                          v-e="['c:row-expand:comment:delete']"
                          class="!text-red-500 !hover:bg-red-50"
                          @click="deleteComment(commentItem.id!)"
                        >
                          <div class="flex gap-2 items-center">
                            <component :is="iconMap.delete" class="cursor-pointer" />
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
                      class="nc-resolve-comment-btn !w-7 !h-7 !bg-transparent !hover:bg-gray-200 !hidden !group-hover:block"
                      size="xsmall"
                      type="text"
                      @click="resolveComment(commentItem.id!)"
                    >
                      <GeneralIcon class="text-md" icon="checkCircle" />
                    </NcButton>

                    <template #title>Click to resolve </template>
                  </NcTooltip>

                  <NcTooltip v-else-if="commentItem.resolved_by">
                    <template #title>{{ `Resolved by ${commentItem.resolved_display_name}` }}</template>
                    <NcButton
                      class="!h-7 !w-7 !bg-transparent !hover:bg-gray-200 text-semibold"
                      size="xsmall"
                      type="text"
                      @click="resolveComment(commentItem.id!)"
                    >
                      <GeneralIcon class="text-md rounded-full bg-[#17803D] text-white" icon="checkFill" />
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
                :hide-options="false"
                class="expanded-form-comment-edit-input cursor-text expanded-form-comment-input !py-2 !px-2 !m-0 w-full !border-1 !border-gray-200 !rounded-lg !bg-white !text-gray-800 !text-small !leading-18px !max-h-[240px]"
                data-testid="expanded-form-comment-input"
                sync-value-change
                @save="onEditComment"
                @keydown.esc="onCancel"
                @blur="
                  () => {
                    editCommentValue = undefined
                    isEditing = false
                  }
                "
                @keydown.enter.exact.prevent="onEditComment"
              />

              <div v-else class="space-y-1 pl-9">
                <SmartsheetExpandedFormRichComment
                  :value="`${commentItem.comment}  ${editedAt(commentItem)}`"
                  class="!text-small !leading-18px !text-gray-800 -ml-1"
                  read-only
                  sync-value-change
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="hasEditPermission" class="px-3 pb-3 nc-comment-input !rounded-br-2xl gap-2 flex">
        <SmartsheetExpandedFormRichComment
          ref="commentInputRef"
          v-model:value="comment"
          :hide-options="false"
          placeholder="Comment..."
          class="expanded-form-comment-input !py-2 !px-2 cursor-text border-1 rounded-lg w-full bg-transparent !text-gray-800 !text-small !leading-18px !max-h-[240px]"
          :autofocus="isExpandedFormCommentMode"
          data-testid="expanded-form-comment-input"
          @focus="isExpandedFormCommentMode = false"
          @keydown.stop
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
    @apply min-h-16 !bg-white border-brand-500;
    box-shadow: 0px 0px 0px 2px rgba(51, 102, 255, 0.24);
  }
  &::placeholder {
    @apply !text-gray-400;
  }
}

:deep(.expanded-form-comment-edit-input .nc-comment-rich-editor) {
  @apply bg-white;
}

.nc-hovered-comment {
  .nc-expand-form-more-actions,
  .nc-resolve-comment-btn {
    @apply !block;
  }
}
</style>
