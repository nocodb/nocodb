<script setup lang="ts">
import type { DocumentType } from 'nocodb-sdk'

interface Props {
  docId: string
  currentTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  currentTitle: '',
})

const documentsStore = useDocumentsStore()
const { activeDocument } = storeToRefs(documentsStore)
const { getDocumentAncestors } = documentsStore

const { ncNavigateTo } = useGlobal()

const basesStore = useBases()
const { activeProjectId } = storeToRefs(basesStore)
const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { t } = useI18n()

const ancestors = computed(() => getDocumentAncestors(props.docId))

// Fixed 4-item layout: Root / ... / Parent / Current
const rootAncestor = computed(() => (ancestors.value.length > 0 ? ancestors.value[0] : null))

const parentAncestor = computed(() => (ancestors.value.length > 1 ? ancestors.value[ancestors.value.length - 1] : null))

// Single middle ancestor shown inline (when exactly 3 ancestors: root, middle, parent)
const middleAncestor = computed(() => (ancestors.value.length === 3 ? ancestors.value[1] : null))

// Collapsed middle ancestors (between root and parent) shown in dropdown
const collapsedMiddle = computed(() => {
  if (ancestors.value.length <= 3) return []
  return ancestors.value.slice(1, ancestors.value.length - 1)
})

const hasCollapsed = computed(() => collapsedMiddle.value.length > 0)

const isEllipsisOpen = ref(false)

// Dropdown: show collapsed ancestor chain as nested tree (parent path, not siblings)
const dropdownItems = computed<NcListItemType[]>(() => {
  if (!collapsedMiddle.value.length) return []

  return collapsedMiddle.value.map((ancestor, index) => ({
    value: ancestor.id!,
    label: ancestor.title || t('general.untitled'),
    ncIcon: ancestor.meta?.icon,
    ncDepth: index,
  }))
})

const collapsedDocsMap = computed(() => {
  const map = new Map<string, DocumentType>()
  for (const doc of collapsedMiddle.value) {
    if (doc.id) map.set(doc.id, doc)
  }
  return map
})

const handleDropdownSelect = (option: NcListItemType) => {
  const doc = collapsedDocsMap.value.get(option.value as string)
  if (doc) navigateToDoc(doc)
}

const navigateToDoc = (doc: DocumentType) => {
  if (!doc.id || !activeProjectId.value) return
  isEllipsisOpen.value = false
  ncNavigateTo({
    workspaceId: activeWorkspaceId.value,
    baseId: activeProjectId.value,
    docId: doc.id,
    docTitle: doc.title,
  })
}

const getDocIcon = (doc: DocumentType) => {
  return doc.meta?.icon
}

const displayTitle = computed(() => props.currentTitle || activeDocument.value?.title || t('general.untitled'))
</script>

<template>
  <div class="nc-doc-breadcrumb" data-testid="nc-doc-breadcrumb">
    <!-- 1. Root ancestor -->
    <template v-if="rootAncestor">
      <div class="nc-doc-breadcrumb-item nc-clickable" @click="navigateToDoc(rootAncestor)">
        <span class="nc-doc-breadcrumb-text">{{ rootAncestor.title || $t('general.untitled') }}</span>
      </div>
      <GeneralIcon icon="ncSlash1" class="nc-doc-breadcrumb-divider" />
    </template>

    <!-- 2a. Single middle ancestor shown inline -->
    <template v-if="middleAncestor">
      <div class="nc-doc-breadcrumb-item nc-clickable" @click="navigateToDoc(middleAncestor)">
        <span class="nc-doc-breadcrumb-text">{{ middleAncestor.title || $t('general.untitled') }}</span>
      </div>
      <GeneralIcon icon="ncSlash1" class="nc-doc-breadcrumb-divider" />
    </template>

    <!-- 2b. `...` dropdown -->
    <template v-if="hasCollapsed">
      <NcDropdown v-model:visible="isEllipsisOpen" placement="bottomLeft">
        <div
          class="nc-doc-breadcrumb-item nc-clickable nc-doc-breadcrumb-ellipsis"
          @click.stop="isEllipsisOpen = !isEllipsisOpen"
        >
          ...
        </div>
        <template #overlay>
          <NcList
            v-model:open="isEllipsisOpen"
            :list="dropdownItems"
            :show-search-always="dropdownItems.length > 4"
            :search-input-placeholder="$t('general.search')"
            variant="small"
            class="!w-64"
            @change="handleDropdownSelect"
          >
            <template #listItem="{ option }">
              <div class="flex items-center gap-2 truncate"">
                <GeneralIcon
                  v-if="option.ncDepth > 0"
                  icon="ncCornerDownRight"
                  class="flex-none text-nc-content-gray-muted !w-3 !h-3 ml-1 -mr-0.5"
                />
                <LazyGeneralEmojiPicker v-if="option.ncIcon" :emoji="option.ncIcon" readonly size="xsmall" />
                <GeneralIcon v-else icon="ncFileText" class="flex-none text-nc-content-gray-muted !w-4 !h-4" />
                <NcTooltip class="truncate" show-on-truncate-only>
                  <template #title>{{ option.label }}</template>
                  {{ option.label }}
                </NcTooltip>
              </div>
            </template>
          </NcList>
        </template>
      </NcDropdown>
      <GeneralIcon icon="ncSlash1" class="nc-doc-breadcrumb-divider" />
    </template>

    <!-- 3. Parent ancestor -->
    <template v-if="parentAncestor">
      <div class="nc-doc-breadcrumb-item nc-clickable" @click="navigateToDoc(parentAncestor)">
        <span class="nc-doc-breadcrumb-text">{{ parentAncestor.title || $t('general.untitled') }}</span>
      </div>
      <GeneralIcon icon="ncSlash1" class="nc-doc-breadcrumb-divider" />
    </template>

    <!-- 4. Current page (active) -->
    <div
      class="nc-doc-breadcrumb-item active"
      :class="{
        'nc-doc-breadcrumb-item-full-size': !ancestors.length,
      }"
    >
      <span class="nc-doc-breadcrumb-text">{{ displayTitle }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-doc-breadcrumb {
  @apply flex items-center text-body text-nc-content-gray-subtle max-w-full w-full min-w-0;

  .nc-doc-breadcrumb-item {
    @apply h-7 px-2 leading-7 overflow-hidden;
    max-width: 20%;
    flex: 0 1 auto;

    &.nc-clickable {
      @apply cursor-pointer select-none rounded-md hover:(bg-nc-bg-gray-light text-nc-content-gray);
    }

    &.active {
      @apply !font-medium !text-nc-content-gray;
      max-width: 45%;
      flex: 1 1 auto;

      &.nc-doc-breadcrumb-item-full-size {
        max-width: fit-content !important;
      }
    }
  }

  .nc-doc-breadcrumb-text {
    @apply block truncate;
  }

  .nc-doc-breadcrumb-divider {
    @apply mx-0.5 flex-none text-nc-content-gray-muted/80 !stroke-transparent;
  }

  .nc-doc-breadcrumb-ellipsis {
    @apply font-medium;
    flex: 0 0 auto;
    max-width: none;
    overflow: visible;
  }
}
</style>
