<script setup lang="ts">
import { WidgetTypes } from 'nocodb-sdk'

const props = defineProps({
  widget: {
    type: Object,
    required: true,
  },
})

const { createWidget, deleteWidget, updateWidget } = useWidgetStore()

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

const widgetType = computed(() => {
  return props.widget.type
})

const onDelete = async () => {
  try {
    loadingState.delete = true
    await deleteWidget(activeDashboardId.value, props.widget.id)
  } finally {
    loadingState.delete = false
  }
}

const onResizeClick = (size: 'small' | 'medium' | 'large') => {
  let updateObj = {
    w: 1,
    h: 1,
  }
  switch (widgetType.value) {
    case WidgetTypes.CHART:
      if (size === 'small') {
        updateObj = {
          w: 2,
          h: 2,
        }
      } else if (size === 'medium') {
        updateObj = {
          w: 2,
          h: 3,
        }
      } else if (size === 'large') {
        updateObj = {
          w: 2,
          h: 4,
        }
      }
  }

  updateWidget(activeDashboardId.value, props.widget.id, {
    position: {
      ...props.widget.position,
      ...updateObj,
    },
  })
}
</script>

<template>
  <div class="flex items-center gap-2">
    <div v-if="widgetType === WidgetTypes.CHART" class="flex items-center gap-2">
      <NcTooltip hide-on-click placement="top">
        <NcButton type="text" size="xsmall" @click.stop="onResizeClick('small')">
          <GeneralIcon icon="ncSquare" />
        </NcButton>

        <template #title> Small </template>
      </NcTooltip>
      <NcTooltip hide-on-click placement="top">
        <NcButton type="text" size="xsmall" @click.stop="onResizeClick('medium')">
          <GeneralIcon icon="ncSquare" />
        </NcButton>
        <template #title> Medium </template>
      </NcTooltip>

      <NcTooltip hide-on-click placement="top">
        <NcButton type="text" size="xsmall" @click.stop="onResizeClick('large')">
          <GeneralIcon icon="ncSquare" />
        </NcButton>
        <template #title> Large </template>
      </NcTooltip>
    </div>
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
  </div>
</template>
