<script setup lang="ts">
import { PlanFeatureTypes } from 'nocodb-sdk'

interface Props {
  isFullscreen?: boolean
}

defineProps<Props>()

const emits = defineEmits(['rename', 'duplicate', 'showDetails', 'clearData', 'delete'])

const { activeError, extension } = useExtensionHelperOrThrow()

const { extensionAccess } = useExtensions()
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
          <template v-if="!activeError">
            <NcMenuItem v-if="extensionAccess.create" data-rec="true" @click="emits('rename')">
              <GeneralIcon icon="edit" />
              Rename
            </NcMenuItem>

            <PaymentUpgradeBadgeProvider v-if="extensionAccess.create" :feature="PlanFeatureTypes.FEATURE_EXTENSIONS">
              <template #default="{ click }">
                <NcMenuItem
                  data-rec="true"
                  class="group"
                  @click="click(PlanFeatureTypes.FEATURE_EXTENSIONS, () => emits('duplicate'))"
                >
                  <GeneralIcon icon="duplicate" />
                  Duplicate
                  <LazyPaymentUpgradeBadge
                    :feature="PlanFeatureTypes.FEATURE_EXTENSIONS"
                    :content="$t('upgrade.upgradeToAddMoreExtensions')"
                  />
                </NcMenuItem>
              </template>
            </PaymentUpgradeBadgeProvider>

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
