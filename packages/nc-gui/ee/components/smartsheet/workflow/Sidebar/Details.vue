<script setup lang="ts">
import dayjs from 'dayjs'

const { updateWorkflowData, debouncedWorkflowUpdate } = useWorkflowOrThrow()

const { workflow } = useWorkflowOrThrow()

const isEditingDescription = ref(false)

const localDescription = ref(workflow.value?.description)

const workflowDescription = computed({
  get() {
    return workflow.value?.description
  },
  set(value) {
    updateWorkflowData({
      description: value,
    })
  },
})

const startEditingDescription = () => {
  localDescription.value = workflow.value?.description || ''
  isEditingDescription.value = true
}

const cancelEditingDescription = () => {
  isEditingDescription.value = false
  localDescription.value = ''
}

const saveDescription = () => {
  workflowDescription.value = localDescription.value
  debouncedWorkflowUpdate()
  isEditingDescription.value = false
}
</script>

<template>
  <NcGroupedSettings>
    <template #title>
      <div class="text-nc-content-gray text-subHeading2">
        {{ $t('general.details') }}
      </div>
    </template>
    <div class="flex flex-col gap-6">
      <div v-if="workflowDescription || isEditingDescription">
        <a-textarea
          v-model:value="localDescription"
          class="nc-input-sm !py-2 nc-text-area !text-nc-content-gray nc-input-shadow"
          :placeholder="$t('labels.addDescription')"
          :auto-size="{ minRows: 3, maxRows: 6 }"
          @blur="saveDescription"
          @keydown.ctrl.enter="saveDescription"
          @keydown.meta.enter="saveDescription"
          @keydown.esc="cancelEditingDescription"
        />
      </div>

      <NcButton v-else-if="!workflowDescription" type="secondary" size="small" @click="startEditingDescription">
        {{ $t('labels.addDescription') }}
      </NcButton>
    </div>

    <div>
      <div class="text-nc-content-gray text-caption mb-2">
        {{ $t('labels.createdBy') }}
      </div>

      <div class="flex items-center gap-4">
        <GeneralUserIcon size="base" :user="(workflow as any).created_by_user" />
        <div>
          <div class="text-captionBold capitalize text-nc-content-gray">
            {{ extractUserDisplayNameOrEmail((workflow as any).created_by_user) }}
          </div>
          <div class="text-captionSm text-nc-content-gray-subtle2">
            {{ (workflow as any)?.created_by_user?.email }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="workflow?.updated_at" class="flex justify-between">
      <div class="text-caption">
        {{ $t('labels.lastModified') }}
      </div>
      <div class="text-bodySm text-nc-content-gray-subtle2">
        {{ dayjs(workflow.updated_at).format('DD MMM YYYY, h:mm A') }}
      </div>
    </div>
    <div class="flex justify-between">
      <div class="text-caption">
        {{ $t('labels.createdOn') }}
      </div>
      <div class="text-bodySm text-nc-content-gray-subtle2">
        {{ dayjs(workflow.created_at).format('DD MMM YYYY, h:mm A') }}
      </div>
    </div>
  </NcGroupedSettings>
</template>

<style scoped lang="scss"></style>
