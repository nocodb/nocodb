<script setup lang="ts">

import dayjs from 'dayjs'

/* interface */

const props = defineProps<{
  store: ReturnType<typeof useProvideExpandedFormStore>
  isUnsavedDuplicatedRecordExist: boolean
}>()

const isUnsavedDuplicatedRecordExist = toRef(props, 'isUnsavedDuplicatedRecordExist')

/* stores */

const { saveComment, loadAudits, commentsDrawer, isNew, auditCommentGroups } = props.store

const { isUIAllowed } = useRoles()

/* flags */

const showRightSections = computed(() => !isNew.value && commentsDrawer.value && isUIAllowed('commentList'))

onMounted(async () => {
  await loadAudits()
})

/* formatting */

function formatDateToRelative(date: string) {
  return dayjs(date).fromNow()
}

/* new comment */

const newCommentText = ref('')

</script>

<script lang="ts">
export default {
  name: 'ExpandedFormPresentorsDiscussion',
}
</script>

<template>
  <div class="h-full flex flex-row nc-files-mode-container">
    <div
      class="h-full overflow-y-auto nc-scrollbar-thin"
      :class="{
        'w-full': !showRightSections,
        'flex-1': showRightSections,
      }"
    >
      <div class="max-w-[660px] mx-auto py-4">
        <div v-for="group in auditCommentGroups" :key="group.created_at" class="w-full flex gap-8 items-start">
          <div class="pb-4">
            <GeneralUserIcon :email="group.user" class="w-[32px] aspect-square" />
          </div>
          <div class="w-0 flex-1 pb-4 border-l border-gray-200 pl-6">
            <template v-if="group.type === 'audit'">
              <SmartsheetExpandedFormPresentorsDiscussionEntryAudit :audit-group="group" />
            </template>
            <template v-else>
              <SmartsheetExpandedFormPresentorsDiscussionEntryComment :comment="group" />
            </template>
          </div>
        </div>
        <div class="w-full flex gap-8 items-start">
          <div class="pb-4">
            <GeneralUserIcon email="yooneskh@gmail.com" class="w-[32px] aspect-square" />
          </div>
          <div class="w-0 flex-1 border-l border-gray-200 pl-6">
            <div class="bg-white p-1 rounded-lg -ml-8 border border-gray-300 border-1 shadow-sm relative group">
              <input type="text" placeholder="Comment..." class="text-sm w-full border-0 focus:outline-none focus:ring-0" v-model="newCommentText" />
              <div class="text-right p-1">
                <NcButton
                  class="!w-7 !h-7 !bg-transparent !hover:bg-gray-200"
                  size="xsmall"
                  type="secondary"
                  :disabled="!newCommentText"
                  @click="saveComment(newCommentText); newCommentText = ''"
                >
                  <GeneralIcon class="text-md" icon="send" />
                </NcButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="showRightSections && !isUnsavedDuplicatedRecordExist"
      class="nc-comments-drawer border-l-1 relative border-gray-200 bg-white w-1/3 max-w-[400px] min-w-0 h-full xs:hidden rounded-br-2xl"
      :class="{
        active: commentsDrawer && isUIAllowed('commentList'),
      }"
    >
      <SmartsheetExpandedFormPresentorsFieldsMiniColumnsWrapper :store="props.store" />
    </div>
  </div>
</template>
