<script setup lang="ts">
const { selectedNodeId, updateNode, getNodeMetaById, selectedNode } = useWorkflowOrThrow()

const formSchema = computed(() => {
  if (!selectedNode.value || !selectedNode.value.type) return []
  const nodeMeta = getNodeMetaById(selectedNode.value.type)
  return nodeMeta?.form || []
})

const { formState } = useProvideFormBuilderHelper({
  formSchema,
  initialState: computed(() => selectedNode.value?.data || {}),
  onChange: () => {
    if (!selectedNodeId.value) return
    updateNode(selectedNodeId.value, {
      data: formState.value,
    })
  },
})
</script>

<template>
  <div class="px-4">
    <NcFormBuilder v-if="formSchema.length > 0" />
  </div>
</template>

<style scoped lang="scss"></style>
