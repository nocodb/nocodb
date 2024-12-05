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
              <div class="flex items-center h-[32px] mb-1 relative">
                <GeneralIcon icon="pencil" class="w-[24px] h-[24px] p-1 text-gray-500 absolute -left-6 transform -translate-x-1/2 bg-white rounded-full border border-1 border-gray-300 shadow" />
                <p class="text-sm font-medium mb-0">
                  {{ group.displayName }} {{ group.audits[0]?.op_sub_type === 'UPDATE' ? 'Updated' : 'Created' }} {{ group.audits.length }} fields
                </p>
                <div class="text-xs text-gray-500 ml-4">
                  {{ formatDateToRelative(group.audits[0]?.created_at) }}
                </div>
              </div>
              <div v-for="audit in group.audits" :key="audit.id" class="relative">
                <GeneralIcon icon="ncLink" class="w-[12px] h-[12px] text-gray-500 absolute top-1/2 -left-6 transform -translate-y-1/2 -translate-x-1/2" />
                <p class="text-sm mb-1">
                  {{ audit.description }}
                </p>
              </div>
            </template>
            <template v-else>
              <div class="bg-white p-3 rounded-lg -ml-8 border border-gray-300 border-1 shadow-sm relative group">
                <div>
                  <span class="font-medium text-sm">
                    {{ group.displayName }}
                  </span>
                  <span class="text-xs text-gray-500 ml-2">
                    {{ formatDateToRelative(group.created_at) }}
                  </span>
                </div>
                <div class="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex gap-1">
                  <NcTooltip>
                    <NcButton
                      class="!w-7 !h-7 !bg-transparent !hover:bg-gray-200"
                      size="xsmall"
                      type="text"
                    >
                      <GeneralIcon class="text-md" icon="pencil" />
                    </NcButton>
                    <template #title>Click to edit</template>
                  </NcTooltip>
                  <NcTooltip>
                    <NcButton
                      class="!w-7 !h-7 !bg-transparent !hover:bg-gray-200"
                      size="xsmall"
                      type="text"
                    >
                      <GeneralIcon class="text-md" icon="checkCircle" />
                    </NcButton>
                    <template #title>Click to resolve</template>
                  </NcTooltip>
                </div>
                <p class="mb-0 mt-2">
                  {{ group.comment }}
                </p>
                <div class="mt-2">
                  <GeneralEmojiPicker container-class="border-1 border-gray-300 rounded-full">
                    <GeneralIcon class="w-[16px]" icon="ncSmile" />
                  </GeneralEmojiPicker>
                </div>
              </div>
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
