<script setup lang="ts">
import { PlanFeatureTypes } from 'nocodb-sdk'

interface Props {
  baseId?: string
}
defineProps<Props>()

const { isEEFeatureBlocked, showUpgradeToUseSync } = useEeConfig()

const { appInfo } = useGlobal()
</script>

<template>
  <ProjectSyncCreateProvider :base-id="baseId">
    <template #default="{ createSyncClick }">
      <div class="relative">
        <ProjectActionItem
          v-e="['c:table:create-sync']"
          data-testid="proj-view-btn__create-sync"
          :label="$t('labels.syncData')"
          :subtext="$t('msg.subText.syncData')"
          @click="
            () => {
              if (!appInfo?.ee) {
                showUpgradeToUseSync()
                return
              }
              createSyncClick()
            }
          "
        >
          <template #icon>
            <GeneralIcon icon="ncZap" class="!h-7 !w-7 !text-nc-content-green-dark" />
          </template>
        </ProjectActionItem>
        <LazyPaymentUpgradeBadge
          :feature="PlanFeatureTypes.FEATURE_SYNC"
          :feature-enabled-callback="() => !isEEFeatureBlocked"
          class="absolute right-2 top-2"
          remove-click
        />
      </div>
    </template>
  </ProjectSyncCreateProvider>
</template>
