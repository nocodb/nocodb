<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import type { AuditType } from 'nocodb-sdk'
import { Icon } from '@iconify/vue'
import { ref, timeAgo, useExpandedFormStoreOrThrow, useGlobal, useRoles, watch } from '#imports'

const { loadCommentsAndLogs, commentsAndLogs, saveComment: _saveComment, comment, updateComment } = useExpandedFormStoreOrThrow()

const commentsWrapperEl = ref<HTMLDivElement>()

const auditTabDomRef = (e: HTMLElement) => {
  e.scrollTop = e.scrollHeight
}

onMounted(async () => {
  await loadCommentsAndLogs()
})

const { user } = useGlobal()

const tab = ref<'comments' | 'audits'>('comments')

const { isUIAllowed } = useRoles()

const hasEditPermission = computed(() => isUIAllowed('commentEdit'))

const editLog = ref<AuditType>()

const isEditing = ref<boolean>(false)

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
const audits = computed(() => commentsAndLogs.value.filter((log) => log.op_type !== 'COMMENT'))

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

const saveComment = async () => {
  await _saveComment()
  scrollComments()
}

watch(commentsWrapperEl, () => {
  scrollComments()
})

// Ignore first line if its the only one
const processedAudit = (log: string) => {
  const dotSplit = log.split('.')

  if (dotSplit.length === 1) return log

  return log.substring(log.indexOf('.') + 1)
}
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <div class="h-16 bg-white rounded-t-lg border-gray-200 border-b-1">
      <div class="flex flex-row gap-2 m-2 p-1 bg-gray-100 rounded-lg">
        <div
          v-e="['c:row-expand:comment']"
          class="tab flex-1 px-4 py-2 transition-all text-gray-600 cursor-pointer rounded-lg"
          :class="{
            'bg-white shadow !text-brand-500 !hover:text-brand-500': tab === 'comments',
          }"
          @click="tab = 'comments'"
        >
          <div class="tab-title nc-tab">
            <MdiMessageOutline class="h-4 w-4" />
            Comments
          </div>
        </div>
        <div
          v-e="['c:row-expand:audit']"
          class="tab flex-1 px-4 py-2 transition-all text-gray-600 cursor-pointer rounded-lg"
          :class="{
            'bg-white shadow !text-brand-500 !hover:text-brand-500': tab === 'audits',
          }"
          @click="tab = 'audits'"
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
        'pb-2': tab !== 'comments',
      }"
    >
      <div v-if="tab === 'comments'" class="flex flex-col h-full">
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
            <GeneralUserIcon size="base" class="!w-10" />
            <a-input
              v-model:value="comment"
              class="!rounded-lg border-1 bg-white !px-2.5 !py-2 !border-gray-200 nc-comment-box !outline-none"
              placeholder="Start typing..."
              :bordered="false"
              @keyup.enter.prevent="saveComment"
            >
            </a-input>
            <NcButton
              v-e="['a:row-expand:comment:save']"
              size="medium"
              class="!w-8"
              :disabled="!comment.length"
              @click="saveComment"
            >
              <GeneralIcon icon="send" />
            </NcButton>
          </div>
        </div>
      </div>
      <div v-if="tab === 'audits'" :ref="auditTabDomRef" class="flex flex-col h-full pl-2 pr-1 pt-2 nc-scrollbar-md space-y-2">
        <template v-if="audits.length === 0">
          <div class="flex flex-col text-center justify-center h-full">
            <div class="text-center text-3xl text-gray-600">
              <MdiHistory />
            </div>
            <div class="font-bold text-center my-1 text-gray-600">See changes to this record</div>
          </div>
        </template>
        <div v-for="log of audits" :key="log.id">
          <div class="bg-white rounded-xl border-1 gap-3 border-gray-200">
            <div class="flex flex-col p-4 gap-3">
              <div class="flex justify-between">
                <div class="flex items-center gap-2">
                  <GeneralUserIcon size="base" :name="log.display_name ?? log.user" />

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
              <div class="text-sm font-medium text-gray-700">
                {{ processedAudit(log.description) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab .tab-title {
  @apply min-w-0 flex justify-center gap-2 font-semibold items-center;
  word-break: 'keep-all';
  white-space: 'nowrap';
  display: 'inline';
}
</style>
