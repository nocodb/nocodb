<script setup lang="ts">
import type { DocumentType } from 'nocodb-sdk'

interface Item {
  id: string
  title?: string
  icon?: string | null
}

interface Props {
  label: string
  iconEmoji?: string | null
  iconFallback?: string
  items: DocumentType[] | Item[]
  activeId?: string | null
  maxWidthClass?: string
  iconOnly?: boolean
  /** Nested mode: render items as a-menu with hover-expand a-sub-menu for items with children */
  nested?: boolean
  /** Required when nested=true — returns children of a doc */
  getChildren?: (docId: string) => DocumentType[]
  /** Required when nested=true — lazy-loads children before submenu expand */
  loadChildren?: (docId: string) => Promise<void> | void
}

const props = withDefaults(defineProps<Props>(), {
  iconEmoji: null,
  iconFallback: 'ncFileText',
  activeId: null,
  maxWidthClass: 'max-w-1/4',
  iconOnly: false,
  nested: false,
  getChildren: undefined,
  loadChildren: undefined,
})

const emit = defineEmits<{
  select: [item: DocumentType | Item]
}>()

const { t } = useI18n()

const isOpen = ref(false)

const listItems = computed<NcListItemType[]>(() =>
  props.items.map((doc) => ({
    value: doc.id!,
    label: doc.title || t('general.untitled'),
    ncIcon: (doc as DocumentType).meta?.icon ?? (doc as Item).icon ?? null,
    raw: doc,
  })),
)

const hasDropdown = computed(() => props.items.length > 0)

const onSelect = (option: NcListItemType & { raw?: DocumentType | Item }) => {
  isOpen.value = false
  if (option.raw) emit('select', option.raw)
}

const onSelectNested = (doc: DocumentType) => {
  isOpen.value = false
  emit('select', doc)
}

// Preload children of visible items when dropdown opens, so submenu hover doesn't flash empty
watch(isOpen, (open) => {
  if (!open || !props.nested || !props.loadChildren) return
  for (const item of props.items as DocumentType[]) {
    if (item.has_children && item.id) {
      props.loadChildren(item.id)
    }
  }
})
</script>

<template>
  <NcDropdown v-model:visible="isOpen" :disabled="!hasDropdown" placement="bottomLeft" overlay-class-name="max-w-64">
    <div
      class="nc-doc-breadcrumb-segment rounded-lg h-8 px-2 flex items-center gap-1 cursor-pointer"
      :class="[
        iconOnly ? '' : maxWidthClass,
        {
          'text-nc-content-gray-emphasis font-weight-500': activeId,
          'text-nc-content-inverted-secondary font-weight-500': !activeId,
          'hover:(bg-nc-bg-gray-light text-nc-content-gray-emphasis)': hasDropdown,
        },
      ]"
    >
      <NcTooltip v-if="iconOnly" :disabled="isOpen">
        <template #title>
          <span class="capitalize">{{ label }}</span>
        </template>
        <slot name="icon">
          <LazyGeneralEmojiPicker v-if="iconEmoji" :emoji="iconEmoji" readonly size="xsmall" class="flex-none" />
          <GeneralIcon v-else :icon="iconFallback" class="flex-none !w-4 !h-4 text-nc-content-gray-muted" />
        </slot>
      </NcTooltip>

      <template v-else>
        <slot name="icon">
          <LazyGeneralEmojiPicker v-if="iconEmoji" :emoji="iconEmoji" readonly size="xsmall" class="flex-none" />
          <GeneralIcon v-else :icon="iconFallback" class="flex-none !w-4 !h-4 text-nc-content-gray-muted" />
        </slot>

        <NcTooltip class="truncate" show-on-truncate-only :disabled="isOpen">
          <template #title>{{ label }}</template>
          <span
            class="text-ellipsis"
            :style="{
              wordBreak: 'keep-all',
              whiteSpace: 'nowrap',
              display: 'inline',
            }"
          >
            {{ label }}
          </span>
        </NcTooltip>

        <GeneralIcon
          v-if="hasDropdown"
          icon="chevronDown"
          class="!text-current opacity-70 flex-none transform transition-transform duration-25 w-3.5 h-3.5"
          :class="{ '!rotate-180': isOpen }"
        />
      </template>
    </div>

    <template #overlay>
      <a-menu v-if="nested && getChildren && loadChildren" class="nc-doc-breadcrumb-menu">
        <DocBreadcrumbMenuRow
          v-for="item in (items as DocumentType[])"
          :key="item.id"
          :doc="item"
          :active-id="activeId"
          :get-children="getChildren"
          :load-children="loadChildren"
          :on-select="onSelectNested"
        />
      </a-menu>

      <NcList
        v-else
        v-model:open="isOpen"
        :value="activeId ?? undefined"
        :list="listItems"
        :search-input-placeholder="$t('general.search')"
        :show-search-always="listItems.length > 4"
        class="min-w-64 !w-auto"
        variant="medium"
        @change="onSelect"
      >
        <template #listItem="{ option }">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <LazyGeneralEmojiPicker v-if="option.ncIcon" :emoji="option.ncIcon" readonly size="xsmall" class="flex-none" />
            <GeneralIcon v-else icon="ncFileText" class="flex-none !w-4 !h-4 text-nc-content-gray-muted" />
            <NcTooltip class="truncate flex-1 min-w-0" show-on-truncate-only>
              <template #title>{{ option.label }}</template>
              {{ option.label }}
            </NcTooltip>
            <GeneralIcon v-if="option.value === activeId" icon="check" class="flex-none text-primary w-4 h-4" />
          </div>
        </template>
      </NcList>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
// Main menu (rendered inside NcDropdown — uses ant-dropdown-menu-* classes, not ant-menu-*).
// Nested submenu popup (.nc-doc-breadcrumb-submenu-popup) uses ant-menu.ant-menu-sub.
.nc-doc-breadcrumb-menu {
  @apply !border-r-0 !rounded-lg !py-2 !px-2 min-w-64;

  .ant-dropdown-menu-submenu-title {
    @apply !h-auto min-h-8 !my-[2px] !py-[5px] !px-2 hover:!bg-nc-bg-gray-light cursor-pointer !rounded-md flex items-center;
  }

  .ant-dropdown-menu-item {
    @apply !h-auto min-h-8 !my-[2px] !py-[5px] text-sm leading-5 !px-2 hover:!bg-nc-bg-gray-light cursor-pointer !rounded-md flex items-center;

    .ant-dropdown-menu-title-content {
      @apply w-full px-0 flex items-center;
    }
  }

  .ant-dropdown-menu-submenu-title .ant-dropdown-menu-title-content {
    @apply w-full px-0 flex items-center;
  }
}

.nc-doc-breadcrumb-submenu-popup {
  @apply !rounded-lg border-1 border-nc-border-gray-medium;

  .ant-menu.ant-menu-sub {
    @apply !border-r-0 !rounded-lg !py-2 !px-2 min-w-64 !shadow-lg shadow-nc-border-gray-medium;

    .ant-menu-submenu-title {
      @apply !h-auto min-h-8 !my-[2px] !py-[5px] !px-2 hover:!bg-nc-bg-gray-light cursor-pointer !rounded-md flex items-center;

      .ant-menu-title-content {
        @apply w-full px-0 flex items-center;
      }
    }

    .ant-menu-item {
      @apply !h-auto min-h-8 !my-[2px] !py-[5px] text-sm leading-5 !px-2 hover:!bg-nc-bg-gray-light cursor-pointer !rounded-md flex items-center;

      .ant-menu-title-content {
        @apply w-full px-0 flex items-center;
      }

      &.ant-menu-item-selected {
        @apply bg-transparent;
      }
    }
  }
}

.nc-doc-breadcrumb-row {
  @apply flex items-center gap-2 w-full !text-nc-content-gray;

  &.nc-doc-breadcrumb-row-active {
    @apply !font-weight-500;
  }
}
</style>
