<script setup lang="ts">
import dayjs from 'dayjs'

const { updateWorkflowData, debouncedWorkflowUpdate } = useWorkflowOrThrow()

const { workflow } = useWorkflowOrThrow()

const { $e } = useNuxtApp()

const isTitleInEditMode = ref(false)

const isDescriptionInEditMode = ref(false)

const titleInputRef = ref()

const descriptionInputRef = ref()

const localInput = reactive({
  title: workflow.value?.title || '',
  description: workflow.value?.description || '',
})

const workflowTitle = computed({
  get() {
    return localInput.title
  },
  set(value) {
    localInput.title = value
    updateWorkflowData({ title: value })
    debouncedWorkflowUpdate()
  },
})

const workflowDescription = computed({
  get() {
    return localInput.description
  },
  set(value) {
    localInput.description = value
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

function handleTitleBlur() {
  isTitleInEditMode.value = false
  $e('a:workflow:title:update', {
    workflow_id: workflow.value?.id,
  })
}

function handleDescriptionBlur() {
  isDescriptionInEditMode.value = false
  $e('a:workflow:description:update', {
    workflow_id: workflow.value?.id,
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
            class="!rounded-lg text-subHeading2 nc-input !w-74"
            @blur="handleTitleBlur"
            @keydown.enter="handleTitleBlur"
            @keydown.esc="handleTitleBlur"
          />
        </div>
      </div>

      <div class="mt-2">
        <div
          v-if="!isDescriptionInEditMode"
          class="text-body text-nc-content-gray-subtle line-clamp-3 w-85 px-1"
          @click="enableDescriptionEditMode"
        >
          <span v-if="!workflowDescription" class="text-nc-content-gray-muted">
            {{ $t('labels.addDescription') }}
          </span>
          <template v-else>
            {{ workflowDescription }}
          </template>
        </div>
        <div v-else>
          <a-textarea
            ref="descriptionInputRef"
            v-model:value="workflowDescription"
            class="!rounded-lg text-body nc-input"
            :auto-size="{ minRows: 2, maxRows: 6 }"
            @keydown.enter="handleDescriptionBlur"
            @blur="handleDescriptionBlur"
            @keydown.esc="handleDescriptionBlur"
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
