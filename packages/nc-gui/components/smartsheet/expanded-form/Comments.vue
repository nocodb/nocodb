<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import type { AuditType } from 'nocodb-sdk'
import { Icon } from '@iconify/vue'
import { ref, timeAgo, useExpandedFormStoreOrThrow, useGlobal, useRoles, watch } from '#imports'

const { loadCommentsAndLogs, commentsAndLogs, isCommentsLoading, saveComment, comment, updateComment } =
  useExpandedFormStoreOrThrow()

const commentsWrapperEl = ref<HTMLDivElement>()

await loadCommentsAndLogs()

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
  isEditing.value = false
  editLog.value = undefined
}

onKeyStroke('Enter', (event) => {
  if (isEditing.value) {
    onKeyEnter(event)
  }
})

const comments = computed(() => commentsAndLogs.value.filter((log) => log.op_type === 'COMMENT'))

function editComment(log: AuditType) {
  editLog.value = log
  isEditing.value = true
}

const value = computed({
  get() {
    return editLog.value.description.substring(editLog.value.description.indexOf(':') + 1) ?? ''
  },
  set(val) {
    if (!editLog.value) return
    editLog.value.description = val
  },
})

watch(
  commentsAndLogs,
  () => {
    setTimeout(() => {
      if (commentsWrapperEl.value) commentsWrapperEl.value.scrollTop = commentsWrapperEl.value?.scrollHeight
    }, 200)
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-col w-full bg-gray-50 rounded-lg">
    <div class="bg-white rounded-t-lg border-gray-200 border-b-1">
      <div class="flex flex-row m-2 p-1 bg-gray-100 rounded-lg">
        <div
          class="tab flex-1 transition-all cursor-pointer rounded-lg"
          :class="{
            'bg-white shadow text-brand-500 hover:text-brand-500': tab === 'comments',
          }"
          @click="tab = 'comments'"
        >
          <div class="tab-title nc-tab">Comments</div>
        </div>
        <div
          class="tab flex-1 transition-all cursor-pointer rounded-lg"
          :class="{
            'bg-white shadow text-brand-500 hover:text-brand-500': tab === 'audits',
          }"
          @click="tab = 'audits'"
        >
          <div class="tab-title nc-tab">Audits</div>
        </div>
      </div>
    </div>
    <div>
      <div
        v-if="tab === 'comments'"
        ref="commentsWrapperEl"
        class="flex flex-col m-1 p-1 !h-[calc(100vh-300px)] overflow-y-scroll nc-scrollbar-md space-y-2"
      >
        <a-skeleton v-if="isCommentsLoading" type="list-item-avatar-two-line@8" />
        <template v-else-if="commentsAndLogs.length === 0">
          <div class="flex flex-col text-center justify-center h-full">
            <div class="text-center text-3xl text-gray-300">
              <MdiChatProcessingOutline />
            </div>
            <div class="font-bold text-center my-1 text-gray-400">Start a conversation</div>
            <div class="text-gray-400">
              NocoDB allows you to inquire, monitor progress updates, and collaborate with your team members.
            </div>
          </div>
        </template>
        <template v-else>
          <div v-for="(log, idx) of comments" :key="log.id">
            <div class="bg-white rounded-xl border-1 gap-3 border-gray-200">
              <div class="flex flex-col p-4 gap-3">
                <div class="flex justify-between">
                  <div class="flex font-bold items-center gap-2">
                    <MdiAccountCircleOutline class="row-span-2 h-8 w-8" />
                    <span class="truncate max-w-42">
                      {{ log.user ?? 'Shared base' }}
                    </span>
                  </div>
                  <NcButton
                    v-if="log.user === user.email && !editLog"
                    type="secondary"
                    class="!px-2"
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
                  <NcButton size="sm" @click="onEditComment"> Save </NcButton>
                </div>
                <div v-if="log.id !== editLog?.id" class="text-xs text-gray-500">
                  {{ log.created_at !== log.updated_at ? `Edited ${timeAgo(log.updated_at)}` : timeAgo(log.created_at) }}
                </div>
              </div>
            </div>
            <!--  <a-dropdown :trigger="['contextmenu']" :overlay-class-name="`nc-dropdown-comment-context-menu-${idx}`">
            <div class="flex gap-1 text-xs">
              <component
              :is="iconMap.accountCircle"
              class="row-span-2"
              :class="isYou(log.user) ? 'text-pink-600' : 'text-blue-600 '"
              />
              
              <div class="flex-1">
                <p class="mb-1 caption edited-text text-[10px] text-gray-500">
                  {{ log.op_type === 'COMMENT' ? 'commented' : log.op_sub_type === 'INSERT' ? 'created' : 'edited' }}
                </p>
                
                <div v-if="log.op_type === 'COMMENT'">
                  <a-input
                  v-if="log.id === editLog?.id"
                  :ref="focusInput"
                  v-model:value="editLog.description"
                  @blur="onCancel"
                  @keydown.stop="onKeyDown($event)"
                  />
                  <p
                  v-else
                  class="block caption my-2 nc-chip w-full min-h-20px p-2 rounded"
                  :style="{ backgroundColor: enumColor.light[2] }"
                  >
                  
                  retrieve the comment part from the audit description
                  `The following comment has been created: foo` -> `foo`
                  
                  {{ log.description.substring(log.description.indexOf(':') + 1) }}
                </p>
              </div>
              
              <p v-else-if="log.details" v-dompurify-html="log.details" class="caption my-3" style="word-break: break-all" />
              
                <p v-else>{{ log.description }}</p>
                
                <p class="time text-right text-[10px] mb-0 mt-1 text-gray-500">
                  {{ timeAgo(log.created_at) }}
                </p>
              </div>
            </div>

            <template #overlay>
              <a-menu v-if="log.op_type === 'COMMENT'" @click="contextMenu = false">
                <a-menu-item key="copy-comment" @click="copyComment(log.description)">
                  <div v-e="['a:comment:copy']" class="nc-project-menu-item">
                    {{ t('general.copy') }}
                  </div>
                </a-menu-item>
                <a-menu-item v-if="log.user === user.email " key="edit-comment"  ">
                  <div v-e="['a:comment:edit']" class="nc-project-menu-item">
                    {{ t('general.edit') }}
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown> -->
          </div>
        </template>
      </div>

      <!-- <div class="flex justify-center">
        <a-checkbox v-model:checked="commentsOnly" v-e="['c:row-expand:comment-only']" @change="loadCommentsAndLogs">
          {{ $t('labels.commentsOnly') }}
          <span class="text-[11px] text-gray-500" />
        </a-checkbox>
      </div> -->

      <div v-if="hasEditPermission && tab === 'comments'" class="shrink mt-2 p-2 rounded-b-xl border-t-1 bg-white gap-1 flex">
        <a-input
          v-model:value="comment"
          class="!rounded-lg border-1 bg-white !px-4 !py-2 !border-gray-200 nc-comment-box"
          placeholder="Start typing..."
          @keyup.enter.prevent="saveComment"
        >
        </a-input>
        <NcButton type="secondary" size="medium" @click="saveComment">
          <Icon class="iconify text-gray-800" icon="lucide:send" />
        </NcButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab .tab-title {
  @apply min-w-0 flex justify-center items-center py-1;
  word-break: 'keep-all';
  white-space: 'nowrap';
  display: 'inline';
}
</style>
