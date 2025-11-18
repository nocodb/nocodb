<script setup lang="ts">
const { selectedNodeId, updateNode, getBackendNodeDef, selectedNode } = useWorkflowOrThrow()

const formData = ref<Record<string, any>>(selectedNode.value?.data || {})

const formSchema = computed(() => {
  if (!selectedNode.value || !selectedNode.value.type) return []
  const backendNodeDef = getBackendNodeDef(selectedNode.value.type)
  return backendNodeDef?.form || []
})

const { formState } = useProvideFormBuilderHelper({
  formSchema,
  initialState: formData,
  onChange: () => {
    if (!selectedNodeId.value) return
    updateNode(selectedNodeId.value, {
      data: formState.value,
    })
  },
})

// Watch for changes to selectedNode and update formData
watch(
  () => selectedNode.value?.data,
  (newData) => {
    formData.value = newData || {}
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <div class="px-4">
    <NcFormBuilder v-if="formSchema.length > 0" />
  </div>
</template>

<style scoped lang="scss"></style>
