<script lang="ts" setup>
// Unified save bar for the Tools shell. Purely driven by the shell injection
// state — each editing tool registers its own dirty/save/reset; this bar just
// reflects and forwards. Shown only while a tool has registered (hasSaveBar).
const shell = useToolsShell()

const isDirty = computed(() => !!shell?.isDirty.value)

const isSaving = computed(() => !!shell?.isSaving.value)

const canSave = computed(() => !!shell?.canSave.value)
</script>

<template>
  <div
    class="flex-none h-15 flex items-center gap-3.5 px-6 border-t-1 border-nc-border-gray-medium bg-nc-bg-default"
    data-testid="nc-tool-save-bar"
  >
    <span
      class="inline-flex items-center gap-2 text-bodyDefaultSm font-semibold"
      :class="isDirty ? 'text-nc-content-orange-dark' : 'text-nc-content-gray-muted'"
    >
      <GeneralIcon :icon="isDirty ? 'ncAlertCircle' : 'ncCheck'" class="!h-4 !w-4" />
      {{ isDirty ? $t('labels.unsavedChanges') : $t('general.allChangesSaved') }}
    </span>

    <div class="ml-auto flex items-center gap-2.5">
      <NcButton
        size="small"
        type="secondary"
        :disabled="!isDirty || isSaving"
        data-testid="nc-tool-save-bar-reset"
        @click="shell?.reset()"
      >
        {{ $t('general.reset') }}
      </NcButton>
      <NcButton
        size="small"
        type="primary"
        :disabled="!isDirty || !canSave"
        :loading="isSaving"
        data-testid="nc-tool-save-bar-save"
        @click="shell?.save()"
      >
        {{ $t('labels.saveChanges') }}
      </NcButton>
    </div>
  </div>
</template>
