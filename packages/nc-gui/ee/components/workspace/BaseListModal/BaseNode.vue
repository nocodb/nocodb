<script lang="ts" setup>
import type { SourceType } from 'nocodb-sdk'

const props = defineProps<{
  base: NcProject
  isStarred?: boolean
  isPrivate?: boolean
  isMarked?: boolean
  // Indicator icons - shown when base has attribute but displayed in another section
  showStarIndicator?: boolean
  showPrivateIndicator?: boolean
}>()

const emit = defineEmits<{
  select: [base: NcProject]
  rename: [base: NcProject, title: string]
  toggleStarred: [baseId: string]
  duplicate: [base: NcProject]
  openErd: [base: NcProject, source: SourceType]
  openSettings: [baseId: string]
  delete: [base: NcProject]
  updateColor: [base: NcProject, color: string]
}>()

const { isUIAllowed } = useRoles()

const { $e } = useNuxtApp()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { showRecordPlanLimitExceededModal } = useEeConfig()

const isMenuOpen = ref(false)
const editMode = ref(false)
const tempTitle = ref('')
const inputRef = useTemplateRef('inputRef')

const iconColor = computed(() => parseProp(props.base.meta).iconColor)

const baseRole = computed(() => props.base.project_role)

const isOptionVisible = computed(() => ({
  baseRename: isUIAllowed('baseRename'),
  baseDuplicate: isUIAllowed('baseDuplicate', { roles: baseRole.value }),
  baseMiscSettings: isUIAllowed('baseMiscSettings'),
  baseDelete: isUIAllowed('baseDelete', { roles: baseRole.value }),
}))

const onSelect = () => {
  if (editMode.value) return
  emit('select', props.base)
}

const enableEditMode = () => {
  if (!isOptionVisible.value.baseRename) return

  editMode.value = true
  tempTitle.value = props.base.title || ''
  isMenuOpen.value = false

  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

const updateTitle = () => {
  if (tempTitle.value?.trim()) {
    tempTitle.value = tempTitle.value.trim()
  }

  if (!tempTitle.value || tempTitle.value === props.base.title) {
    editMode.value = false
    tempTitle.value = ''
    return
  }

  emit('rename', props.base, tempTitle.value)
  editMode.value = false
  tempTitle.value = ''
  $e('a:base:rename')
}

const onToggleStarred = () => {
  emit('toggleStarred', props.base.id!)
  isMenuOpen.value = false
}

const onDuplicate = () => {
  if (showRecordPlanLimitExceededModal()) return

  emit('duplicate', props.base)
  isMenuOpen.value = false
}

const onOpenErd = () => {
  const source = props.base.sources?.[0]
  if (source) {
    emit('openErd', props.base, source)
  }
  isMenuOpen.value = false
}

const onOpenSettings = () => {
  emit('openSettings', props.base.id!)
  isMenuOpen.value = false
}

const onDelete = () => {
  emit('delete', props.base)
  isMenuOpen.value = false
}

const onColorChange = (color: string) => {
  emit('updateColor', props.base, color)
}

const onMenuClick = (e: Event) => {
  e.stopPropagation()
}
</script>

<template>
  <div
    :tabindex="0"
    class="nc-base-node group relative flex items-center gap-3 px-3 py-3 lg:py-4 rounded-xl cursor-pointer border-1 transition-all border-nc-border-gray-medium hover:border-nc-border-gray-dark hover:shadow-sm"
    :class="{ 'is-marked': isMarked, 'is-editing': editMode }"
    @click="onSelect"
    @keydown.enter.stop="onSelect"
  >
    <!-- Project Icon with Color Picker -->
    <GeneralBaseIconColorPicker
      :managed-app="{
        managed_app_master: base.managed_app_master,
        managed_app_id: base.managed_app_id,
      }"
      :key="`${base.id}_${iconColor}`"
      :type="base?.type"
      :model-value="iconColor"
      size="small"
      :readonly="!isOptionVisible.baseRename"
      @update:model-value="onColorChange"
      @click.stop
    />

    <div class="flex-1 min-w-0">
      <!-- Inline Edit Input -->
      <a-input
        v-if="editMode"
        ref="inputRef"
        v-model:value="tempTitle"
        class="!bg-transparent !text-sm !font-medium !rounded-md !px-1 !h-6"
        @click.stop
        @keyup.enter="updateTitle"
        @keyup.esc="updateTitle"
        @blur="updateTitle"
        @keydown.stop
      />
      <!-- Title Display -->
      <NcTooltip v-else show-on-truncate-only class="truncate">
        <div class="text-sm font-medium text-nc-content-gray-extreme truncate" @dblclick.stop="enableEditMode">
          {{ base.title }}
        </div>
        <template #title>{{ base.title }}</template>
      </NcTooltip>
    </div>

    <!-- Indicator icons when base has attribute but shown in another section -->
    <div v-if="showStarIndicator || showPrivateIndicator" class="flex items-center gap-1">
      <NcTooltip v-if="showStarIndicator" class="flex">
        <GeneralIcon icon="star" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />
        <template #title>{{ $t('general.starred') }}</template>
      </NcTooltip>
      <NcTooltip v-if="showPrivateIndicator" class="flex">
        <GeneralIcon icon="ncLock" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />
        <template #title>{{ $t('general.private') }}</template>
      </NcTooltip>
    </div>

    <!-- More Options Button -->
    <NcDropdown
      v-if="!editMode"
      v-model:visible="isMenuOpen"
      :trigger="['click']"
      placement="bottomRight"
      overlay-class-name="nc-base-node-menu"
    >
      <NcButton
        :tabindex="-1"
        type="text"
        size="xsmall"
        class="nc-base-node-menu-btn opacity-0 group-hover:!opacity-100"
        :class="{ '!opacity-100': isMenuOpen }"
        @click.stop="onMenuClick"
      >
        <GeneralIcon icon="threeDotVertical" class="text-nc-content-gray-muted" />
      </NcButton>

      <template #overlay>
        <NcMenu class="!min-w-50" variant="small">
          <!-- Copy Base ID -->
          <NcMenuItemCopyId
            :id="base.id"
            :tooltip="$t('labels.clickToCopyBaseID')"
            :label="$t('labels.baseIdColon', { baseId: base.id })"
          />
          <NcDivider />

          <!-- Rename -->
          <NcMenuItem v-if="isOptionVisible.baseRename" data-testid="nc-base-node-rename" @click="enableEditMode">
            <GeneralIcon icon="rename" />
            {{ $t('general.rename') }} {{ $t('objects.project').toLowerCase() }}
          </NcMenuItem>

          <!-- Toggle Starred -->
          <NcMenuItem data-testid="nc-base-node-starred" @click="onToggleStarred">
            <GeneralIcon v-if="base.starred" icon="unStar" />
            <GeneralIcon v-else icon="star" />
            {{ base.starred ? $t('activity.removeFromStarred') : $t('activity.addToStarred') }}
          </NcMenuItem>

          <!-- Duplicate -->
          <NcMenuItem v-if="isOptionVisible.baseDuplicate" data-testid="nc-base-node-duplicate" @click="onDuplicate">
            <GeneralIcon icon="duplicate" />
            {{ $t('general.duplicate') }} {{ $t('objects.project').toLowerCase() }}
          </NcMenuItem>

          <NcDivider />

          <!-- ERD View -->
          <NcMenuItem v-if="base?.sources?.[0]?.enabled" data-testid="nc-base-node-erd" @click="onOpenErd">
            <GeneralIcon icon="ncErd" />
            {{ $t('title.relations') }}
          </NcMenuItem>

          <!-- Settings -->
          <NcMenuItem v-if="isOptionVisible.baseMiscSettings" data-testid="nc-base-node-settings" @click="onOpenSettings">
            <GeneralIcon icon="settings" />
            {{ $t('activity.settings') }}
          </NcMenuItem>

          <template v-if="isOptionVisible.baseDelete">
            <NcDivider />

            <!-- Delete -->
            <NcMenuItem danger data-testid="nc-base-node-delete" @click="onDelete">
              <GeneralIcon icon="delete" />
              {{ $t('general.delete') }} {{ $t('objects.project').toLowerCase() }}
            </NcMenuItem>
          </template>
        </NcMenu>
      </template>
    </NcDropdown>
  </div>
</template>

<style scoped lang="scss">
.nc-base-node {
  @apply bg-white dark:bg-nc-bg-gray-light;

  &:hover {
    @apply bg-nc-bg-gray-light dark:bg-nc-bg-gray-medium;
  }

  &:focus-visible {
    @apply outline-none shadow-focus;
  }

  &.is-marked {
    @apply bg-nc-bg-gray-medium border-nc-border-brand;
  }

  &.is-editing {
    @apply cursor-default;
  }
}
</style>
