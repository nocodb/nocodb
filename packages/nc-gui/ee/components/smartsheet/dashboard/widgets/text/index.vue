<script setup lang="ts">
import { type TextWidgetType, TextWidgetTypes } from 'nocodb-sdk'
import MarkdownRenderer from '~/components/smartsheet/dashboard/widgets/text/config/Markdown.vue'
import ExpandedTextEditor from '~/components/smartsheet/dashboard/widgets/text/config/ExpandedTextEditor.vue'

interface Props {
  widget: TextWidgetType
  isEditing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditing: false,
})

const config = computed(() => ({
  content: props.widget.config?.content || '',
  formatting: {
    horizontalAlign: props.widget.config?.formatting?.horizontalAlign || 'flex-start',
    verticalAlign: props.widget.config?.formatting?.verticalAlign || 'flex-start',
    bold: props.widget.config?.formatting?.bold || false,
    italic: props.widget.config?.formatting?.italic || false,
    underline: props.widget.config?.formatting?.underline || false,
    strikethrough: props.widget.config?.formatting?.strikethrough || false,
  },
  appearance: {
    font: {
      family: props.widget.config?.appearance?.font?.family || 'Arial',
      weight: props.widget.config?.appearance?.font?.weight || 400,
      size: props.widget.config?.appearance?.font?.size || 16,
      lineHeight: props.widget.config?.appearance?.font?.lineHeight || 1.4,
    },
    color: props.widget.config?.appearance?.color || '#000000',
  },
}))

const textAlignMap = {
  'flex-start': 'left',
  'center': 'center',
  'flex-end': 'right',
} as const

const textAlign = computed(() => textAlignMap[config.value.formatting.horizontalAlign])

const textDecoration = computed(() => {
  const decorations = []
  if (config.value.formatting.underline) decorations.push('underline')
  if (config.value.formatting.strikethrough) decorations.push('line-through')
  return decorations.length > 0 ? decorations.join(' ') : 'none'
})

const showExpandedEditor = ref(false)

const handleDoubleClick = () => {
  if (!props.isEditing) {
    return
  }

  showExpandedEditor.value = true
}

const isMarkdown = computed(() => props.widget.config?.type === TextWidgetTypes.Markdown)

const widgetStore = useWidgetStore()

const { updateWidget } = widgetStore

const handleContentUpdate = useDebounceFn(async (newContent: string) => {
  await updateWidget(props.widget.fk_dashboard_id, props.widget.id, {
    config: {
      ...props.widget.config,
      content: newContent,
    },
  })
}, 1000)
</script>

<template>
  <div
    class="nc-text-widget overflow-hidden truncate !rounded-xl h-full w-full p-4 flex group relative"
    :style="{
      justifyContent: config.formatting.horizontalAlign,
      alignItems: config.formatting.verticalAlign,
    }"
    @dblclick="handleDoubleClick"
  >
    <div
      v-if="widget.config?.type === TextWidgetTypes.Text"
      class="flex-1 whitespace-pre-wrap break-words"
      :style="{
        fontSize: `${config.appearance.font.size}px`,
        fontWeight: config.appearance.font.weight,
        fontFamily: config.appearance.font.family,
        lineHeight: config.appearance.font.lineHeight,
        color: config.appearance.color,
        textAlign,
        fontStyle: config.formatting.italic ? 'italic' : 'normal',
        textDecoration,
        fontSynthesis: 'initial',
      }"
    >
      {{ config.content }}
    </div>
    <div
      v-else
      :key="config.content"
      :style="{
        textAlign,
      }"
      class="flex-1 whitespace-pre-wrap break-words"
    >
      <MarkdownRenderer read-only :value="config.content" />
    </div>
    <SmartsheetDashboardWidgetsCommonContext v-if="isEditing" class="absolute top-2.5 right-2.5" :widget="widget" />
    <ExpandedTextEditor
      v-if="showExpandedEditor"
      v-model:value="showExpandedEditor"
      :content="config.content"
      :is-markdown="isMarkdown"
      @update:content="handleContentUpdate"
    />
  </div>
</template>
