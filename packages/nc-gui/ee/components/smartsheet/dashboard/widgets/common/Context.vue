<script setup lang="ts">
const props = defineProps({
  widget: {
    type: Object,
    required: true,
  },
})

const { createWidget, deleteWidget } = useWidgetStore()

const { activeDashboardId } = storeToRefs(useDashboardStore())

const loadingState = reactive({
  duplicate: false,
  delete: false,
})

const onDuplicate = async () => {
  const { type, title, position, config } = props.widget
  try {
    loadingState.duplicate = true
    await createWidget(activeDashboardId.value, {
      type,
      title,
      position,
      config,
    })
  } finally {
    loadingState.duplicate = false
  }
}

const onDelete = async () => {
  try {
    loadingState.delete = true
    await deleteWidget(activeDashboardId.value, props.widget.id)
  } finally {
    loadingState.delete = false
  }
}
</script>

<template>
  <NcDropdown>
    <NcButton type="text" size="small" @click.stop>
      <GeneralIcon icon="threeDotVertical" />
    </NcButton>

    <template #overlay>
      <NcMenu variant="small">
        <NcMenuItem @click="onDuplicate">
          <GeneralLoader v-if="loadingState.duplicate" />
          <GeneralIcon v-else class="text-gray-700" icon="duplicate" />
          Duplicate widget
        </NcMenuItem>
        <NcDivider />
        <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click="onDelete">
          <GeneralLoader v-if="loadingState.delete" />
          <GeneralIcon v-else icon="ncTrash2" />
          Delete widget
        </NcMenuItem>
      </NcMenu>
    </template>
  </NcDropdown>
</template>
