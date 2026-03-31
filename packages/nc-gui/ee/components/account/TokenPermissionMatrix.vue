<script lang="ts" setup>
import { ApiTokenPermissionCategory, ApiTokenPermissionLevel } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: Record<string, string>
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const showAddDropdown = ref(false)
const openLevelDropdown = ref<string | null>(null)

const categoryInfo = computed<Record<string, { label: string; desc: string }>>(() => ({
  [ApiTokenPermissionCategory.RECORDS]: { label: t('labels.tokenPerm.records'), desc: t('labels.tokenPerm.recordsDesc') },
  [ApiTokenPermissionCategory.COMMENTS]: { label: t('labels.tokenPerm.comments'), desc: t('labels.tokenPerm.commentsDesc') },
  [ApiTokenPermissionCategory.TABLES]: { label: t('labels.tokenPerm.tables'), desc: t('labels.tokenPerm.tablesDesc') },
  [ApiTokenPermissionCategory.FIELDS]: { label: t('labels.tokenPerm.fields'), desc: t('labels.tokenPerm.fieldsDesc') },
  [ApiTokenPermissionCategory.VIEWS]: { label: t('labels.tokenPerm.views'), desc: t('labels.tokenPerm.viewsDesc') },
  [ApiTokenPermissionCategory.WEBHOOKS]: { label: t('labels.tokenPerm.webhooks'), desc: t('labels.tokenPerm.webhooksDesc') },
  [ApiTokenPermissionCategory.BASE]: { label: t('labels.tokenPerm.base'), desc: t('labels.tokenPerm.baseDesc') },
  [ApiTokenPermissionCategory.USERS]: { label: t('labels.tokenPerm.users'), desc: t('labels.tokenPerm.usersDesc') },
}))

const accessLevels = [
  { value: ApiTokenPermissionLevel.READ, label: t('labels.readOnlyAccess') },
  { value: ApiTokenPermissionLevel.WRITE, label: t('labels.readAndWrite') },
]

// Categories that have been explicitly added (non-none)
const addedCategories = computed(() => {
  return Object.entries(props.modelValue)
    .filter(([_, level]) => level !== ApiTokenPermissionLevel.NONE)
    .map(([key]) => key)
})

// Categories available to add
const availableCategories = computed(() => {
  return Object.values(ApiTokenPermissionCategory).filter((cat) => !addedCategories.value.includes(cat))
})

const addCategory = (category: string) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [category]: ApiTokenPermissionLevel.READ,
  })
  showAddDropdown.value = false
}

const removeCategory = (category: string) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [category]: ApiTokenPermissionLevel.NONE,
  })
}

const setLevel = (category: string, level: string) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [category]: level,
  })
  openLevelDropdown.value = null
}

const getLevelLabel = (level: string) => {
  return accessLevels.find((l) => l.value === level)?.label || level
}
</script>

<template>
  <div class="nc-token-permission-matrix">
    <!-- Added permission rows in a single bordered container -->
    <div v-if="addedCategories.length" class="border-1 border-nc-border-gray-medium rounded-lg overflow-hidden">
      <div
        v-for="(cat, idx) in addedCategories"
        :key="cat"
        class="nc-perm-row"
        :class="{ 'border-t-1 border-nc-border-gray-light': idx > 0 }"
      >
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-nc-content-gray-extreme">{{ categoryInfo[cat]?.label || cat }}</div>
          <div class="text-xs text-nc-content-gray-subtle2">{{ categoryInfo[cat]?.desc }}</div>
        </div>
        <NcDropdown
          :visible="openLevelDropdown === cat"
          :trigger="['click']"
          placement="bottomRight"
          @update:visible="(v: boolean) => { openLevelDropdown = v ? cat : null }"
        >
          <button class="nc-perm-level-pill" @click="openLevelDropdown = openLevelDropdown === cat ? null : cat">
            <span class="text-xs text-nc-content-gray-muted">{{ $t('general.access') }}:</span>
            <span class="text-xs font-semibold text-nc-content-gray-extreme">{{ getLevelLabel(modelValue[cat]) }}</span>
            <GeneralIcon icon="arrowDown" class="w-3 h-3 text-nc-content-gray-muted ml-auto" />
          </button>

          <template #overlay>
            <NcMenu variant="small" class="!min-w-36">
              <NcMenuItem
                v-for="lvl in accessLevels"
                :key="lvl.value"
                :class="{ '!bg-nc-bg-gray-light': modelValue[cat] === lvl.value }"
                @click="setLevel(cat, lvl.value)"
              >
                {{ lvl.label }}
              </NcMenuItem>
            </NcMenu>
          </template>
        </NcDropdown>
        <NcButton type="text" size="xxsmall" class="!p-0.5 flex-none" @click="removeCategory(cat)">
          <GeneralIcon icon="close" class="w-4 h-4 text-nc-content-gray-muted" />
        </NcButton>
      </div>
    </div>

    <!-- Add permission -->
    <div class="flex">
      <NcDropdown
        v-if="availableCategories.length"
        v-model:visible="showAddDropdown"
        :trigger="['click']"
        placement="bottomLeft"
        overlay-class-name="nc-perm-add-dropdown"
      >
        <NcButton
          v-e="['c:api-token:add-permission']"
          type="text"
          size="small"
          class="!text-brand-500 !px-2 !font-medium"
          data-testid="nc-token-perm-add"
        >
          <div class="flex items-center gap-1">
            <component :is="iconMap.plus" class="w-4 h-4" />
            {{ $t('labels.addPermission') }}
          </div>
        </NcButton>

        <template #overlay>
          <div class="nc-perm-dropdown-content">
            <div v-for="cat in availableCategories" :key="cat" class="nc-perm-dropdown-item" @click="addCategory(cat)">
              <div>
                <div class="text-sm font-medium text-nc-content-gray-extreme">{{ categoryInfo[cat]?.label || cat }}</div>
                <div class="text-xs text-nc-content-gray-subtle2">{{ categoryInfo[cat]?.desc }}</div>
              </div>
            </div>
          </div>
        </template>
      </NcDropdown>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-perm-row {
  @apply flex items-center gap-3 px-3 py-2.5;
}

.nc-token-permission-matrix {
  @apply flex flex-col gap-2;
}

.nc-perm-level-pill {
  @apply flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
    bg-nc-bg-gray-light border-1 border-nc-border-gray-medium
    cursor-pointer transition-all flex-none w-44;

  &:hover {
    @apply bg-nc-bg-gray-medium;
  }
}

.nc-perm-dropdown-content {
  @apply w-72 bg-nc-bg-default rounded-lg shadow-lg border-1 border-nc-border-gray-medium py-1 max-h-64 overflow-y-auto nc-scrollbar-thin;
}

.nc-perm-dropdown-item {
  @apply px-3 py-2 cursor-pointer;

  &:hover {
    @apply bg-nc-bg-gray-light;
  }
}
</style>
