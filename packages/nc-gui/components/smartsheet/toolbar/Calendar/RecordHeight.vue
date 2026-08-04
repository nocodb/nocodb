<script setup lang="ts">
import { UITypes, ViewTypes } from 'nocodb-sdk'

const { activeCalendarView, calDataType, recordHeightMode, viewMetaProperties, isDayAnchoredMode, isMultiWeekRange } =
  useCalendarViewStoreOrThrow()

const { updateViewMeta } = useViewsStore()

const { isSharedBase } = storeToRefs(useBase())

const { canUpdateViewMeta } = useViewColumnsOrThrow()

const { $e } = useNuxtApp()

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const { t } = useI18n()

const open = ref(false)

type RecordHeightMode = 'compact' | 'expanded'

// Month / multi-week grids (month, 2week, 6week, custom + week-unit) always render record
// cards (MonthView) regardless of the start field type, so height always applies there.
const monthGridModes = ['2week', 'month', '6week']

// week / 3day / custom + day-unit render record cards (DateField) only for a Date start
// field. With a DateTime field they render the hour time-grid (DateTimeField), which sizes
// events by duration and ignores the height option — so hide the control there.
const supportsHeightOptions = computed(() => {
  if (activeCalendarView.value === 'month' || monthGridModes.includes(activeCalendarView.value) || isMultiWeekRange.value) {
    return true
  }

  if (activeCalendarView.value === 'week' || isDayAnchoredMode.value) {
    return calDataType.value === UITypes.Date
  }

  return false
})

const heightOptions = computed<{ value: RecordHeightMode; icon: keyof typeof iconMap; label: string; subtext: string }[]>(() => [
  { value: 'compact', icon: 'heightShort', label: t('activity.compactView'), subtext: t('activity.compactViewSubtext') },
  { value: 'expanded', icon: 'heightExtra', label: t('activity.expandedView'), subtext: t('activity.expandedViewSubtext') },
])

const setRecordHeightMode = (value: RecordHeightMode) => {
  if (isLocked.value || value === recordHeightMode.value) {
    open.value = false
    return
  }

  $e('c:calendar:record-height', { mode: value })

  // Persisting to the view meta needs editor+ (ACL: calendarViewUpdate). For
  // viewers / public / shared-base, skip the network call so the toggle still
  // applies locally without a 403 — mirrors the grid Record Height control.
  updateViewMeta(
    activeView.value?.id as string,
    ViewTypes.CALENDAR,
    {
      meta: {
        ...(viewMetaProperties.value || {}),
        record_height_mode: value,
      },
    },
    {
      skipNetworkCall: isPublic.value || isSharedBase.value || !canUpdateViewMeta.value,
    },
  )

  open.value = false
}

useMenuCloseOnEsc(open)
</script>

<template>
  <NcDropDrawer
    v-if="supportsHeightOptions"
    v-model:visible="open"
    :trigger="['click']"
    drawer-content-height
    drawer-body-class-name="!px-2 !pb-2"
    overlay-class-name="nc-dropdown-calendar-record-height overflow-hidden"
  >
    <template #default="{ onClick }">
      <NcButton
        class="nc-calendar-record-height-btn nc-toolbar-btn !border-0 !h-7 !px-1.5 !min-w-7"
        size="small"
        type="secondary"
        data-testid="nc-calendar-record-height"
        :show-as-disabled="isLocked"
        @click="onClick"
      >
        <div class="flex items-center gap-0.5">
          <component :is="iconMap.rowHeight" class="!h-3.75 !w-3.75" />
        </div>
      </NcButton>
    </template>
    <template #overlay>
      <div class="p-1.5 min-w-[224px]" data-testid="nc-calendar-record-height-menu">
        <div class="flex flex-col w-full text-sm" @click.stop>
          <div
            v-for="opt in heightOptions"
            :key="opt.value"
            class="nc-calendar-record-height-option"
            :class="{
              'hover:bg-nc-bg-gray-light cursor-pointer': !isLocked,
              'cursor-not-allowed': isLocked,
            }"
            :data-testid="`nc-calendar-record-height-${opt.value}`"
            @click="setRecordHeightMode(opt.value)"
          >
            <div class="flex items-center gap-2.5">
              <GeneralIcon :icon="opt.icon" class="nc-calendar-record-height-icon flex-none" />
              <div class="flex flex-col gap-0.5">
                <div class="text-bodyDefaultSm text-nc-content-gray">{{ opt.label }}</div>
                <div class="text-bodySm text-nc-content-gray-muted">{{ opt.subtext }}</div>
              </div>
            </div>
            <GeneralIcon v-if="recordHeightMode === opt.value" icon="check" class="flex-none text-nc-content-brand w-4 h-4" />
          </div>
        </div>
      </div>
    </template>
  </NcDropDrawer>
</template>

<style scoped>
.nc-calendar-record-height-option {
  @apply flex items-center gap-2 p-2 justify-between rounded-md;
}

.nc-calendar-record-height-icon {
  @apply text-base text-nc-content-gray-subtle2;
}
</style>
