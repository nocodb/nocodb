<script setup lang="ts">
interface Props {
  name: string
  type?: string
  id?: string
  tableId?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: undefined,
  id: undefined,
  tableId: undefined,
})

const { activeProjectId } = storeToRefs(useBases())

const { metas } = useMetas()

const resolvedField = computed(() => {
  if (!props.id || !props.tableId || !activeProjectId.value) return undefined

  const meta = metas.value[`${activeProjectId.value}:${props.tableId}`]

  if (!meta) return { title: props.name, uidt: props.type }

  return (
    (meta.columns || []).find((c: any) => c.id === props.id) || {
      title: props.name,
      uidt: props.type,
    }
  )
})

const displayName = computed(() => resolvedField.value?.title || props.name)
</script>

<template>
  <ChatMarkdownMention :name="displayName">
    <template #icon>
      <SmartsheetHeaderIcon :column="resolvedField" color="text-nc-content-gray-muted" />
    </template>
  </ChatMarkdownMention>
</template>

<style lang="scss" scoped></style>
