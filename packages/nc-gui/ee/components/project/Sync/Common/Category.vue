<script setup lang="ts">
import { SyncCategory, SyncCategoryMeta, TARGET_TABLES_META } from 'nocodb-sdk'
import { useSyncFormOrThrow } from '../useSyncForm'

const categories = Object.values(SyncCategoryMeta)

const { isSyncAdvancedFeaturesEnabled } = storeToRefs(useSyncStore())

const { syncConfigForm, mode, syncCategoryIntegrationMap } = useSyncFormOrThrow()

const syncAllModels = ref(true)

const isChildTooltipHovering = ref(false)

const availableModels = computed(() => {
  return Object.values(TARGET_TABLES_META).filter(
    (model) => model.category === syncConfigForm.value.sync_category || !syncConfigForm.value.sync_category,
  )
})

const selectSyncAllModels = (value: boolean) => {
  if (mode === 'edit') {
    return
  }
  syncAllModels.value = value
  syncConfigForm.value.exclude_models = []
}

const selectCategory = (category: (typeof SyncCategoryMeta)[keyof typeof SyncCategoryMeta]) => {
  if (mode === 'edit') {
    return
  }
  if (category.comingSoon) {
    return
  }

  if (category.beta && !isSyncAdvancedFeaturesEnabled.value) {
    return
  }
  syncConfigForm.value.sync_category = category.value
}

const onModelChanged = (model: (typeof TARGET_TABLES_META)[keyof typeof TARGET_TABLES_META]) => {
  if (mode === 'edit') {
    return
  }
  if (model.required) {
    return
  }
  if (syncConfigForm.value.exclude_models.includes(model.value)) {
    syncConfigForm.value.exclude_models = syncConfigForm.value.exclude_models.filter((m) => m !== model.value)
  } else {
    syncConfigForm.value.exclude_models.push(model.value)
  }
}

const splitIntegrations = (integrations: IntegrationItemType[] = []) => {
  return {
    visible: integrations.slice(0, 3),
    hidden: integrations
      .slice(3)
      .map((i) => i.title)
      .join(', '),
    hiddenCount: integrations.length - 3,
  }
}
</script>

<template>
  <div class="nc-form-section">
    <div class="nc-form-section-title">
      {{ $t('labels.category') }}
    </div>
    <div>
      <div class="nc-form-section-input-label">
        {{ $t('labels.selectACategory') }}
      </div>
      <div class="grid grid-cols-4 gap-2.5">
        <NcTooltip
          v-for="category in categories"
          :key="category.value"
          :disabled="!(syncConfigForm.sync_category === category.value && mode === 'edit') || isChildTooltipHovering"
          :class="{
            'border-nc-border-brand !shadow-selected': syncConfigForm.sync_category === category.value && mode === 'create',
            'border-nc-border-gray-extradark !shadow-disabled':
              syncConfigForm.sync_category === category.value && mode === 'edit',
            'hover:shadow-hover cursor-pointer':
              !category.comingSoon && (category.beta ? isSyncAdvancedFeaturesEnabled : true) && mode === 'create',
          }"
          class="p-3 border-1 flex flex-col gap-2 rounded-lg transition-shadow border-nc-border-gray-medium"
          @click="selectCategory(category)"
        >
          <template #title> Category not editable in edit mode </template>
          <div
            v-if="!category.comingSoon && (category.beta ? isSyncAdvancedFeaturesEnabled : true)"
            class="max-h-5 h-5 flex items-center gap-1.5"
            @mouseenter.stop="isChildTooltipHovering = true"
            @mouseleave.stop="isChildTooltipHovering = false"
          >
            <NcTooltip
              v-for="integration of splitIntegrations(syncCategoryIntegrationMap[category.value]).visible"
              :key="integration.sub_type"
              :title="integration.title"
              class="h-6 w-6 flex-none rounded-md bg-nc-bg-gray-light flex items-center justify-center"
            >
              <GeneralIntegrationIcon v-if="integration?.sub_type" :type="integration.sub_type" size="sx" />
            </NcTooltip>
            <!-- Show +N if more than 4 -->

            <NcTooltip
              v-if="splitIntegrations(syncCategoryIntegrationMap[category.value]).hiddenCount > 0"
              class="h-6 w-6 flex-none rounded-md bg-nc-bg-gray-light flex items-center justify-center text-bodySm text-nc-content-gray-subtle"
            >
              <template #title>
                <div class="max-w-60">{{ splitIntegrations(syncCategoryIntegrationMap[category.value]).hidden }}</div>
              </template>
              +{{ splitIntegrations(syncCategoryIntegrationMap[category.value]).hiddenCount }}
            </NcTooltip>
          </div>

          <NcBadgeComingSoon v-else class="bg-nc-bg-gray-medium !w-[fit-content] text-nc-content-gray-subtle2" />
          <div class="text-captionBold text-nc-content-gray">
            {{ category.label }}
          </div>

          <div>
            <NcTooltip
              show-on-truncate-only
              :line-clamp="2"
              placement="bottom"
              class="min-w-0 text-bodyDefaultSm text-nc-content-gray-muted !line-clamp-2"
            >
              <template #title>
                {{ category.description }}
              </template>

              {{ category.description }}
            </NcTooltip>
          </div>
        </NcTooltip>
      </div>
    </div>

    <div v-if="syncConfigForm.sync_category !== SyncCategory.CUSTOM">
      <div class="nc-form-section-input-label">
        {{ $t('labels.syncScope') }}
      </div>

      <div class="grid grid-cols-2 gap-3">
        <NcTooltip
          :disabled="!(syncAllModels && mode === 'edit')"
          :class="{
            'border-nc-border-brand !shadow-selected': syncAllModels && mode === 'create',
            'border-nc-border-gray-extradark !shadow-disabled': syncAllModels && mode === 'edit',
            'cursor-pointer': mode === 'create',
          }"
          class="flex flex-col p-3 border-1 rounded-lg gap-1"
          @click="selectSyncAllModels(true)"
        >
          <template #title> Sync scope not editable in edit mode </template>
          <div class="flex items-center gap-3">
            <div class="nc-radio" :data-checked="syncAllModels">
              <div class="nc-radio-dot"></div>
            </div>
            <div class="text-nc-content-gray text-caption">
              {{ $t('labels.syncAllTables') }}
            </div>
          </div>

          <div class="text-nc-content-gray-muted text-bodySm pl-7">
            {{ $t('labels.syncAllTablesDescription') }}
          </div>
        </NcTooltip>
        <NcTooltip
          :disabled="!(syncAllModels && mode === 'edit')"
          class="flex flex-col p-3 border-1 rounded-lg gap-1"
          :class="{
            'border-nc-border-brand !shadow-selected': !syncAllModels && mode === 'create',
            'border-nc-border-gray-extradark !shadow-disabled': !syncAllModels && mode === 'edit',
            'cursor-pointer': mode === 'create',
          }"
          @click="selectSyncAllModels(false)"
        >
          <template #title> Sync scope not editable in edit mode </template>
          <div class="flex items-center gap-3">
            <div class="nc-radio" :data-checked="!syncAllModels">
              <div class="nc-radio-dot"></div>
            </div>
            <div class="text-nc-content-gray text-caption">
              {{ $t('labels.syncSpecificTables') }}
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <div class="text-nc-content-gray-muted text-bodySm pl-7">
              {{ $t('labels.syncSpecificTablesDescription') }}
            </div>
          </div>
        </NcTooltip>
      </div>
    </div>

    <div v-if="syncConfigForm.sync_category !== SyncCategory.CUSTOM && !syncAllModels">
      <div class="nc-form-section-input-label">
        {{ $t('labels.selectTablesToSync') }}
      </div>

      <div class="flex flex-col border-1 border-nc-border-gray-medium rounded-lg">
        <NcTooltip v-for="model in availableModels" :key="model.value" :disabled="!model.required">
          <template #title> {{ $t('tooltip.requiredTablesCannotBeExcluded') }} </template>

          <div
            :class="{
              'cursor-pointer': mode === 'create' && !model.required,
              'cursor-not-allowed opacity-80': model.required,
            }"
            class="flex flex-col px-3 gap-1 py-2 border-b-1 last:border-b-0"
            @click="onModelChanged(model)"
          >
            <div class="flex gap-3 items-center">
              <NcCheckbox :readonly="model.required" :checked="!syncConfigForm.exclude_models?.includes(model.value)" />
              <div class="text-caption text-nc-content-gray">
                {{ model.label }}
              </div>
            </div>
            <div class="text-bodyDefaultSm pl-7.7 text-nc-content-gray-muted">
              {{ model.description }}
            </div>
          </div>
        </NcTooltip>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-radio {
  @apply border-1 min-w-4 w-4 h-4 flex items-center justify-center rounded-full border-nc-border-gray-medium flex items-center justify-center;

  &[data-checked='true'] {
    @apply bg-nc-brand-500 border-nc-brand-500;
    .nc-radio-dot {
      @apply block bg-white w-1.5 h-1.5 min-w-1.5 rounded-full;
    }
  }

  &[data-checked='false'] {
    .nc-radio-dot {
      @apply hidden;
    }
  }
}
</style>
