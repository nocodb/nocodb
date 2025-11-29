<script setup lang="ts">
const { selectedNode, selectedNodeId, getNodeMetaById, updateNode } = useWorkflowOrThrow()

const isDescriptionInEditMode = ref(false)

const descriptionInputRef = ref()

const nodeMeta = computed(() => {
  return getNodeMetaById(selectedNode.value?.type)
})

const nodeDescription = computed({
  get() {
    return selectedNode.value?.data?.description
  },
  set(value) {
    updateNode(selectedNodeId.value, {
      data: {
        ...selectedNode.value?.data,
        description: value,
      },
    })
  },
})

function enableDescriptionEditMode() {
  isDescriptionInEditMode.value = true
  nextTick(() => {
    descriptionInputRef.value.focus()
  })
}
</script>

<template>
  <div class="px-4 py-5">
    <div class="flex gap-3 items-center">
      <div
        class="flex items-center justify-center rounded-lg p-3 border-1 border-nc-brand-100 bg-nc-bg-brand text-nc-content-brand"
      >
        <GeneralIcon :icon="nodeMeta.icon" class="w-6 h-6" />
      </div>
      <div>
        <div class="text-subHeading2">
          {{ nodeMeta.title }}
        </div>
        <span class="capitalize text-nc-content-gray-subtle text-caption rounded-lg px-1 py-0.5 bg-nc-bg-gray-light">
          {{ nodeMeta.category }} Node
        </span>
      </div>
    </div>

    <div class="mt-4">
      <div v-if="!isDescriptionInEditMode" class="text-body px-1" @click="enableDescriptionEditMode">
        <span v-if="!nodeDescription" class="text-nc-content-gray-muted">
          {{ $t('labels.addDescription') }}
        </span>
        {{ nodeDescription }}
      </div>
      <div v-else>
        <a-textarea
          ref="descriptionInputRef"
          v-model:value="nodeDescription"
          class="!rounded-lg text-body !px-1 nc-input"
          :auto-size="{ minRows: 2, maxRows: 6 }"
          @keydown.enter="isDescriptionInEditMode = false"
          @blur="isDescriptionInEditMode = false"
          @keydown.esc="isDescriptionInEditMode = false"
        />
      </div>
    </div>
  </div>

  <NcDivider />
</template>

<style scoped lang="scss"></style>
