<script setup lang="ts">
/**
 * Renders the kebab + dropdown menu for a folder.
 * Layout: this is just the kebab button wrapped in a dropdown — the parent renders its own header
 * row and forwards right-click via the slot's open() function so layout is owned by the parent.
 */
import type { BookmarkGroupType } from 'nocodb-sdk'

interface Props {
  group: BookmarkGroupType
}

const props = defineProps<Props>()

const { group } = toRefs(props)

const emit = defineEmits<{ rename: [] }>()

const { removeGroup, updateGroup } = useBookmarks()

const { $e } = useNuxtApp()

const isOpen = ref(false)

const isDefault = computed(() => group.value.name === 'Ungrouped')

const iconColor = computed(() => (group.value.meta as Record<string, any> | undefined)?.iconColor || '')

defineExpose({
  /** Opens the dropdown — parent calls this from contextmenu / kebab click */
  open() {
    if (isDefault.value) return
    isOpen.value = true
  },
})

function onRename() {
  isOpen.value = false
  emit('rename')
}

async function onDelete() {
  isOpen.value = false
  await removeGroup(group.value.id!)
  $e('a:bookmark:group:delete')
}

async function onChangeColor(color: string) {
  const nextMeta = { ...((group.value.meta as Record<string, any>) ?? {}), iconColor: color }
  await updateGroup(group.value.id!, { meta: nextMeta } as any)
  $e('a:bookmark:group:color')
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen" :disabled="isDefault" placement="bottomRight" overlay-class-name="nc-bookmark-group-menu">
    <NcButton
      type="text"
      size="xxsmall"
      class="nc-bookmark-group-kebab !rounded-md flex-none"
      :class="{ 'invisible': isDefault, '!opacity-100': isOpen }"
      data-testid="nc-bookmark-group-kebab"
      @click.stop
    >
      <GeneralIcon icon="threeDotVertical" class="!w-3.5 !h-3.5 text-nc-content-gray-muted" />
    </NcButton>
    <template #overlay>
      <NcMenu variant="small" class="nc-bookmark-group-menu">
        <NcMenuItem class="!hover:bg-transparent !cursor-default !pb-0.5">
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="ncPalette" class="w-4 h-4 opacity-80" />
            {{ $t('labels.iconColour') }}
          </div>
        </NcMenuItem>
        <div class="px-3.5 pb-1">
          <GeneralColorPicker
            :model-value="iconColor"
            :colors="baseIconColors"
            :is-new-design="true"
            class="nc-bookmark-group-color-picker"
            @input="onChangeColor"
          />
        </div>
        <NcDivider />
        <NcMenuItem data-testid="nc-bookmark-group-rename" @click="onRename">
          <div v-e="['c:bookmark:group:rename']" class="flex gap-2 items-center">
            <GeneralIcon icon="rename" class="w-4 h-4" />
            {{ $t('general.rename') }}
          </div>
        </NcMenuItem>
        <NcDivider />
        <NcMenuItem data-testid="nc-bookmark-group-delete" class="!text-nc-content-red-dark" @click="onDelete">
          <div v-e="['c:bookmark:group:delete']" class="flex gap-2 items-center">
            <GeneralIcon icon="delete" class="w-4 h-4" />
            {{ $t('labels.deleteFolder') }}
          </div>
        </NcMenuItem>
      </NcMenu>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.nc-bookmark-group-color-picker.nc-bookmark-group-color-picker {
  @apply !p-0;
  .color-picker-row {
    @apply !space-x-0.5 mb-1;
    & > div {
      @apply !p-0.5 !rounded !h-6;
    }
  }
  .color-selector {
    @apply !h-5 !w-5 !rounded;
  }
  .nc-more-colors-trigger {
    @apply !h-5 !w-5;
    .w-4 {
      @apply !w-3 !h-3;
    }
  }
}
</style>
