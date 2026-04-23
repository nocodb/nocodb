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
}

const props = withDefaults(defineProps<Props>(), {
  iconEmoji: null,
  iconFallback: 'ncFileText',
  activeId: null,
  maxWidthClass: 'max-w-1/4',
  iconOnly: false,
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
      <NcList
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
