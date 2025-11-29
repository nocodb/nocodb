<script setup lang="ts">
import dayjs from 'dayjs'

const { updateWorkflowData, debouncedWorkflowUpdate } = useWorkflowOrThrow()

const { workflow } = useWorkflowOrThrow()

const isTitleInEditMode = ref(false)

const isDescriptionInEditMode = ref(false)

const titleInputRef = ref()

const descriptionInputRef = ref()

const workflowTitle = computed({
  get() {
    return workflow.value?.title
  },
  set(value) {
    updateWorkflowData({ title: value })
    debouncedWorkflowUpdate()
  },
})

const workflowDescription = computed({
  get() {
    return workflow.value?.description
  },
  set(value) {
    updateWorkflowData({ description: value })
    debouncedWorkflowUpdate()
  },
})

function enableTitleEditMode() {
  isTitleInEditMode.value = true
  nextTick(() => {
    titleInputRef.value.focus()
  })
}

function enableDescriptionEditMode() {
  isDescriptionInEditMode.value = true
  nextTick(() => {
    descriptionInputRef.value.focus()
  })
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 pt-4">
      <div class="flex gap-2 items-center">
        <LazyGeneralEmojiPicker
          :key="workflow?.meta?.icon"
          :clearable="true"
          :emoji="workflow?.meta?.icon"
          class="nc-workflow-icon"
          size="large"
        >
          <template #default="{ isOpen }">
            <NcTooltip class="flex" placement="topLeft" hide-on-click :disabled="isOpen">
              <template #title>
                {{ $t('general.changeIcon') }}
              </template>

              <GeneralIcon class="w-5 h-5 text-nc-content-gray-subtle" icon="ncAutomation" />
            </NcTooltip>
          </template>
        </LazyGeneralEmojiPicker>

        <div v-if="!isTitleInEditMode" class="text-subHeading2 truncate" @click="enableTitleEditMode">
          {{ workflow.title }}
        </div>
        <div v-else>
          <a-input
            ref="titleInputRef"
            v-model:value="workflowTitle"
            class="!rounded-lg text-subHeading2 nc-input !w-80 !px-1"
            @blur="isTitleInEditMode = false"
            @keydown.enter="isTitleInEditMode = false"
            @keydown.esc="isTitleInEditMode = false"
          />
        </div>
      </div>

      <div class="mt-2">
        <div
          v-if="!isDescriptionInEditMode"
          class="text-body text-nc-content-gray-subtle px-1"
          @click="enableDescriptionEditMode"
        >
          <span v-if="!workflowDescription" class="text-nc-content-gray-muted">
            {{ $t('labels.addDescription') }}
          </span>
          {{ workflowDescription }}
        </div>
        <div v-else>
          <a-textarea
            ref="descriptionInputRef"
            v-model:value="workflowDescription"
            class="!rounded-lg text-body !px-1 nc-input"
            :auto-size="{ minRows: 2, maxRows: 6 }"
            @keydown.enter="isDescriptionInEditMode = false"
            @blur="isDescriptionInEditMode = false"
            @keydown.esc="isDescriptionInEditMode = false"
          />
        </div>
      </div>

      <NcDivider class="!my-6" />
    </div>
    <div class="flex-1" />
    <NcDivider />
    <div class="px-4 py-3 flex flex-col gap-4">
      <div>
        <div class="text-nc-content-gray text-bodyDefaultSmBold mb-2 font-semibold">
          {{ $t('labels.createdBy') }}
        </div>
        <NcUserInfo :user="(workflow as any).created_by_user" />
      </div>
      <div v-if="workflow?.updated_at" class="flex justify-between">
        <div class="text-nc-content-gray text-bodyDefaultSmBold font-semibold">
          {{ $t('labels.lastModified') }}
        </div>
        <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
          {{ dayjs(workflow.updated_at).format('DD MMM YYYY, h:mm A') }}
        </div>
      </div>
      <div class="flex justify-between">
        <div class="text-nc-content-gray text-bodyDefaultSmBold font-semibold">
          {{ $t('labels.createdOn') }}
        </div>
        <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
          {{ dayjs(workflow.created_at).format('DD MMM YYYY, h:mm A') }}
        </div>
      </div>
    </div>
  </div>
</template>
