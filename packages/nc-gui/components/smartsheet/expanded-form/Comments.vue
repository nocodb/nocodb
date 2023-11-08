<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import type { AuditType } from 'nocodb-sdk'
import { Icon } from '@iconify/vue'
import { ref, timeAgo, useExpandedFormStoreOrThrow, useGlobal, useRoles, watch } from '#imports'

const props = defineProps<{
  isLoading: boolean
}>()

const { loadCommentsAndLogs, commentsAndLogs, saveComment: _saveComment, comment, updateComment } = useExpandedFormStoreOrThrow()

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const commentsWrapperEl = ref<HTMLDivElement>()

const { user, appInfo } = useGlobal()

const isExpandedFormLoading = computed(() => props.isLoading)

const tab = ref<'comments' | 'audits'>('comments')

const { isUIAllowed } = useRoles()

const hasEditPermission = computed(() => isUIAllowed('commentEdit'))

const editLog = ref<AuditType>()

const isEditing = ref<boolean>(false)

const commentInputDomRef = ref<HTMLInputElement>()

const focusInput: VNodeRef = (el) => (el as HTMLInputElement)?.focus()

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    onKeyEsc(event)
  } else if (event.key === 'Enter') {
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

watch(commentInputDomRef, () => {
  if (commentInputDomRef.value && isExpandedFormCommentMode.value) {
    setTimeout(() => {
      commentInputDomRef.value?.focus()
      isExpandedFormCommentMode.value = false
    }, 400)
  }
})
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <div class="h-16 bg-white rounded-t-lg border-gray-200 border-b-1">
      <div class="flex flex-row gap-2 m-2 p-1 bg-gray-100 rounded-lg">
        <div
          v-e="['c:row-expand:comment']"
          class="tab flex-1 px-4 py-2 transition-all text-gray-600 cursor-pointer rounded-lg"
          :class="{
            'bg-white shadow !text-brand-500 !hover:text-brand-500': tab === 'comments' || appInfo.ee,
          }"
          @click="tab = 'comments'"
        >
          <div class="tab-title nc-tab">
            <MdiMessageOutline class="h-4 w-4" />
            Comments
          </div>
        </div>
        <NcTooltip v-if="appInfo.ee" class="tab flex-1">
          <template #title>
            <span class="!text-base"> Coming soon </span>
          </template>
          <div
            v-e="['c:row-expand:audit']"
            class="flex-1 px-4 py-2 transition-all text-gray-400 cursor-not-allowed bg-gray-50 rounded-lg"
            @click="onClickAudit"
          >
            <div class="tab-title nc-tab select-none">
              <MdiFileDocumentOutline class="h-4 w-4" />
              Audits
            </div>
          </div>
        </NcTooltip>
        <div
          v-else
          v-e="['c:row-expand:audit']"
          class="tab flex-1 px-4 py-2 transition-all text-gray-600 cursor-pointer rounded-lg"
          :class="{
            'bg-white shadow !text-brand-500 !hover:text-brand-500': tab === 'audits',
          }"
          @click="onClickAudit"
        >
          <div class="tab-title nc-tab">
            <MdiFileDocumentOutline class="h-4 w-4" />
            Audits
          </div>
        </div>
      </div>
    </div>
    <div
      class="h-[calc(100%-4rem)]"
      :class="{
        'pb-1': tab !== 'comments' && !appInfo.ee,
      }"
    >
      <div v-if="isExpandedFormLoading" class="flex flex-col h-full">
        <GeneralLoader class="!mt-16" size="xlarge" />
      </div>
      <div v-else-if="tab === 'comments'" class="flex flex-col h-full">
        <div v-if="comments.length === 0" class="flex flex-col my-1 text-center justify-center h-full">
          <div class="text-center text-3xl text-gray-700">
            <GeneralIcon icon="commentHere" />
          </div>
          <div class="font-medium text-center my-6 text-gray-500">{{ $t('activity.startCommenting') }}</div>
        </div>
        <div v-else ref="commentsWrapperEl" class="flex flex-col h-full py-2 pl-2 pr-1 space-y-2 nc-scrollbar-md">
          <div v-for="log of comments" :key="log.id">
            <div class="bg-white rounded-xl group border-1 gap-2 border-gray-200">
              <div class="flex flex-col p-4 gap-3">
                <div class="flex justify-between">
                  <div class="flex items-center gap-2">
                    <GeneralUserIcon size="base" :name="log.display_name ?? log.user" :email="log.user" />

                    <div class="flex flex-col">
                      <span class="truncate font-bold max-w-42">
                        {{ log.display_name ?? log.user.split('@')[0] ?? 'Shared source' }}
                      </span>
                      <div v-if="log.id !== editLog?.id" class="text-xs font-medium text-gray-500">
                        {{ log.created_at !== log.updated_at ? `Edited ${timeAgo(log.updated_at)}` : timeAgo(log.created_at) }}
                      </div>
                    </div>
                  </div>
                  <NcButton
                    v-if="log.user === user!.email && !editLog"
                    v-e="['c:row-expand:comment:edit']"
                    type="secondary"
                    class="!px-2 opacity-0 group-hover:opacity-100 transition-all"
                    size="sm"
                    @click="editComment(log)"
                  >
                    <Icon class="iconify text-gray-800" icon="lucide:pen" />
                  </NcButton>
                </div>
                <textarea
                  v-if="log.id === editLog?.id"
                  :ref="focusInput"
                  v-model="value"
                  rows="6"
                  class="px-2 py-1 rounded-lg border-none nc-scrollbar-md bg-white outline-gray-200"
                  @keydown.stop="onKeyDown($event)"
                />
                <div v-else class="text-sm text-gray-700">
                  {{ log.description.substring(log.description.indexOf(':') + 1) }}
                </div>
                <div v-if="log.id === editLog?.id" class="flex justify-end gap-1">
                  <NcButton type="secondary" size="sm" @click="onCancel"> Cancel </NcButton>
                  <NcButton v-e="['a:row-expand:comment:save']" size="sm" @click="onEditComment"> Save </NcButton>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="hasEditPermission" class="p-2 bg-gray-50 gap-2 flex">
          <div class="h-14 flex flex-row w-full bg-white py-2.75 px-1.5 items-center rounded-xl border-1 border-gray-200">
            <GeneralUserIcon size="base" class="!w-10" :email="user?.email" :name="user?.display_name" />
            <a-input
              ref="commentInputDomRef"
              v-model:value="comment"
              class="!rounded-lg border-1 bg-white !px-2.5 !py-2 !border-gray-200 nc-comment-box !outline-none"
              placeholder="Start typing..."
              data-testid="expanded-form-comment-input"
              :bordered="false"
              @keyup.enter.prevent="saveComment"
            >
            </a-input>
            <NcButton
              v-e="['a:row-expand:comment:save']"
              size="medium"
              class="!w-8"
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
      <div v-if="tab === 'audits'" ref="commentsWrapperEl" class="flex flex-col h-full nc-scrollbar-md !overflow-y-auto">
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
                <GeneralUserIcon size="base" :email="log.user" />

                <div class="flex flex-col">
                  <span class="truncate font-bold max-w-50">
                    {{ log.display_name ?? log.user.split('@')[0].slice(0, 2) ?? 'Shared source' }}
                  </span>
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
  </div>
</template>

<style scoped>
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
</style>
