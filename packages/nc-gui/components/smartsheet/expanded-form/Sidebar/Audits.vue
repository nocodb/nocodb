<script setup lang="ts">
import { type AuditType, ProjectRoles } from 'nocodb-sdk'

const { user } = useGlobal()

const { isUIAllowed } = useRoles()

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const meta = inject(MetaInj, ref())

const baseUsers = computed(() => (meta.value?.base_id ? basesUser.value.get(meta.value?.base_id) || [] : []))

const { audits, isAuditLoading } = useExpandedFormStoreOrThrow()

const hasEditPermission = computed(() => isUIAllowed('commentEdit'))

const auditsWrapperEl = ref<HTMLElement | null>(null)

function scrollToAudit(auditId?: string) {
  if (!auditId) return

  const auditEl = auditsWrapperEl.value?.querySelector(`.nc-audit-item.${auditId}`)
  if (auditEl) {
    auditEl.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }
}

const createdByAudit = (
  comment: AuditType & {
    created_display_name?: string
  },
) => {
  if (comment.user === user.value?.email) {
    return 'You'
  } else if (comment.created_display_name?.trim()) {
    return comment.created_display_name || 'Shared source'
  } else if (comment.user) {
    return comment.user
  } else {
    return 'Shared source'
  }
}


watch(
  () => audits.value.length,
  (auditCount) => {
    nextTick(() => {
      setTimeout(() => {
        scrollToAudit(audits.value[auditCount - 1]?.id)
      }, 100)
    })
  },
)

/* new comment */

const comment = ref('')

// const {
//   deleteComment,
//   resolveComment,
//   isCommentsLoading,
//   comments,
//   loadComments,
//   updateComment,
//   saveComment: _saveComment,
//   primaryKey,
// } = useRowCommentsOrThrow()

// const saveComment = async () => {
//   if (!comment.value.trim()) return

//   while (comment.value.endsWith('<br />') || comment.value.endsWith('\n')) {
//     if (comment.value.endsWith('<br />')) {
//       comment.value = comment.value.slice(0, -6)
//     } else {
//       comment.value = comment.value.slice(0, -2)
//     }
//   }

//   // Optimistic Insert
//   comments.value = [
//     ...comments.value,
//     {
//       id: `temp-${new Date().getTime()}`,
//       comment: comment.value,
//       created_at: new Date().toISOString(),
//       created_by: user.value?.id,
//       created_by_email: user.value?.email,
//       created_display_name: user.value?.display_name ?? '',
//     },
//   ]

//   const tempCom = comment.value
//   comment.value = ''

//   commentInputRef?.value?.setEditorContent('', true)
//   await nextTick(() => {
//     scrollComments()
//   })

//   try {
//     await _saveComment(tempCom)
//     await nextTick(() => {
//       isExpandedFormCommentMode.value = true
//     })
//     scrollComments()
//   } catch (e) {
//     console.error(e)
//   }
// }

</script>

<template>
  <div class="h-full">
    <div v-if="isAuditLoading" class="flex flex-col items-center justify-center w-full h-full">
      <GeneralLoader size="xlarge" />
    </div>

    <div v-else ref="auditsWrapperEl" class="flex flex-col h-full nc-scrollbar-thin">
      <template v-if="audits.length === 0">
        <div class="flex flex-col text-center justify-center h-full">
          <div class="text-center text-3xl text-gray-600">
            <MdiHistory />
          </div>
          <div class="font-bold text-center my-1 text-gray-600">See changes to this record</div>
        </div>
      </template>
      <template v-else>
        <div class="mt-auto" />
        <!-- <div v-for="audit of audits" :key="audit.id" :class="`${audit.id}`" class="nc-audit-item"> -->
        <div class="nc-audit-item">
          <div class="group gap-3 overflow-hidden px-3 py-2 hover:bg-gray-100">
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-3 flex-1 w-full">
                <!-- :email="audit?.created_by_email"
                :name="audit?.created_display_name" -->
                <GeneralUserIcon
                  email="yooneskh@gmail.com"
                  name="Yoones"
                  class="mt-0.5"
                  size="medium"
                />
                <div class="flex h-[28px] items-center gap-2 w-[calc(100%_-_40px)]">
                  <div class="truncate text-gray-800 font-medium !text-small !leading-[18px] overflow-hidden">
                    <!-- {{ createdByAudit(audit) }} -->
                      You
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ timeAgo('2024-12-10T10:00:00Z') }}
                    <!-- {{ timeAgo(audit.created_at!) }} -->
                  </div>
                </div>
              </div>
            </div>
            <div class="ml-9 rounded-lg border-1 border-gray-300 bg-gray-50 divide-y">
              <div class="p-2">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="cellText" class="w-4 h-4" />
                  Single line text
                </div>
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                  <div class="text-sm text-red-500 border-1 border-red-500 rounded-md px-1 py-0.25 bg-red-50 line-through">
                    Initial text
                  </div>
                  <div class="text-sm text-green-700 border-1 border-green-500 rounded-md px-1 py-0.25 bg-green-50">
                    Updated text
                  </div>
                </div>
              </div>
              <div class="p-2">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="cellText" class="w-4 h-4" />
                  Multi line text
                </div>
                <div class="mt-2">
                  This is a multi line text
                  <div class="inline-block text-sm text-red-500 border-1 border-red-500 rounded-md px-1 py-0.25 bg-red-50 line-through">
                    Initial text
                  </div>
                  <div class="inline-block text-sm text-green-700 border-1 border-green-500 rounded-md px-1 py-0.25 bg-green-50">
                    Updated text
                  </div>
                  with some changes
                </div>
              </div>
              <div class="p-2">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="cellDate" class="w-4 h-4" />
                  Date
                </div>
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                  <div class="text-sm text-red-500 border-1 border-red-500 rounded-md px-1 py-0.25 bg-red-50 line-through">
                    1-12-2024
                  </div>
                  <div class="text-sm text-green-700 border-1 border-green-500 rounded-md px-1 py-0.25 bg-green-50">
                    2-12-2024
                  </div>
                </div>
              </div>
              <div class="p-2">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="cellDatetime" class="w-4 h-4" />
                  Date & time
                </div>
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                  <div class="text-sm text-red-500 border-1 border-red-500 rounded-md px-1 py-0.25 bg-red-50 line-through">
                    1-12-2024 10:00
                  </div>
                  <div class="text-sm text-green-700 border-1 border-green-500 rounded-md px-1 py-0.25 bg-green-50">
                    2-12-2024 2:00
                  </div>
                </div>
              </div>
              <div class="p-2">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="cellPhone" class="w-4 h-4" />
                  Phone Number
                </div>
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                  <div class="text-sm text-red-500 border-1 border-red-500 rounded-md px-1 py-0.25 bg-red-50 line-through">
                    +9999999
                  </div>
                  <div class="text-sm text-green-700 border-1 border-green-500 rounded-md px-1 py-0.25 bg-green-50">
                    9888888
                  </div>
                </div>
              </div>
              <div class="p-2">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="cellUrl" class="w-4 h-4" />
                  Url
                </div>
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                  <div class="text-sm text-red-500 border-1 border-red-500 rounded-md px-1 py-0.25 bg-red-50 line-through">
                    https://www.google.com
                  </div>
                  <div class="text-sm text-green-700 border-1 border-green-500 rounded-md px-1 py-0.25 bg-green-50">
                    https://www.gooogle.com
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <!-- <div v-if="hasEditPermission" class="px-3 pb-3 nc-comment-input !rounded-br-2xl gap-2 mt-3 flex">
        <SmartsheetExpandedFormRichComment
          ref="commentInputRef"
          v-model:value="comment"
          :hide-options="false"
          placeholder="Comment..."
          class="expanded-form-comment-input !py-2 !px-2 cursor-text border-1 rounded-lg w-full bg-transparent !text-gray-800 !text-small !leading-18px !max-h-[240px]"
          data-testid="expanded-form-comment-input"
          @keydown.stop
        />
          @save="saveComment"
          @keydown.enter.exact.prevent="saveComment"
      </div> -->
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.red.lighten-4) {
  @apply bg-red-100 rounded-md line-through;
}

.nc-audit-item {
  @apply gap-3;
}

:deep(.green.lighten-4) {
  @apply bg-green-100 rounded-md !mr-3;
}
</style>
