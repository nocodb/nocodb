<script setup lang="ts">
const props = defineProps<{
  readOnly?: boolean
}>()

const { selectedNode, selectedNodeId, getNodeMetaById, updateNode, nodes } = useWorkflowOrThrow()

const { $e } = useNuxtApp()

const isDescriptionInEditMode = ref(false)

const isTitleInEditMode = ref(false)

const descriptionInputRef = ref()

const titleInputRef = ref()

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

const pendingTitle = ref<string | undefined>()

const nodeTitle = computed({
  get() {
    return pendingTitle.value ?? selectedNode.value?.data?.title
  },
  set(value) {
    pendingTitle.value = value
  },
})

function enableDescriptionEditMode() {
  isDescriptionInEditMode.value = true
  nextTick(() => {
    descriptionInputRef.value.focus()
  })
}

function handleDescriptionBlur() {
  isDescriptionInEditMode.value = false
  $e('a:workflow:node:description:update', {
    node_type: selectedNode.value?.type,
    node_id: selectedNodeId.value,
  })
}

function enableTitleEditMode() {
  isTitleInEditMode.value = true
  nextTick(() => {
    titleInputRef.value.focus()
  })
}

function handleTitleBlur() {
  const newTitle = pendingTitle.value?.trim()
  const oldTitle = selectedNode.value?.data?.title

  if (newTitle && newTitle !== oldTitle) {
    const isDuplicate = nodes.value.some((node) => node.id !== selectedNodeId.value && node.data?.title === newTitle)

    if (isDuplicate) {
      message.error('A node with this name already exists. Please choose a different name.')
      pendingTitle.value = oldTitle
      return
    }

    updateNode(selectedNodeId.value, {
      data: {
        ...selectedNode.value?.data,
        title: newTitle,
      },
    })
  }

  pendingTitle.value = undefined
  isTitleInEditMode.value = false
  $e('a:workflow:node:title:update', {
    node_type: selectedNode.value?.type,
    node_id: selectedNodeId.value,
  })
}
</script>

<template>
  <div class="px-4 py-5 relative">
    <div v-if="nodeMeta" class="flex gap-3 items-center">
      <div
        class="flex items-center justify-center rounded-lg p-3 border-1 border-nc-brand-100 bg-nc-bg-brand text-nc-content-brand"
      >
        <GeneralIcon :icon="nodeMeta.icon" class="w-6 h-6 stroke-transparent" />
      </div>
      <div>
        <div
          v-if="!isTitleInEditMode || props.readOnly"
          class="text-subHeading2 line-clamp-2 max-w-70"
          @click="enableTitleEditMode"
        >
          {{ nodeTitle }}
        </div>
        <div v-else class="mb-2">
          <a-input
            ref="titleInputRef"
            v-model:value="nodeTitle"
            class="input-sm nc-input-shadow text-subHeading2 !rounded-lg !w-65"
            @keydown.enter="handleTitleBlur"
            @blur="handleTitleBlur"
            @keydown.esc="handleTitleBlur"
          />
        </div>
      </div>
    </div>

    <div class="absolute top-5 right-2">
      <NcButton type="text" size="small" @click="selectedNodeId = null">
        <GeneralIcon icon="ncX" />
      </NcButton>
    </div>

    <div class="mt-4">
      <div
        v-if="!isDescriptionInEditMode || props.readOnly"
        class="text-body line-clamp-3 w-85 px-1"
        @click="enableDescriptionEditMode"
      >
        <span v-if="!nodeDescription && !props.readOnly" class="text-nc-content-gray-muted">
          {{ $t('labels.addDescription') }}
        </span>
        {{ nodeDescription }}
      </div>
      <div v-else>
        <a-textarea
          ref="descriptionInputRef"
          v-model:value="nodeDescription"
          class="!rounded-lg text-body nc-input"
          :auto-size="{ minRows: 2, maxRows: 6 }"
          @keydown.enter="handleDescriptionBlur"
          @blur="handleDescriptionBlur"
          @keydown.esc="handleDescriptionBlur"
        />
      </div>
    </div>
  </div>

  <NcDivider />
</template>

<style scoped lang="scss"></style>
