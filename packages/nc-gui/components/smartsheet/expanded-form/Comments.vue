<script setup lang="ts">
import { type CommentType, ProjectRoles } from 'nocodb-sdk'

const props = defineProps<{
  loading: boolean
}>()

const {
  loadComments,
  deleteComment,
  comments,
  resolveComment,
  audits,
  isAuditLoading,
  saveComment: _saveComment,
  comment: newComment,
  updateComment,
} = useExpandedFormStoreOrThrow()

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const commentsWrapperEl = ref<HTMLDivElement>()

const commentInputRef = ref<any>()

const editRef = ref<any>()

const { user, appInfo } = useGlobal()

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const meta = inject(MetaInj, ref())

const baseUsers = computed(() => (meta.value?.base_id ? basesUser.value.get(meta.value?.base_id) || [] : []))

const isExpandedFormLoading = computed(() => props.loading)

const tab = ref<'comments' | 'audits'>('comments')

const { isUIAllowed } = useRoles()

const router = useRouter()

const hasEditPermission = computed(() => isUIAllowed('commentEdit'))

const editComment = ref<CommentType>()

const isEditing = ref<boolean>(false)

const isCommentMode = ref(false)

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    onKeyEsc(event)
  } else if (event.key === 'Enter' && !event.shiftKey) {
    onKeyEnter(event)
  }
}

function onKeyEnter(event: KeyboardEvent) {
  event.stopImmediatePropagation()
  event.preventDefault()
  onEditComment()
}

function onKeyEsc(event: KeyboardEvent) {
  event.stopImmediatePropagation()
  event.preventDefault()
  onCancel()
}

async function onEditComment() {
  if (!isEditing.value || !editComment.value) return

  isCommentMode.value = true

  await updateComment(editComment.value.id!, {
    comment: editComment.value?.comment,
  })
  onStopEdit()
}

function onCancel() {
  if (!isEditing.value) return
  editComment.value = undefined
  onStopEdit()
}

function onStopEdit() {
  loadComments()
  isEditing.value = false
  editComment.value = undefined
}

onKeyStroke('Enter', (event) => {
  if (isEditing.value) {
    onKeyEnter(event)
  }
})

function editComments(comment: CommentType) {
  editComment.value = comment
  isEditing.value = true
}

const value = computed({
  get() {
    return editComment.value?.comment || ''
  },
  set(val) {
    if (!editComment.value) return
    editComment.value.comment = val
  },
})

function scrollComments() {
  if (commentsWrapperEl.value) {
    commentsWrapperEl.value.scrollTo({
      top: commentsWrapperEl.value.scrollHeight,
      behavior: 'smooth',
    })
  }
}

const isSaving = ref(false)

const saveComment = async () => {
  if (isSaving.value) return

  isCommentMode.value = true
  isSaving.value = true
  // Optimistic Insert

  comments.value = [
    ...comments.value,
    {
      id: `temp-${new Date().getTime()}`,
      comment: newComment.value,
      created_at: new Date().toISOString(),
      created_by: user.value?.id,
      created_by_email: user.value?.email,
      created_display_name: user.value?.display_name ?? '',
    },
  ]

  commentInputRef?.value?.setEditorContent('', true)
  await nextTick(() => {
    scrollComments()
  })

  try {
    await _saveComment()
    await nextTick(() => {
      isExpandedFormCommentMode.value = true
    })
    scrollComments()
  } catch (e) {
    console.error(e)
  } finally {
    isSaving.value = false
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
      } else {
        scrollComments()
      }
    })
  }, 100)
})

const timesAgo = (comment: CommentType) => {
  return comment.created_at !== comment.updated_at ? `edited ${timeAgo(comment.updated_at!)}` : timeAgo(comment.created_at!)
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

const getUserRole = (email: string) => {
  const user = baseUsers.value.find((user) => user.email === email)
  if (!user) return ProjectRoles.NO_ACCESS

  return user.roles
}
</script>

<template>
  <div class="flex flex-col !h-full w-full">
    <NcTabs v-model:activeKey="tab" class="h-full">
      <a-tab-pane key="comments" class="w-full h-full">
        <template #tab>
          <div v-e="['c:row-expand:comment']" class="flex items-center gap-2">
            <GeneralIcon icon="messageCircle" class="w-4 h-4" />
            <span class="<lg:hidden"> Comments </span>
          </div>
        </template>
        <div
          class="h-full"
          :class="{
            'pb-1': tab !== 'comments' && !appInfo.ee,
          }"
        >
          <div v-if="isExpandedFormLoading" class="flex flex-col h-full">
            <GeneralLoader class="!mt-16" size="xlarge" />
          </div>
          <div v-else class="flex flex-col h-full">
            <div v-if="comments.length === 0" class="flex flex-col my-1 text-center justify-center h-full nc-scrollbar-thin">
              <div class="text-center text-3xl text-gray-700">
                <GeneralIcon icon="commentHere" />
              </div>
              <div class="font-medium text-center my-6 text-gray-500">{{ $t('activity.startCommenting') }}</div>
            </div>
            <div v-else ref="commentsWrapperEl" class="flex flex-col h-full py-1 nc-scrollbar-thin">
              <div v-for="comment of comments" :key="comment.id" :class="`${comment.id}`" class="nc-comment-item">
                <div
                  :class="{
                    'hover:bg-gray-200': comment.id !== editComment?.id,
                    'bg-gray-200': comment.id === editComment?.id,
                    '!bg-gray-100': comment.resolved_by,
                  }"
                  class="group gap-3 overflow-hidden px-3 py-2"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex items-start gap-3">
                      <GeneralUserIcon
                        :email="comment.created_by_email"
                        :name="comment.created_display_name"
                        class="mt-0.5"
                        size="medium"
                      />
                      <div class="flex h-[28px] items-center gap-3">
                        <NcDropdown placement="topLeft" :trigger="['hover']">
                          <span class="text-ellipsis text-gray-800 !text-[13px] max-w-42 overflow-hidden" :style="{}">
                            {{ createdBy(comment) }}
                          </span>

                          <template #overlay>
                            <div class="bg-white rounded-md">
                              <div class="flex items-center gap-1 py-2 px-4">
                                <GeneralUserIcon
                                  class="!w-9 !h-9"
                                  :name="comment.created_display_name"
                                  :email="comment.created_by_email"
                                />
                                <div class="flex flex-col">
                                  <div class="font-semibold text-gray-800">
                                    {{ createdBy(comment) }}
                                  </div>
                                  <div class="text-xs text-gray-400">
                                    {{ comment.created_by_email }}
                                  </div>
                                </div>
                              </div>
                              <div class="px-4 rounded-b-md flex gap-1 bg-gray-100 py-2">
                                Has <RolesBadge size="sm" :border="false" :role="getUserRole(comment.created_by_email!)" />
                                role in base
                              </div>
                            </div>
                          </template>
                        </NcDropdown>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <div v-if="appInfo.ee">
                        <NcTooltip v-if="!comment.resolved_by">
                          <NcButton
                            class="!w-7 !h-7 !bg-transparent !hidden !group-hover:block"
                            size="xsmall"
                            type="text"
                            @click="resolveComment(comment.id!)"
                          >
                            <GeneralIcon class="text-md" icon="checkCircle" />
                          </NcButton>

                          <template #title>Click to resolve </template>
                        </NcTooltip>

                        <NcTooltip v-else>
                          <template #title>{{ `Resolved by ${comment.resolved_display_name}` }}</template>
                          <NcButton
                            class="!h-7 !w-7 !bg-transparent text-semibold !text-[#17803D]"
                            size="xsmall"
                            type="text"
                            @click="resolveComment(comment.id)"
                          >
                            <GeneralIcon class="text-md" icon="checkCircle" />
                          </NcButton>
                        </NcTooltip>
                      </div>
                      <NcDropdown
                        v-if="(comment.created_by_email === user!.email && !editComment )"
                        :class="{
                        '!hidden !group-hover:block': comment.created_by_email === user!.email && !editComment,
                        }"
                        overlay-class-name="!min-w-[160px]"
                        placement="bottomRight"
                      >
                        <NcButton class="nc-expand-form-more-actions !w-7 !h-7 !bg-transparent" size="xsmall" type="text">
                          <GeneralIcon class="text-md" icon="threeDotVertical" />
                        </NcButton>
                        <template #overlay>
                          <NcMenu>
                            <NcMenuItem
                              v-e="['c:comment-expand:comment:edit']"
                              class="text-gray-700"
                              @click="editComments(comment)"
                            >
                              <div class="flex gap-2 items-center">
                                <component :is="iconMap.rename" class="cursor-pointer" />
                                {{ $t('general.edit') }}
                              </div>
                            </NcMenuItem>
                            <NcMenuItem
                              v-e="['c:row-expand:comment:delete']"
                              class="!text-red-500 !hover:bg-red-50"
                              @click="deleteComment(comment.id!)"
                            >
                              <div class="flex gap-2 items-center">
                                <component :is="iconMap.delete" class="cursor-pointer" />
                                {{ $t('general.delete') }}
                              </div>
                            </NcMenuItem>
                          </NcMenu>
                        </template>
                      </NcDropdown>
                    </div>
                  </div>
                  <div class="flex-1 flex flex-col gap-1 mt-1 max-w-[calc(100%)]">
                    <SmartsheetExpandedFormRichComment
                      v-if="comment.id === editComment?.id"
                      ref="editRef"
                      v-model:value="value"
                      autofocus
                      :hide-options="false"
                      class="expanded-form-comment-edit-input expanded-form-comment-input !pt-2 !pb-0.5 !pl-2 !m-0 w-full !border-1 !border-gray-200 !rounded-lg !bg-white !text-gray-800 !text-small !leading-18px !max-h-[694px]"
                      data-testid="expanded-form-comment-input"
                      sync-value-change
                      @save="onEditComment"
                      @keydown.stop="onKeyDown"
                      @blur="
                        () => {
                          editComment = undefined
                          isEditing = false
                        }
                      "
                      @keydown.enter.exact.prevent="onEditComment"
                    />

                    <div v-else class="text-small space-y-1 pl-9 leading-18px text-gray-800">
                      <SmartsheetExpandedFormRichComment
                        :value="comment.comment"
                        class="!text-small !leading-18px !text-gray-800 -ml-1"
                        read-only
                        sync-value-change
                      />
                      <div class="text-xs text-gray-500">
                        {{ timesAgo(comment) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="hasEditPermission" class="bg-white nc-comment-input !rounded-br-2xl gap-2 flex">
              <SmartsheetExpandedFormRichComment
                ref="commentInputRef"
                v-model:value="newComment"
                :hide-options="false"
                placeholder="Comment..."
                class="expanded-form-comment-input !m-0 pt-2 w-full !border-t-1 !border-gray-200 !bg-transparent !text-gray-800 !text-small !leading-18px !max-h-[566px]"
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
      </a-tab-pane>

      <a-tab-pane key="audits" class="w-full" :disabled="appInfo.ee">
        <template #tab>
          <NcTooltip v-if="appInfo.ee" class="tab flex-1">
            <template #title>{{ $t('title.comingSoon') }}</template>

            <div v-e="['c:row-expand:audit']" class="flex items-center gap-2 text-gray-400">
              <GeneralIcon icon="audit" class="w-4 h-4" />
              <span class="<lg:hidden"> Audits </span>
            </div>
          </NcTooltip>

          <div v-else v-e="['c:row-expand:audit']" class="flex items-center gap-2">
            <GeneralIcon icon="audit" class="w-4 h-4" />
            <span class="<lg:hidden"> Audits </span>
          </div>
        </template>
        <div
          class="h-full"
          :class="{
            'pb-1': !appInfo.ee,
          }"
        >
          <div v-if="isExpandedFormLoading || isAuditLoading" class="flex flex-col h-full">
            <GeneralLoader class="!mt-16" size="xlarge" />
          </div>

          <div v-else ref="commentsWrapperEl" class="flex flex-col h-full py-1 nc-scrollbar-thin !overflow-y-auto">
            <template v-if="audits.length === 0">
              <div class="flex flex-col text-center justify-center h-full">
                <div class="text-center text-3xl text-gray-600">
                  <MdiHistory />
                </div>
                <div class="font-bold text-center my-1 text-gray-600">See changes to this record</div>
              </div>
            </template>

            <div v-for="audit of audits" :key="audit.id" class="nc-audit-item">
              <div class="group gap-3 overflow-hidden flex items-start p-3">
                <GeneralUserIcon size="medium" :email="audit.user" :name="audit.display_name" />
                <div class="flex-1 flex flex-col gap-1 max-w-[calc(100%_-_24px)]">
                  <div class="flex flex-wrap items-center min-h-7">
                    <NcTooltip class="truncate max-w-42 mr-2" show-on-truncate-only>
                      <template #title>
                        {{ audit.display_name?.trim() || audit.user || 'Shared source' }}
                      </template>
                      <span class="text-ellipsis break-keep inline whitespace-nowrap overflow-hidden font-bold text-gray-800">
                        {{ audit.display_name?.trim() || audit.user || 'Shared source' }}
                      </span>
                    </NcTooltip>
                    <div class="text-xs text-gray-400">
                      {{ timeAgo(audit.created_at) }}
                    </div>
                  </div>
                  <div v-dompurify-html="audit.details" class="text-sm font-medium"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </a-tab-pane>
    </NcTabs>
  </div>
</template>

<style lang="scss" scoped>
.tab {
  @apply max-w-1/2;
}

.nc-comment-input {
  :deep(.nc-comment-rich-editor) {
    @apply !ml-1;
  }
}

.nc-audit-item {
  @apply border-b-1 gap-3 border-gray-200;
}

.nc-audit-item:last-child {
  @apply border-b-0;
}

.tab .tab-title {
  @apply min-w-0 flex justify-center gap-2 font-semibold items-center;
  word-break: 'keep-all';
  white-space: 'nowrap';
  display: 'inline';
}

.text-decoration-line-through {
  text-decoration: line-through;
}

:deep(.red.lighten-4) {
  @apply bg-red-100 rounded-md line-through;
}

:deep(.green.lighten-4) {
  @apply bg-green-100 rounded-md !mr-3 !leading-6;
}

:deep(.ant-tabs) {
  @apply !overflow-visible;
  .ant-tabs-nav {
    @apply px-3;
    .ant-tabs-nav-list {
      @apply w-[99%] mx-auto gap-6;

      .ant-tabs-tab {
        @apply flex-1 flex items-center justify-center pt-3 pb-2.5;

        & + .ant-tabs-tab {
          @apply !ml-0;
        }
      }
    }
  }
  .ant-tabs-content-holder {
    .ant-tabs-content {
      @apply h-full;
    }
  }
}

:deep(.expanded-form-comment-input) {
  @apply transition-all duration-150 min-h-8;
  box-shadow: none;
  &:focus,
  &:focus-within {
    @apply min-h-16;
  }
  &::placeholder {
    @apply !text-gray-400;
  }
}

:deep(.expanded-form-comment-edit-input .nc-comment-rich-editor) {
  @apply !pl-2 bg-white;
}
</style>
