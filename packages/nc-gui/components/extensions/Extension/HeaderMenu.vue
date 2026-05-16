<script setup lang="ts">
import { PlanLimitTypes, PlanTitles } from 'nocodb-sdk'

interface Props {
  isFullscreen?: boolean
}

defineProps<Props>()

const emits = defineEmits(['rename', 'duplicate', 'showDetails', 'clearData', 'delete'])

const { activeError, extension } = useExtensionHelperOrThrow()

const { extensionAccess } = useExtensions()

const { showEEFeatures, blockExtensions, blockAddNewExtension, handleUpgradePlan } = useEeConfig()

const { t } = useI18n()

const isDuplicateBlocked = computed(() => blockExtensions.value || blockAddNewExtension.value)

const onDuplicate = () => {
  if (isDuplicateBlocked.value) {
    handleUpgradePlan({
      content: t('upgrade.upgradeToAddMoreExtensions'),
      limitOrFeature: PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE,
      newPlanTitle: PlanTitles.PLUS,
    })
    return
  }
  emits('duplicate')
}
</script>

<template>
  <div class="flex items-center" @click.stop>
    <NcDropdown :trigger="['click']" placement="bottomRight">
      <NcButton type="text" :size="isFullscreen ? 'small' : 'xs'" class="!px-1">
        <GeneralIcon icon="threeDotVertical" />
      </NcButton>

      <template #overlay>
        <NcMenu variant="small">
          <NcMenuItemCopyId
            :id="extension.id!"
            data-testid="nc-extension-item-action-copy-id"
            :tooltip="$t('labels.clickToCopyExtensionID')"
            :label="
              $t('labels.extensionIdColon', {
                extensionId: extension.id,
              })
            "
          />
          <NcDivider v-if="extensionAccess.create || extensionAccess.update || extensionAccess.delete" />
          <template v-if="!activeError">
            <NcMenuItem v-if="extensionAccess.create" data-rec="true" @click="emits('rename')">
              <GeneralIcon icon="edit" />
              Rename
            </NcMenuItem>

            <NcMenuItem
              v-if="extensionAccess.create && showEEFeatures"
              data-rec="true"
              class="group"
              inner-class="w-full"
              @click="onDuplicate"
            >
              <GeneralIcon icon="duplicate" />

              <div class="flex-1">Duplicate</div>

              <LazyPaymentUpgradeBadge
                :plan-title="PlanTitles.PLUS"
                :limit-or-feature="PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE"
                :feature-enabled-callback="() => !isDuplicateBlocked"
                :content="$t('upgrade.upgradeToAddMoreExtensions')"
                remove-click
              />
            </NcMenuItem>

            <NcMenuItem data-rec="true" @click="emits('showDetails')">
              <GeneralIcon icon="info" />
              Details
            </NcMenuItem>

            <NcDivider v-if="extensionAccess.update || extensionAccess.delete" />
          </template>
          <NcMenuItem v-if="extensionAccess.update" data-rec="true" danger @click="emits('clearData')">
            <GeneralIcon icon="reload" />
            Clear data
          </NcMenuItem>
          <NcMenuItem v-if="extensionAccess.delete" data-rec="true" danger @click="emits('delete')">
            <GeneralIcon icon="delete" />
            Delete
          </NcMenuItem>
        </NcMenu>
      </template>
    </NcDropdown>
  </div>
</template>
