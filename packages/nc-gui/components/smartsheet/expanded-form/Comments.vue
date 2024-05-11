<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import type { AuditType } from 'nocodb-sdk'
import { timeAgo } from 'nocodb-sdk'
import { Icon } from '@iconify/vue'

const props = defineProps<{
  loading: boolean
}>()

const { loadCommentsAndLogs, commentsAndLogs, saveComment: _saveComment, comment, updateComment } = useExpandedFormStoreOrThrow()

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const commentsWrapperEl = ref<HTMLDivElement>()

const { user, appInfo } = useGlobal()

const isExpandedFormLoading = computed(() => props.loading)

const tab = ref<'comments' | 'audits'>('comments')

const { isUIAllowed } = useRoles()

const hasEditPermission = computed(() => isUIAllowed('commentEdit'))

const editLog = ref<AuditType>()

const isEditing = ref<boolean>(false)

const isCommentMode = ref(false)

const focusCommentInput: VNodeRef = (el) => {
  if (!isExpandedFormLoading.value && (isCommentMode.value || isExpandedFormCommentMode.value) && !isEditing.value) {
    if (isExpandedFormCommentMode.value) {
      setTimeout(() => {
        isExpandedFormCommentMode.value = false
      }, 400)
    }
    return (el as HTMLInputElement)?.focus()
  }
  return el
}
const focusInput: VNodeRef = (el) => (el as HTMLInputElement)?.focus()

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
  if (!isEditing.value || !editLog.value) return

  isCommentMode.value = true

  await updateComment(editLog.value.id!, {
    description: editLog.value.description,
  })
  onStopEdit()
}

function onCancel() {
  if (!isEditing.value) return
  editLog.value = undefined
  onStopEdit()
}

function onStopEdit() {
  loadCommentsAndLogs()
  isEditing.value = false
  editLog.value = undefined
}

onKeyStroke('Enter', (event) => {
  if (isEditing.value) {
    onKeyEnter(event)
  }
})

const comments = computed(() => commentsAndLogs.value.filter((log) => log.op_type === 'COMMENT'))
const audits = computed(() => commentsAndLogs.value.filter((log) => log.op_type !== 'COMMENT' && log.details))

function editComment(log: AuditType) {
  editLog.value = log
  isEditing.value = true
}

const value = computed({
  get() {
    return editLog.value?.description?.substring(editLog.value?.description?.indexOf(':') + 1) ?? ''
  },
  set(val) {
    if (!editLog.value) return
    editLog.value.description = val
  },
})

function scrollComments() {
  if (commentsWrapperEl.value) commentsWrapperEl.value.scrollTop = commentsWrapperEl.value?.scrollHeight
}

const isSaving = ref(false)

const saveComment = async () => {
  if (isSaving.value) return

  isCommentMode.value = true
  isSaving.value = true

  try {
    await _saveComment()

    scrollComments()
  } catch (e) {
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

watch(commentsWrapperEl, () => {
  scrollComments()
})

const onClickAudit = () => {
  if (appInfo.value.ee) return

  tab.value = 'audits'
}
</script>

<template>
  <div class="flex flex-col !h-full w-full">
    <NcTabs v-model:activeKey="tab" class="h-full">
      <a-tab-pane key="comments" class="w-full h-full">
        <template #tab>
          <div v-e="['c:row-expand:comment']">
            <div class="flex items-center gap-2">
              <MdiMessageOutline class="h-4 w-4 flex-none" />
              <span class="<lg:hidden">Comments</span>
            </div>
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
            <div v-if="comments.length === 0" class="flex flex-col my-1 text-center justify-center h-full">
              <div class="text-center text-3xl text-gray-700">
                <GeneralIcon icon="commentHere" />
              </div>
              <div class="font-medium text-center my-6 text-gray-500">{{ $t('activity.startCommenting') }}</div>
            </div>
            <div v-else ref="commentsWrapperEl" class="flex flex-col h-full py-2 nc-scrollbar-thin">
              <div v-for="log of comments" :key="log.id">
                <div class="group gap-3 overflow-hidden hover:bg-gray-100 flex items-start px-3 pt-3 pb-4">
                  <GeneralUserIcon size="medium" :name="log.display_name" :email="log.user" />
                  <div class="flex-1 flex flex-col gap-1">
                    <div class="flex justify-between min-h-7">
                      <div class="flex items-center">
                        <div class="flex flex-wrap items-center gap-2 <lg:max-w-22">
                          <NcTooltip class="truncate max-w-42" show-on-truncate-only>
                            <template #title>
                              {{ log.display_name?.trim() || log.user || 'Shared source' }}
                            </template>
                            <span
                              class="text-ellipsis overflow-hidden font-bold text-gray-800"
                              :style="{
                                wordBreak: 'keep-all',
                                whiteSpace: 'nowrap',
                                display: 'inline',
                              }"
                            >
                              {{ log.display_name?.trim() || log.user || 'Shared source' }}
                            </span>
                          </NcTooltip>
                          <div v-if="log.id !== editLog?.id" class="text-xs font-medium text-gray-500">
                            {{
                              log.created_at !== log.updated_at ? `Edited ${timeAgo(log.updated_at)}` : timeAgo(log.created_at)
                            }}
                          </div>
                        </div>
                      </div>

                      <NcDropdown
                        placement="bottomRight"
                        v-if="log.user === user!.email && !editLog"
                        overlay-class-name="!min-w-[160px]"
                      >
                        <NcButton type="text" size="xsmall" class="nc-expand-form-more-actions !w-7 !h-7">
                          <GeneralIcon icon="threeDotVertical" class="text-md text-gray-700 invisible group-hover:visible" />
                        </NcButton>
                        <template #overlay>
                          <NcMenu>
                            <NcMenuItem v-e="['c:row-expand:comment:edit']" class="text-gray-700" @click="editComment(log)">
                              <div class="flex gap-2 items-center">
                                <component :is="iconMap.rename" class="cursor-pointer" />
                                {{ $t('general.edit') }}
                              </div>
                            </NcMenuItem>
                            <template v-if="false">
                              <NcDivider />
                              <NcMenuItem v-e="['c:row-expand:comment:delete']" class="!text-red-500 !hover:bg-red-50">
                                <div class="flex gap-2 items-center">
                                  <GeneralIcon icon="delete" />
                                  {{ $t('general.delete') }}
                                </div>
                              </NcMenuItem>
                            </template>
                          </NcMenu>
                        </template>
                      </NcDropdown>
                    </div>

                    <a-textarea
                      v-if="log.id === editLog?.id"
                      :ref="focusInput"
                      v-model:value="value"
                      class="!p-1.5 !m-0 w-full !rounded-md !text-gray-800 !text-small !min-h-[70px] nc-scrollbar-thin"
                      data-testid="expanded-form-comment-input"
                      @keydown.stop="onKeyDown($event)"
                    />
                    <div v-else class="text-sm text-gray-700">
                      {{ log.description.substring(log.description.indexOf(':') + 1) }}
                    </div>
                    <div v-if="log.id === editLog?.id" class="flex justify-end gap-1 mt-1">
                      <NcButton size="small" type="secondary" @click="onCancel"> Cancel </NcButton>
                      <NcButton v-e="['a:row-expand:comment:save']" size="small" @click="onEditComment"> Save </NcButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="hasEditPermission" class="px-2 py-[9px] border-t-1 border-gray-200 gap-2 flex">
              <div class="flex flex-row w-full bg-white items-start gap-2">
                <a-textarea
                  :ref="focusCommentInput"
                  v-model:value="comment"
                  class="!p-1 !m-0 w-full !border-0 !rounded-none !text-gray-800 !text-small !max-h-[70px] nc-scrollbar-thin"
                  auto-size
                  hide-details
                  :disabled="isSaving"
                  placeholder="Comment..."
                  :bordered="false"
                  data-testid="expanded-form-comment-input"
                  @keydown.enter.exact.prevent="saveComment"
                />
                <NcButton
                  v-e="['a:row-expand:comment:save']"
                  size="small"
                  :loading="isSaving"
                  :disabled="!isSaving && !comment.length"
                  :icon-only="isSaving"
                  @click="saveComment"
                >
                  <GeneralIcon v-if="!isSaving" icon="send" />
                </NcButton>
              </div>
            </div>
          </div>
        </div>
      </a-tab-pane>

      <a-tab-pane key="audits" class="w-full" :disabled="appInfo.ee">
        <template #tab>
          <NcTooltip v-if="appInfo.ee" class="tab flex-1">
            <template #title>
              <span class="!text-base"> Coming soon </span>
            </template>
            <div v-e="['c:row-expand:audit']">
              <div class="flex items-center gap-2 text-gray-400">
                <MdiFileDocumentOutline class="h-4 w-4" />
                <span class="<lg:hidden">Audits</span>
              </div>
            </div>
          </NcTooltip>
          <div v-else v-e="['c:row-expand:audit']">
            <div class="flex items-center gap-2">
              >
              <MdiFileDocumentOutline class="h-4 w-4" />
              <span class="<lg:hidden">Audits</span>
            </div>
          </div>
        </template>
        <div
          class="h-full"
          :class="{
            'pb-1': !appInfo.ee,
          }"
        >
          <div v-if="isExpandedFormLoading" class="flex flex-col h-full">
            <GeneralLoader class="!mt-16" size="xlarge" />
          </div>

          <div v-else ref="commentsWrapperEl" class="flex flex-col h-full nc-scrollbar-md !overflow-y-auto">
            <template v-if="audits.length === 0">
              <div class="flex flex-col text-center justify-center h-full">
                <div class="text-center text-3xl text-gray-600">
                  <MdiHistory />
                </div>
                <div class="font-bold text-center my-1 text-gray-600">See changes to this record</div>
              </div>
            </template>

            <div v-for="log of audits" :key="log.id" class="nc-audit-item">
              <div class="flex flex-col p-4 gap-3">
                <div class="flex justify-between">
                  <div class="flex items-center gap-2">
                    <GeneralUserIcon size="base" :email="log.user" :name="log.display_name" />

                    <div class="flex flex-col">
                      <NcTooltip class="truncate max-w-50" show-on-truncate-only>
                        <template #title>
                          {{ log.display_name?.trim() || log.user || 'Shared source' }}
                        </template>
                        <span
                          class="text-ellipsis overflow-hidden font-bold"
                          :style="{
                            wordBreak: 'keep-all',
                            whiteSpace: 'nowrap',
                            display: 'inline',
                          }"
                        >
                          {{ log.display_name?.trim() || log.user || 'Shared source' }}
                        </span>
                      </NcTooltip>
                      <div v-if="log.id !== editLog?.id" class="text-xs font-medium text-gray-500">
                        {{ timeAgo(log.created_at) }}
                      </div>
                    </div>
                  </div>
                </div>
                <div v-dompurify-html="log.details" class="text-sm font-medium"></div>
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
  .ant-tabs-nav {
    @apply px-3;
    .ant-tabs-nav-list {
      @apply w-full gap-6;

      .ant-tabs-tab {
        @apply flex-1 flex items-center justify-center pt-3 pb-2.5;

        & + .ant-tabs-tab{
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
</style>
