<script setup lang="ts">
import { WidgetTypes } from 'nocodb-sdk'
import { calculateNextPosition } from '~/utils/widgetUtils'

const props = defineProps({
  widget: {
    type: Object,
    required: true,
  },
})

const widgetStore = useWidgetStore()

const { createWidget, deleteWidget, updateWidget } = widgetStore

const { activeDashboardWidgets } = storeToRefs(widgetStore)

const { activeDashboardId } = storeToRefs(useDashboardStore())

const loadingState = reactive({
  duplicate: false,
  delete: false,
})

const onDuplicate = async () => {
  const { position, config, title, description, fk_model_id, fk_view_id, meta, fk_dashboard_id } = props.widget
  try {
    loadingState.duplicate = true
    await createWidget(activeDashboardId.value, {
      config,
      title,
      fk_dashboard_id,
      position: {
        ...position,
        ...calculateNextPosition(activeDashboardWidgets.value, position),
      },
      type,
      ...(fk_model_id && { fk_model_id }),
      ...(fk_view_id && { fk_view_id }),
      ...(meta && { meta }),
      ...(description && { description }),
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
          h: 5,
        }
      } else if (size === 'medium') {
        updateObj = {
          w: 2,
          h: 6,
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
    </div>
    <NcDropdown>
      <NcButton type="text" size="xsmall" @click.stop>
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
