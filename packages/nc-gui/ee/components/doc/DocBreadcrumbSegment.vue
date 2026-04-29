<script setup lang="ts">
import type { DocumentType } from 'nocodb-sdk'
import { DocBreadcrumbCloseTokenInj, DocBreadcrumbOpenChildInj } from './docBreadcrumbInjections'

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
  /** Used by the flat NcList path (e.g. base dropdown) to check-mark the active option */
  activeId?: string | null
  /** Nested-mode only: ids on the active path (all ancestors + current doc) — every matching row is highlighted */
  activeIds?: string[]
  maxWidthClass?: string
  iconOnly?: boolean
  /** Nested mode: each item with children renders its own hover-triggered submenu dropdown */
  nested?: boolean
  /** Required when nested=true — returns children of a doc */
  getChildren?: (docId: string) => DocumentType[]
  /** Required when nested=true — lazy-loads children when a row opens its submenu */
  loadChildren?: (docId: string) => Promise<void> | void
}

const props = withDefaults(defineProps<Props>(), {
  iconEmoji: null,
  iconFallback: 'ncFileText',
  activeId: null,
  activeIds: () => [],
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

const { isRtl } = useRtl()

const isOpen = ref(false)

const segmentPlacement = computed(() => (isRtl.value ? 'bottomRight' : 'bottomLeft'))

const closeToken = ref(0)
provide(DocBreadcrumbCloseTokenInj, closeToken)

// Track which top-level row currently has its submenu open, so when the user
// moves to a different sibling the previous branch collapses.
const openChildId = ref<string | null>(null)
provide(DocBreadcrumbOpenChildInj, openChildId)

const onTopLevelOpenChange = (childId: string | undefined, val: boolean) => {
  if (!childId) return
  if (val) openChildId.value = childId
  else if (openChildId.value === childId) openChildId.value = null
}

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

watch(isOpen, (open) => {
  if (!open) closeToken.value++
})
</script>

<template>
  <NcDropdown v-model:visible="isOpen" :disabled="!hasDropdown" :placement="segmentPlacement" overlay-class-name="max-w-64">
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
      <div v-if="nested && getChildren && loadChildren" class="nc-doc-breadcrumb-menu">
        <DocBreadcrumbMenuRow
          v-for="item in (items as DocumentType[])"
          :key="item.id"
          :doc="item"
          :active-ids="activeIds"
          :get-children="getChildren"
          :load-children="loadChildren"
          :on-select="onSelectNested"
          @open-change="(val: boolean) => onTopLevelOpenChange(item.id, val)"
        />
      </div>

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
            <slot name="listItemIcon" :option="option">
              <LazyGeneralEmojiPicker v-if="option.ncIcon" :emoji="option.ncIcon" readonly size="xsmall" class="flex-none" />
              <GeneralIcon v-else icon="ncFileText" class="flex-none !w-4 !h-4 text-nc-content-gray-muted" />
            </slot>
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
// Top-level menu (inside NcDropdown overlay) and nested submenu overlays
// are plain divs containing DocBreadcrumbMenuRow — each row handles its own
// popup via a nested NcDropdown, decoupling each level's hover/close tracking.
.nc-doc-breadcrumb-menu,
.nc-doc-breadcrumb-submenu-overlay .nc-doc-breadcrumb-submenu {
  @apply p-1 min-w-64 flex flex-col gap-[2px];
}

.nc-doc-breadcrumb-row {
  @apply flex items-center gap-2 w-full min-h-8 py-[5px] px-2 rounded-md cursor-pointer text-sm leading-5 text-nc-content-gray;

  // Active rows get the subtler tint; hover is one notch darker so the
  // feedback is still visible when the user moves across an active row.
  &.nc-doc-breadcrumb-row-active {
    @apply bg-nc-bg-gray-extralight;
  }

  &:hover {
    @apply bg-nc-bg-gray-light;
  }
}
</style>
