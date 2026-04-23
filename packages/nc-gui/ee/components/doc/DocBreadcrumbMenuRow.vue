<script setup lang="ts">
import type { DocumentType } from 'nocodb-sdk'

interface Props {
  doc: DocumentType
  activeId?: string | null
  getChildren: (docId: string) => DocumentType[]
  loadChildren: (docId: string) => Promise<void> | void
  onSelect: (doc: DocumentType) => void
}

const props = defineProps<Props>()

const { t } = useI18n()

const label = computed(() => props.doc.title || t('general.untitled'))

const children = computed(() => (props.doc.id ? props.getChildren(props.doc.id) : []))

// Match sidebar's lenient check — show as submenu if flag is set OR any loaded docs reference this as parent
const hasChildren = computed(() => !!props.doc.has_children || children.value.length > 0)

const isActive = computed(() => props.doc.id === props.activeId)

const onTitleMouseenter = () => {
  if (props.doc.has_children && props.doc.id) {
    props.loadChildren(props.doc.id)
  }
}

const onClickRow = (e: MouseEvent) => {
  e.stopPropagation()
  props.onSelect(props.doc)
}
</script>

<template>
  <a-sub-menu
    v-if="hasChildren"
    popup-class-name="nc-doc-breadcrumb-submenu-popup"
    :popup-offset="[8, -2]"
    @title-mouseenter="onTitleMouseenter"
  >
    <template #title>
      <div class="nc-doc-breadcrumb-row" :class="{ 'nc-doc-breadcrumb-row-active': isActive }" @click="onClickRow">
        <LazyGeneralEmojiPicker v-if="doc.meta?.icon" :emoji="doc.meta.icon" readonly size="xsmall" class="flex-none" />
        <GeneralIcon v-else icon="ncFileText" class="flex-none !w-4 !h-4 text-nc-content-gray-muted" />
        <NcTooltip class="truncate flex-1 min-w-0" show-on-truncate-only>
          <template #title>{{ label }}</template>
          {{ label }}
        </NcTooltip>
        <GeneralIcon icon="arrowRight" class="flex-none text-base text-nc-content-gray-subtle2" />
      </div>
    </template>

    <template #expandIcon> </template>

    <DocBreadcrumbMenuRow
      v-for="child in children"
      :key="child.id"
      :doc="child"
      :active-id="activeId"
      :get-children="getChildren"
      :load-children="loadChildren"
      :on-select="onSelect"
    />
  </a-sub-menu>

  <a-menu-item v-else @click="onSelect(doc)">
    <div class="nc-doc-breadcrumb-row" :class="{ 'nc-doc-breadcrumb-row-active': isActive }">
      <LazyGeneralEmojiPicker v-if="doc.meta?.icon" :emoji="doc.meta.icon" readonly size="xsmall" class="flex-none" />
      <GeneralIcon v-else icon="ncFileText" class="flex-none !w-4 !h-4 text-nc-content-gray-muted" />
      <NcTooltip class="truncate flex-1 min-w-0" show-on-truncate-only>
        <template #title>{{ label }}</template>
        {{ label }}
      </NcTooltip>
      <GeneralIcon v-if="isActive" icon="check" class="flex-none text-primary w-4 h-4" />
    </div>
  </a-menu-item>
</template>
