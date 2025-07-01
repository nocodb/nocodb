<script setup lang="ts">
const { t } = useI18n()

const { blockPrivateBases, showUpgradeToUsePrivateBases } = useEeConfig()
</script>

<template>
  <div data-testid="nc-settings-subtab-visibility" class="item-card flex flex-col w-full">
    <div class="flex items-center justify-between">
      <div class="text-nc-content-gray-emphasis font-semibold text-lg">
        {{ $t('general.baseAccess') }}
      </div>
      <div>
        <!-- Todo: @rameshmane7218 update link  -->
        <a
          href="https://nocodb.com/docs/product-docs/bases/base-access"
          target="_blank"
          rel="noopener noreferrer"
          class="!text-gray-700 text-sm !no-underline !hover:underline"
        >
          {{ $t('title.docs') }}
        </a>
      </div>
    </div>

    <div class="text-nc-content-gray-subtle2 mt-2 leading-5">
      {{ $t('title.baseAccessTabSubtext') }}
    </div>
  </div>
</template>
