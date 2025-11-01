<script lang="ts" setup>
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'
import type { ViewSettingOverrideOptions, ViewType } from 'nocodb-sdk'
import type { NcButtonProps } from '~/components/nc/Button.vue'

interface Props {
  view: ViewType
  defaultOptions?: ViewSettingOverrideOptions[]
  buttonProps?: NcButtonProps
}

const props = withDefaults(defineProps<Props>(), {
  defaultOptions: () => [],
  buttonProps: () => ({
    size: 'xs',
    type: 'text',
    class: '!font-normal',
  }),
})

const emits = defineEmits<{
  (e: 'open'): void
}>()

const { view } = toRefs(props)

const viewsStore = useViewsStore()

const { getCopyViewConfigBtnAccessStatus, onOpenCopyViewConfigFromAnotherViewModal } = viewsStore

const { getPlanTitle } = useEeConfig()

const copyViewConfigBtnAccessStatus = computed(() => getCopyViewConfigBtnAccessStatus(view.value, 'toolbar'))

const isVisibleCopyBtn = computed(() => view.value && copyViewConfigBtnAccessStatus.value.isVisible)

const paidBadgeVisible = false
</script>

<template>
  <div v-if="isVisibleCopyBtn" class="flex-1 flex items-center justify-end">
    <SmartsheetToolbarNotAllowedTooltip
      :enabled="copyViewConfigBtnAccessStatus.isDisabled"
      placement="right"
      class="flex items-center justify-end"
    >
      <template #title>
        <div class="max-w-70">
          {{ copyViewConfigBtnAccessStatus.tooltip }}
        </div>
      </template>

      <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_COPY_VIEW_SETTING_FROM_OTHER">
        <template #default="{ click }">
          <NcButton
            v-bind="buttonProps"
            :disabled="copyViewConfigBtnAccessStatus.isDisabled"
            @click.stop="
              () => {
                emits('open')

                click(PlanFeatureTypes.FEATURE_COPY_VIEW_SETTING_FROM_OTHER, () => {
                  onOpenCopyViewConfigFromAnotherViewModal({ destView: view, defaultOptions })
                })
              }
            "
          >
            {{ $t('objects.copyViewConfig.copyFromAnotherView') }}
          </NcButton>

          <PaymentUpgradeBadge
            v-show="paidBadgeVisible"
            :feature="PlanFeatureTypes.FEATURE_COPY_VIEW_SETTING_FROM_OTHER"
            :limit-or-feature="'to access copy view configuration from another view feature.' as PlanFeatureTypes"
            :content="
              $t('upgrade.upgradeToAccessCopyViewConfigFromAnotherViewSubtitle', {
                plan: getPlanTitle(PlanTitles.PLUS),
              })
            "
          />
        </template>
      </PaymentUpgradeBadgeProvider>
    </SmartsheetToolbarNotAllowedTooltip>
  </div>
</template>
