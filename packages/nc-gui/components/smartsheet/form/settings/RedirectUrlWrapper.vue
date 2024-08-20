<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between gap-3">
      <!-- Redirect to URL -->
      <span>{{ $t('labels.redirectToUrl') }}</span>
      <NcTooltip>
        <template #title>
          <div class="text-center">
            {{ $t('msg.info.thisFeatureIsOnlyAvailableInEnterpriseEdition') }}
          </div>
        </template>
        <a-switch
          size="small"
          class="nc-form-checkbox-redirect-url"
          data-testid="nc-form-checkbox-redirect-url"
          :disabled="true"
        />
      </NcTooltip>
    </div>
  </div>
  <slot />
</template>