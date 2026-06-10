<script setup lang="ts">
import {
  CURRENT_USER_TOKEN,
  type ColumnType,
  type FilterType,
  UITypes,
  comparisonOpList,
  comparisonSubOpList,
  isDateMonthFormat,
} from 'nocodb-sdk'
import dayjs from 'dayjs'

/**
 * PinnedFilters — renders interactive filter pills in the toolbar.
 *
 * Each pinned filter appears as a compact pill showing the selected value(s).
 * Clicking a pill opens a dropdown panel for searching and selecting values.
 *
 * Supported field types: SingleSelect, MultiSelect, User, CreatedBy, LastModifiedBy,
 * Date, DateTime, CreatedTime, LastModifiedTime.
 *
 * Key behaviours:
 *  - Negated operators (e.g. "is not", "not any of") show a diagonal line through chips.
 *  - Multi-value operators show up to MAX_VISIBLE_CHIPS chips with a "+N" overflow badge.
 *  - User-type dropdowns include a special "@me" option (CURRENT_USER_TOKEN) that the
 *    backend resolves to the currently signed-in user at query time.
 *  - If a filter's parent group is disabled, the pill is dimmed and toggling is prevented.
 */

const { allFilters, $api } = useSmartsheetStoreOrThrow()

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const reloadDataHook = inject(ReloadViewDataHookInj)!

const reloadAggregate = inject(ReloadAggregateHookInj)

/** When the view is locked, all mutation actions (select, clear, toggle, unpin) are disabled */
const isLocked = inject(IsLockedInj, ref(false))

const { base } = storeToRefs(useBase())

/** All users belonging to the current base — used for User/CreatedBy/LastModifiedBy filters */
const { basesUser } = storeToRefs(useBases())

/** Current signed-in user — needed for the "@me" shortcut option */
const { user: currentUser } = useGlobal()

const { $e } = useNuxtApp()

const { t } = useI18n()

const { getColor, isDark } = useTheme()

const openFilterId = ref<string | null>(null)
const searchQuery = ref('')

/** Page date for the inline NcDatePicker — tracks which month is currently displayed */
const datePickerPageDate = ref<dayjs.Dayjs>(dayjs())

const columns = computed(() => meta.value?.columns || [])

/** Filters that have `meta.pinned === true` — these are rendered as toolbar pills */
const pinnedFilters = computed(() => {
  return allFilters.value.filter((f) => f.id && !f.is_group && parseProp(f.meta)?.pinned === true)
})

/** Resolve the column definition for a given filter */
const getColumn = (filter: FilterType): ColumnType | undefined => {
  return columns.value.find((col: ColumnType) => col.id === filter.fk_column_id)
}

/** Check if the filter's column is a SingleSelect or MultiSelect */
const isSelectType = (filter: FilterType) => {
  const col = getColumn(filter)
  if (!col) return false
  return [UITypes.SingleSelect, UITypes.MultiSelect].includes(col.uidt as UITypes)
}

/** Check if the filter's column is a User, CreatedBy, or LastModifiedBy type */
const isUserType = (filter: FilterType) => {
  const col = getColumn(filter)
  if (!col) return false
  return [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(col.uidt as UITypes)
}

/** Check if the filter's column is a Date, DateTime, CreatedTime, or LastModifiedTime type */
const isDateType = (filter: FilterType) => {
  const col = getColumn(filter)
  if (!col) return false
  return [UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(col.uidt as UITypes)
}

/** Numeric date sub-ops (value = number of days) — used for both display and editor selection */
const NUMERIC_DATE_SUB_OPS = ['daysAgo', 'daysFromNow', 'pastNumberOfDays', 'nextNumberOfDays']

/** Sub-op options available for the current date filter, filtered by column type compatibility */
const getDateSubOpList = (filter: FilterType) => {
  const col = getColumn(filter)
  if (!col || !filter.comparison_op) return []
  if (['blank', 'notblank'].includes(filter.comparison_op)) return []
  return comparisonSubOpList(filter.comparison_op, parseProp(col?.meta)?.date_format).filter((subOp) =>
    subOp.includedTypes?.includes(col.uidt as UITypes),
  )
}

/** Human-readable label for the filter's current date sub-op (e.g. "today", "exact date") */
const getDateSubOpLabel = (filter: FilterType) => {
  if (!filter.comparison_sub_op) return ''
  const subOps = getDateSubOpList(filter)
  return subOps.find((o) => o.value === filter.comparison_sub_op)?.text || filter.comparison_sub_op
}

/** Whether the currently selected date sub-op needs no value (e.g. today, yesterday, past week) */
const isCurrentDateSubOpValueless = (filter: FilterType) => {
  if (!filter.comparison_sub_op) return true
  const subOp = getDateSubOpList(filter).find((o) => o.value === filter.comparison_sub_op)
  return subOp?.ignoreVal === true
}

/**
 * Pill text for a date filter.
 *  - blank/notblank → op label ("is empty")
 *  - valueless sub-op → sub-op text ("today")
 *  - numeric sub-op → "{N} {sub-op}" ("5 number of days ago")
 *  - exactDate → value formatted with the column's date_format
 */
const getDateDisplayValue = (filter: FilterType): string => {
  if (['blank', 'notblank'].includes(filter.comparison_op || '')) return ''
  if (isCurrentDateSubOpValueless(filter)) return getDateSubOpLabel(filter)
  if (filter.value === null || filter.value === undefined || filter.value === '') return getDateSubOpLabel(filter)

  if (NUMERIC_DATE_SUB_OPS.includes(filter.comparison_sub_op || '')) {
    return `${filter.value} ${getDateSubOpLabel(filter)}`
  }

  if (filter.comparison_sub_op === 'exactDate') {
    const col = getColumn(filter)
    const dateFormat = parseProp(col?.meta)?.date_format || 'YYYY-MM-DD'
    const dt = dayjs(filter.value as string)
    return dt.isValid() ? dt.format(dateFormat) : String(filter.value)
  }

  return String(filter.value)
}

/** Multi-value operators allow selecting multiple values (comma-separated) */
const isMultiValueOp = (filter: FilterType) => {
  return ['anyof', 'nanyof'].includes(filter.comparison_op || '')
}

/**
 * Negated operators — these get a diagonal strike-through line on their chips
 * to visually distinguish them from their positive counterparts.
 */
const isNegatedOp = (filter: FilterType) => {
  return ['neq', 'not', 'isnot', 'nlike', 'nanyof', 'nallof', 'isnotnull', 'isnotblank', 'not_checked'].includes(
    filter.comparison_op || '',
  )
}

/**
 * Recursively checks whether any ancestor filter group is disabled.
 * A pinned filter inside a disabled group should itself appear disabled.
 */
const isParentGroupDisabled = (filter: FilterType): boolean => {
  if (!filter.fk_parent_id) return false
  const parent = allFilters.value.find((f) => f.id === filter.fk_parent_id && f.is_group)
  if (!parent) return false
  if (parent.enabled === false || parent.enabled === 0) return true
  return isParentGroupDisabled(parent)
}

/** True only when the filter itself is enabled AND no ancestor group is disabled */
const isEffectivelyEnabled = (filter: FilterType): boolean => {
  if (filter.enabled === false || filter.enabled === 0) return false
  return !isParentGroupDisabled(filter)
}

/** Retrieve the column's select options with computed colours for display */
const getSelectOptions = (filter: FilterType) => {
  const col = getColumn(filter)
  if (!col?.colOptions) return []
  return ((col.colOptions as any)?.options || [])
    .filter((el: any) => el.title !== '')
    .map((o: any) => ({
      ...o,
      value: o.title,
      bgColor: getSelectTypeFieldOptionBgColor({
        color: o.color,
        isDark: isDark.value,
        getColor,
        isColorCodeEnabled: parseProp(col?.meta)?.isColorCodeEnabled !== false,
      }),
      textColor: getSelectTypeFieldOptionTextColor({
        color: o.color,
        isDark: isDark.value,
        getColor,
        isColorCodeEnabled: parseProp(col?.meta)?.isColorCodeEnabled !== false,
      }),
    }))
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
}

const baseUsers = computed(() => {
  const baseId = (meta.value as any)?.base_id
  if (!baseId) return []
  return basesUser.value?.get(baseId) || []
})

const userOptions = computed(() => {
  return baseUsers.value.map((user: any) => ({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    deleted: user.deleted,
  }))
})

/** Human-readable label for the filter's comparison operator (e.g. "contains any of") */
const getComparisonOpLabel = (filter: FilterType) => {
  const col = getColumn(filter)
  if (!col) return filter.comparison_op || ''
  const op = comparisonOpList(col.uidt as UITypes, col?.meta?.date_format).find((o) => o.value === filter.comparison_op)
  return op?.text || filter.comparison_op || ''
}

/**
 * Check if the filter's operator doesn't require a value.
 * Uses the ignoreVal property from operator definitions (e.g., blank, notblank, empty, checked).
 * Follows the same pattern as FilterRow.vue line 144.
 */
const isValuelessOp = (filter: FilterType) => {
  const col = getColumn(filter)
  if (!col || !filter.comparison_op) return false
  const op = comparisonOpList(col.uidt as UITypes, col?.meta?.date_format).find((o) => o.value === filter.comparison_op)
  return op?.ignoreVal === true
}

/**
 * Synthetic user object for CURRENT_USER_TOKEN ('@me').
 * Used both in pill display and dropdown — avoids duplicating the literal everywhere.
 * The backend resolves this token to the actual signed-in user at query time.
 */
const ME_USER_OBJECT = {
  id: CURRENT_USER_TOKEN,
  email: CURRENT_USER_TOKEN,
  display_name: '@me',
} as const

/** The real user record for the current user — used for avatar rendering in the "@me" row */
const currentUserForAvatar = computed(() => {
  if (!currentUser.value) return null
  return userOptions.value.find((u: any) => u.email === currentUser.value?.email) || null
})

/** Whether to show the "@me" option (visible when no search, or search matches "@me"/"me") */
const showMeOption = computed(() => {
  if (!currentUser.value) return false
  if (!searchQuery.value) return true
  const q = searchQuery.value.toLowerCase()
  return '@me'.includes(q) || 'me'.includes(q)
})

/** Check if CURRENT_USER_TOKEN is one of the selected values in this filter */
const isMeSelected = (filter: FilterType) => {
  if (!filter.value) return false
  const values = String(filter.value).split(',')
  return values.includes(CURRENT_USER_TOKEN)
}

const closeDropdown = () => {
  openFilterId.value = null
  searchQuery.value = ''
}

const apiBaseId = computed(() => activeView.value?.base_id || (meta.value as any)?.base_id)

const apiWorkspaceId = computed(() => activeView.value?.fk_workspace_id || base.value?.fk_workspace_id)

/** Debounced save — persists filter changes to the server and triggers data reload */
const saveFilter = useDebounceFn(async (filter: FilterType) => {
  if (!filter.id || !apiWorkspaceId.value || !apiBaseId.value) return

  try {
    await $api.internal.postOperation(
      apiWorkspaceId.value,
      apiBaseId.value,
      { operation: 'filterUpdate', filterId: filter.id },
      stripFilterApiBody({ ...filter }),
    )
    reloadDataHook.trigger({ shouldShowLoading: false, offset: 0 })
    reloadAggregate?.trigger({ path: [] })
  } catch (e) {
    console.error('Failed to save pinned filter:', e)
  }
}, 500)

/** `'month'` if the column's date_format is month-only (e.g. `YYYY-MM`), otherwise `'date'` */
const getDatePickerType = (filter: FilterType): 'date' | 'month' => {
  const dateFormat = parseProp(getColumn(filter)?.meta)?.date_format || ''
  return isDateMonthFormat(dateFormat) ? 'month' : 'date'
}

/** Classify a sub-op by the shape of value it expects */
const getDateSubOpValueShape = (subOp: string | null | undefined): 'numeric' | 'exactDate' | 'none' => {
  if (!subOp) return 'none'
  if (NUMERIC_DATE_SUB_OPS.includes(subOp)) return 'numeric'
  if (subOp === 'exactDate') return 'exactDate'
  return 'none'
}

/**
 * Switch the date sub-op (from the NcSelect dropdown). Preserve `value` when
 * the new sub-op uses the same shape as the old one — switching between two
 * numeric sub-ops (e.g. `pastNumberOfDays` ↔ `nextNumberOfDays`) shouldn't
 * make the user re-enter the number. Clear when the shape changes
 * (numeric ↔ exactDate ↔ valueless).
 */
const selectDateSubOp = async (filter: FilterType, subOpValue: string) => {
  if (isLocked.value) return
  if (!subOpValue) return
  $e('a:filter-pinned:select-date-sub-op')
  const oldShape = getDateSubOpValueShape(filter.comparison_sub_op)
  const newShape = getDateSubOpValueShape(subOpValue)
  filter.comparison_sub_op = subOpValue
  if (oldShape !== newShape) filter.value = null
  // Reset the calendar's page-date when entering exactDate so we don't
  // surface a stale date carried over from a previous sub-op (the picker
  // would otherwise show the month derived from a number-of-days value).
  if (newShape === 'exactDate' && oldShape !== 'exactDate') {
    datePickerPageDate.value = dayjs()
  }
  await saveFilter(filter)
}

/** Update the date filter value (date string for exactDate, number for numeric sub-ops) */
const updateDateValue = async (filter: FilterType, value: any) => {
  if (isLocked.value) return
  $e('a:filter-pinned:update-date-value')
  filter.value = value === '' || value === undefined ? null : value
  await saveFilter(filter)
}

/**
 * Handle a date pick from the inline calendar (exactDate sub-op).
 *
 * NcDatePicker doesn't re-emit `update:pageDate` after the user picks a date —
 * it mutates its internal `localPageDate` ref directly. As a result, the
 * parent's `datePickerPageDate` ref stays stale, and on the next render the
 * picker highlights the cell matching the old page-date rather than the
 * newly stored `filter.value`. The Date cell editor works around this the
 * same way, by manually keeping the page-date in sync with the picked date.
 */
const onExactDatePick = async (filter: FilterType, picked: dayjs.Dayjs | null | undefined) => {
  if (picked) datePickerPageDate.value = dayjs(picked)
  await updateDateValue(filter, picked ? dayjs(picked).format('YYYY-MM-DD') : null)
}

/**
 * Block non-digit keys on the numeric date input. Lets navigation/control
 * keys (Backspace, Tab, arrows, etc.) and modifier combos (Ctrl/Cmd+C/V/A)
 * through. Pasted non-digits are stripped by the input's `parser`.
 */
const onNumericKeydown = (e: KeyboardEvent) => {
  if (e.key.length > 1) return
  if (e.ctrlKey || e.metaKey) return
  if (e.key < '0' || e.key > '9') e.preventDefault()
}

/**
 * Toggle the "@me" token in the filter value.
 * For multi-value ops: adds/removes '@me' from the comma-separated list.
 * For single-value ops: sets the value to '@me' and closes the dropdown.
 */
const selectMe = async (filter: FilterType) => {
  if (isLocked.value) return
  $e('a:filter-pinned:select-me')
  if (isMultiValueOp(filter)) {
    const values = filter.value ? String(filter.value).split(',').filter(Boolean) : []
    const idx = values.indexOf(CURRENT_USER_TOKEN)
    if (idx >= 0) values.splice(idx, 1)
    else values.push(CURRENT_USER_TOKEN)
    filter.value = values.join(',') || null
  } else {
    filter.value = CURRENT_USER_TOKEN
    closeDropdown()
  }
  await saveFilter(filter)
}

/**
 * User display name for pill chips.
 * Prefers display_name; falls back to the part before '@' in the email.
 */
const getUserDisplayName = (user: any) => {
  if (user?.display_name) return user.display_name
  if (user?.email) return user.email.split('@')[0]
  return ''
}

/**
 * For the pill trigger, show only the first selected value and a "+N" overflow count.
 * This keeps the toolbar compact regardless of how many values are selected.
 */

/** First selected option title for select-type filters */
const getPrimarySelectDisplay = (filter: FilterType): string | null => {
  if (!filter.value) return null
  const values = String(filter.value).split(',').filter(Boolean)
  return values.length > 0 ? values[0] : null
}

/** Full option object for the first selected value (for colour rendering) */
const getPrimarySelectOption = (filter: FilterType) => {
  const title = getPrimarySelectDisplay(filter)
  if (!title) return null
  return getSelectOptions(filter).find((o: any) => o.title === title) || null
}

/** Number of additional selected values beyond the first (for "+N" suffix) */
const getSelectOverflowCount = (filter: FilterType): number => {
  if (!filter.value) return 0
  const values = String(filter.value).split(',').filter(Boolean)
  return values.length > 1 ? values.length - 1 : 0
}

/** Display name for the first selected user */
const getPrimaryUserDisplay = (filter: FilterType): string | null => {
  if (!filter.value) return null
  const values = String(filter.value).split(',').filter(Boolean)
  if (values.length === 0) return null
  if (values[0] === CURRENT_USER_TOKEN) return '@me'
  const user = userOptions.value.find((u: any) => u.id === values[0] || u.email === values[0])
  return getUserDisplayName(user) || values[0]
}

/** User object for the first selected user (for avatar rendering) */
const getPrimaryUser = (filter: FilterType) => {
  if (!filter.value) return null
  const values = String(filter.value).split(',').filter(Boolean)
  if (values.length === 0) return null
  if (values[0] === CURRENT_USER_TOKEN) return { ...ME_USER_OBJECT }
  return userOptions.value.find((u: any) => u.id === values[0] || u.email === values[0]) || null
}

/** Number of additional selected users beyond the first */
const getUserOverflowCount = (filter: FilterType): number => {
  if (!filter.value) return 0
  const values = String(filter.value).split(',').filter(Boolean)
  return values.length > 1 ? values.length - 1 : 0
}

const toggleDropdown = (filterId: string) => {
  if (openFilterId.value === filterId) {
    openFilterId.value = null
  } else {
    openFilterId.value = filterId
    // Seed the date picker page so the calendar opens on the relevant month.
    // Only parse `filter.value` as a date when the sub-op is `exactDate` —
    // for numeric sub-ops the value is a number-of-days (e.g. `5`), and
    // `dayjs(5)` would interpret that as a Unix-epoch millisecond timestamp
    // and surface January 1970 when the user later switches to `exactDate`.
    const filter = pinnedFilters.value.find((f) => f.id === filterId)
    if (filter && isDateType(filter)) {
      const isExactDate = filter.comparison_sub_op === 'exactDate'
      const seed = isExactDate && filter.value ? dayjs(filter.value as string) : null
      datePickerPageDate.value = seed && seed.isValid() ? seed : dayjs()
    }
  }
  searchQuery.value = ''
}

/** Select options filtered by the dropdown search query */
const getFilteredSelectOptions = (filter: FilterType) => {
  const options = getSelectOptions(filter)
  if (!searchQuery.value) return options
  return options.filter((o: any) => o.title?.toLowerCase().includes(searchQuery.value.toLowerCase()))
}

/** User options filtered by the dropdown search query (matches display_name or email) */
const filteredUserOptions = computed(() => {
  if (!searchQuery.value) return userOptions.value
  const q = searchQuery.value.toLowerCase()
  return userOptions.value.filter((u: any) => u.display_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
})

const isSelectOptionSelected = (filter: FilterType, option: any) => {
  if (!filter.value) return false
  const values = String(filter.value).split(',')
  return values.includes(option.title)
}

const isUserOptionSelected = (filter: FilterType, user: any) => {
  if (!filter.value) return false
  const values = String(filter.value).split(',')
  return values.includes(user.id) || values.includes(user.email)
}

/**
 * Toggle a select option in the filter value.
 * Multi-value ops: adds/removes from comma-separated list.
 * Single-value ops: sets the value and closes the dropdown.
 */
const selectOption = async (filter: FilterType, option: any) => {
  if (isLocked.value) return
  $e('a:filter-pinned:select-option')
  if (isMultiValueOp(filter)) {
    const values = filter.value ? String(filter.value).split(',').filter(Boolean) : []
    const idx = values.indexOf(option.title)
    if (idx >= 0) values.splice(idx, 1)
    else values.push(option.title)
    filter.value = values.join(',') || null
  } else {
    filter.value = option.title
    closeDropdown()
  }
  await saveFilter(filter)
}

/** Toggle a user in the filter value (by user ID) */
const selectUser = async (filter: FilterType, user: any) => {
  if (isLocked.value) return
  $e('a:filter-pinned:select-user')
  if (isMultiValueOp(filter)) {
    const values = filter.value ? String(filter.value).split(',').filter(Boolean) : []
    const idx = values.indexOf(user.id)
    if (idx >= 0) values.splice(idx, 1)
    else values.push(user.id)
    filter.value = values.join(',') || null
  } else {
    filter.value = user.id
    closeDropdown()
  }
  await saveFilter(filter)
}

/** Check if all options are currently selected (for showing "Select all" vs "Clear all" state) */
const isAllSelected = (filter: FilterType) => {
  if (!filter.value) return false
  const values = String(filter.value).split(',').filter(Boolean)
  if (isSelectType(filter)) {
    return values.length >= getSelectOptions(filter).length
  } else if (isUserType(filter)) {
    return values.length >= userOptions.value.length
  }
  return false
}

/** Select all options (for multi-value select-type filters) */
const selectAllOptions = async (filter: FilterType) => {
  if (isLocked.value) return
  $e('a:filter-pinned:select-all')
  if (isSelectType(filter)) {
    const allTitles = getSelectOptions(filter).map((o: any) => o.title)
    filter.value = allTitles.join(',') || null
  } else if (isUserType(filter)) {
    const allIds = userOptions.value.map((u: any) => u.id)
    filter.value = allIds.join(',') || null
  }
  await saveFilter(filter)
}

/** Clear all selected values from the filter */
const clearValue = async (filter: FilterType) => {
  if (isLocked.value) return
  $e('a:filter-pinned:clear-value')
  filter.value = null
  await saveFilter(filter)
}

/** Toggle the filter's own enabled/disabled state */
const toggleEnabled = async (filter: FilterType) => {
  if (isLocked.value) return
  const newState = filter.enabled === false || filter.enabled === 0
  $e('a:filter-pinned:toggle-enabled', { enabled: newState })
  filter.enabled = !!newState
  await saveFilter(filter)
}

/** Unpin this filter from the toolbar (sets meta.pinned = false) */
const unpinFilter = async (filter: FilterType) => {
  if (isLocked.value) return
  $e('a:filter-pinned:unpin')
  const filterMeta = parseProp(filter.meta) || {}
  filterMeta.pinned = false
  filter.meta = filterMeta
  await saveFilter(filter)
  closeDropdown()
}
</script>

<template>
  <div v-if="pinnedFilters.length" class="nc-pinned-filters flex items-center gap-1.5 overflow-hidden flex-nowrap">
    <!-- Leading vertical separator (between toolbar buttons and pinned filters) -->
    <div class="h-5 w-px bg-nc-border-gray-medium mx-0.5 flex-none" />

    <template v-for="(filter, idx) in pinnedFilters" :key="filter.id">
      <!-- Divider between consecutive pinned filter pills -->
      <div v-if="idx > 0" class="h-5 w-px bg-nc-border-gray-medium flex-none" />

      <!--
        NcTooltip wraps NcDropdown (not the other way around) because a-dropdown
        clones its first slot child to attach click handlers — NcTooltip doesn't
        forward those, so it must be the outer wrapper.
      -->
      <NcTooltip :disabled="openFilterId === filter.id" placement="bottom">
        <template #title> {{ getColumn(filter)?.title }} {{ getComparisonOpLabel(filter) }} </template>

        <NcDropdown
          :visible="openFilterId === filter.id"
          placement="bottomLeft"
          overlay-class-name="nc-pinned-filter-dropdown-overlay"
          @update:visible="
            (val) => {
              if (!val) closeDropdown()
            }
          "
        >
          <!-- ====== PILL TRIGGER ====== -->
          <div
            class="nc-pinned-filter-pill nc-toolbar-btn flex items-center !h-7 rounded-lg select-none overflow-hidden"
            :class="{
              'opacity-60': !isEffectivelyEnabled(filter),
              'cursor-not-allowed opacity-70': isLocked,
              'cursor-pointer': !isLocked && !isValuelessOp(filter),
              'bg-nc-bg-gray-extralight !text-nc-content-gray': openFilterId === filter.id,
            }"
            @click="!isLocked && !isValuelessOp(filter) && toggleDropdown(filter.id)"
          >
            <!-- Pin icon + field name (unified label block) -->
            <div class="flex items-center gap-1 px-1.5 h-full flex-none">
              <GeneralIcon icon="ncPin" class="h-3 w-3 text-nc-content-gray-subtle2 flex-none" />
              <span class="text-[11px] font-semibold text-nc-content-gray-subtle2 whitespace-nowrap">
                {{ getColumn(filter)?.title }}
              </span>
            </div>

            <!-- Value section -->
            <div class="flex items-center gap-1 pl-0.5 pr-1.5">
              <!-- ── Select type: single value pill + N ── -->
              <template v-if="isSelectType(filter) && getPrimarySelectDisplay(filter)">
                <a-tag
                  v-if="getPrimarySelectOption(filter)"
                  class="nc-pinned-select-tag max-w-28"
                  :class="{ 'nc-negated-tag': isNegatedOp(filter) }"
                  :color="getPrimarySelectOption(filter).bgColor"
                >
                  <span :style="{ color: getPrimarySelectOption(filter).textColor }" class="text-[11px] leading-tight truncate">
                    {{ getPrimarySelectDisplay(filter) }}
                  </span>
                </a-tag>
                <span v-else class="text-xs font-medium text-nc-content-gray truncate max-w-24">
                  {{ getPrimarySelectDisplay(filter) }}
                </span>
                <span
                  v-if="getSelectOverflowCount(filter)"
                  class="text-[11px] text-nc-content-gray-subtle2 font-medium whitespace-nowrap flex-none"
                >
                  +{{ getSelectOverflowCount(filter) }}
                </span>
              </template>

              <!-- ── User type: single value pill + N ── -->
              <template v-else-if="isUserType(filter) && getPrimaryUserDisplay(filter)">
                <a-tag
                  v-if="getPrimaryUser(filter)"
                  class="nc-pinned-user-tag max-w-32"
                  :class="{ 'nc-negated-tag': isNegatedOp(filter) }"
                  :color="getColor('var(--nc-bg-gray-medium)', 'var(--nc-bg-gray-light)')"
                >
                  <span class="flex items-center gap-0.5">
                    <GeneralUserIcon :user="getPrimaryUser(filter)" size="small" class="!text-[0.45rem]" />
                    <span class="text-[11px] text-nc-content-gray truncate leading-tight">
                      {{ getPrimaryUserDisplay(filter) }}
                    </span>
                  </span>
                </a-tag>
                <span v-else class="text-xs font-medium text-nc-content-gray truncate max-w-24">
                  {{ getPrimaryUserDisplay(filter) }}
                </span>
                <span
                  v-if="getUserOverflowCount(filter)"
                  class="text-[11px] text-nc-content-gray-subtle2 font-medium whitespace-nowrap flex-none"
                >
                  +{{ getUserOverflowCount(filter) }}
                </span>
              </template>

              <!-- ── Date type: sub-op label, or "{N} {sub-op}", or formatted date ── -->
              <template v-else-if="isDateType(filter) && !['blank', 'notblank'].includes(filter.comparison_op as string)">
                <span
                  class="text-xs font-medium text-nc-content-gray truncate max-w-40"
                  :class="{ 'line-through decoration-nc-content-gray-subtle2': isNegatedOp(filter) }"
                >
                  {{ getDateDisplayValue(filter) || t('general.none') }}
                </span>
              </template>

              <template v-else-if="['blank', 'notblank'].includes(filter.comparison_op as string)">
                {{ getComparisonOpLabel(filter) }}
              </template>
              <!-- ── Fallback: show "no value" when nothing is selected ── -->
              <span v-else class="text-xs text-nc-content-gray-subtle whitespace-nowrap italic">
                {{ t('general.none') }}
              </span>

              <!-- Chevron indicator -->
              <GeneralIcon
                v-if="!isValuelessOp(filter)"
                :icon="openFilterId === filter.id ? 'arrowUp' : 'arrowDown'"
                class="h-3.5 w-3.5 text-nc-content-gray-subtle2 flex-none"
              />
            </div>
          </div>

          <!-- ====== DROPDOWN PANEL ====== -->
          <template #overlay>
            <div
              class="nc-pinned-filter-panel bg-nc-bg-default rounded-lg w-72 overflow-hidden border-1 border-nc-border-gray-medium"
              @click.stop
            >
              <!-- Header: field name · operator | enable/disable | unpin -->
              <div class="flex items-center gap-1.5 px-3 py-2 border-b border-nc-border-gray-medium min-w-0">
                <NcTooltip show-on-truncate-only class="truncate" placement="bottom">
                  <template #title>{{ getColumn(filter)?.title }}</template>
                  <span class="text-xs font-semibold text-nc-content-gray-subtle uppercase tracking-wide truncate">
                    {{ getColumn(filter)?.title }}
                  </span>
                </NcTooltip>
                <span class="text-xs text-nc-content-gray-muted flex-none">·</span>
                <NcTooltip show-on-truncate-only class="truncate" placement="bottom">
                  <template #title>{{ getComparisonOpLabel(filter) }}</template>
                  <span class="text-xs text-nc-content-gray-muted truncate">
                    {{ getComparisonOpLabel(filter) }}
                  </span>
                </NcTooltip>
                <div class="flex-1" />

                <!-- Enable/Disable toggle — disabled when parent filter group is disabled -->
                <NcTooltip>
                  <template #title>
                    {{
                      isParentGroupDisabled(filter)
                        ? t('labels.parentGroupDisabled')
                        : filter.enabled === false || filter.enabled === 0
                        ? t('general.enable')
                        : t('general.disable')
                    }}
                  </template>
                  <NcButton
                    type="text"
                    size="xxsmall"
                    class="!w-6 !h-6"
                    :disabled="isParentGroupDisabled(filter)"
                    @click.stop="toggleEnabled(filter)"
                  >
                    <GeneralIcon
                      icon="ncPower"
                      class="h-3.5 w-3.5"
                      :class="!isEffectivelyEnabled(filter) ? 'text-nc-content-gray-muted' : 'text-nc-content-gray-subtle2'"
                    />
                  </NcButton>
                </NcTooltip>

                <!-- Unpin button -->
                <NcButton type="text" size="xxsmall" class="!w-6 !h-6" @click.stop="unpinFilter(filter)">
                  <GeneralIcon icon="close" class="h-3.5 w-3.5 text-nc-content-gray-subtle2" />
                </NcButton>
              </div>

              <!-- Search input for filtering options — hidden for date filters (limited sub-op list) -->
              <div v-if="!isDateType(filter)" class="px-2 py-2">
                <a-input
                  v-model:value="searchQuery"
                  :placeholder="`${t('general.search')} ${getColumn(filter)?.title?.toLowerCase()}...`"
                  size="small"
                  class="!rounded-lg !h-8"
                  allow-clear
                  @click.stop
                >
                  <template #prefix>
                    <GeneralIcon icon="search" class="h-3.5 w-3.5 text-nc-content-gray-muted" />
                  </template>
                </a-input>
              </div>

              <!-- Options list for Select types (SingleSelect / MultiSelect) -->
              <div v-if="isSelectType(filter)" class="max-h-48 overflow-y-auto nc-scrollbar-thin">
                <div
                  v-for="option in getFilteredSelectOptions(filter)"
                  :key="option.id || option.title"
                  class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-nc-bg-gray-light transition-colors"
                  :class="{ 'bg-nc-bg-gray-light': isSelectOptionSelected(filter, option) }"
                  @click.stop="selectOption(filter, option)"
                >
                  <a-tag class="rounded-tag max-w-full" :color="option.bgColor">
                    <span :style="{ color: option.textColor }" class="text-small">
                      <span
                        class="text-ellipsis overflow-hidden"
                        style="word-break: keep-all; white-space: nowrap; display: inline"
                      >
                        {{ option.title }}
                      </span>
                    </span>
                  </a-tag>
                  <div class="flex-1" />
                  <GeneralIcon
                    v-if="isSelectOptionSelected(filter, option)"
                    icon="check"
                    class="h-4 w-4 text-primary flex-none"
                  />
                </div>
                <div
                  v-if="!getFilteredSelectOptions(filter).length"
                  class="px-3 py-3 text-xs text-nc-content-gray-muted text-center"
                >
                  {{ $t('title.noOptionsFound') }}
                </div>
              </div>

              <!-- Options list for User types (User / CreatedBy / LastModifiedBy) -->
              <div v-else-if="isUserType(filter)" class="max-h-48 overflow-y-auto nc-scrollbar-thin">
                <!--
                  @me option — uses CURRENT_USER_TOKEN ('$me') as the stored value.
                  This is a distinct value from the user's actual ID, so selecting @me
                  does NOT highlight the same user in the list below (and vice versa).
                  The backend resolves the token to the actual user at query time.
                -->
                <div
                  v-if="showMeOption"
                  class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-nc-bg-gray-light transition-colors"
                  :class="{ 'bg-nc-bg-gray-light': isMeSelected(filter) }"
                  @click.stop="selectMe(filter)"
                >
                  <a-tag
                    class="rounded-tag max-w-full !pl-0"
                    :color="getColor('var(--nc-bg-gray-medium)', 'var(--nc-bg-gray-light)')"
                  >
                    <span class="flex items-stretch gap-2">
                      <div v-if="currentUserForAvatar" class="flex-none">
                        <GeneralUserIcon :user="currentUserForAvatar" size="auto" class="!text-[0.5rem] !h-[16.8px]" />
                      </div>
                      <span class="text-small text-nc-content-gray truncate"> @me </span>
                    </span>
                  </a-tag>
                  <div class="flex-1" />
                  <GeneralIcon v-if="isMeSelected(filter)" icon="check" class="h-4 w-4 text-primary flex-none" />
                </div>

                <!-- Regular user options -->
                <div
                  v-for="user in filteredUserOptions"
                  :key="user.id"
                  class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-nc-bg-gray-light transition-colors"
                  :class="{ 'bg-nc-bg-gray-light': isUserOptionSelected(filter, user) }"
                  @click.stop="selectUser(filter, user)"
                >
                  <a-tag
                    class="rounded-tag max-w-full !pl-0"
                    :color="getColor('var(--nc-bg-gray-medium)', 'var(--nc-bg-gray-light)')"
                  >
                    <span class="flex items-stretch gap-2">
                      <div class="flex-none">
                        <GeneralUserIcon :user="user" size="auto" :is-deleted="user.deleted" class="!text-[0.5rem] !h-[16.8px]" />
                      </div>
                      <span class="text-small text-nc-content-gray truncate">
                        {{ user.display_name || user.email }}
                      </span>
                    </span>
                  </a-tag>
                  <div class="flex-1" />
                  <GeneralIcon v-if="isUserOptionSelected(filter, user)" icon="check" class="h-4 w-4 text-primary flex-none" />
                </div>
                <div
                  v-if="!filteredUserOptions.length && !showMeOption"
                  class="px-3 py-3 text-xs text-nc-content-gray-muted text-center"
                >
                  {{ $t('labels.noUsersFound') }}
                </div>
              </div>

              <!-- Sub-op picker (compact NcSelect) + inline value editor for Date types -->
              <div v-else-if="isDateType(filter)" class="flex flex-col">
                <div class="px-3 py-2" @click.stop>
                  <NcSelect
                    :value="filter.comparison_sub_op"
                    :dropdown-match-select-width="false"
                    class="!w-full"
                    :placeholder="t('labels.operationSub')"
                    density="compact"
                    variant="solo"
                    :disabled="isLocked"
                    hide-details
                    dropdown-class-name="nc-pinned-date-sub-op-dropdown"
                    data-testid="nc-pinned-date-sub-op-select"
                    @change="(val: string) => selectDateSubOp(filter, val)"
                  >
                    <a-select-option v-for="subOp in getDateSubOpList(filter)" :key="subOp.value" :value="subOp.value">
                      <div class="flex items-center justify-between gap-2 max-w-60">
                        <NcTooltip show-on-truncate-only class="truncate flex-1">
                          <template #title>{{ subOp.text }}</template>
                          {{ subOp.text }}
                        </NcTooltip>
                        <GeneralIcon
                          v-if="filter.comparison_sub_op === subOp.value"
                          id="nc-selected-item-icon"
                          icon="check"
                          class="h-4 w-4 text-primary flex-none"
                        />
                      </div>
                    </a-select-option>
                  </NcSelect>
                </div>

                <!-- Inline value editor — only for sub-ops that need a value -->
                <div
                  v-if="filter.comparison_sub_op && !isCurrentDateSubOpValueless(filter)"
                  class="border-t border-nc-border-gray-medium"
                  @click.stop
                >
                  <div v-if="NUMERIC_DATE_SUB_OPS.includes(filter.comparison_sub_op)" class="px-3 py-2">
                    <a-input-number
                      :value="filter.value"
                      :min="1"
                      :controls="false"
                      :parser="(v: string) => (v || '').replace(/[^\d]/g, '')"
                      :placeholder="t('placeholder.variableValue')"
                      class="!w-full !rounded-lg"
                      :disabled="isLocked"
                      data-testid="nc-pinned-date-numeric-input"
                      @keydown="onNumericKeydown"
                      @update:value="(v: any) => updateDateValue(filter, v)"
                    />
                  </div>
                  <div v-else-if="filter.comparison_sub_op === 'exactDate'" class="py-1">
                    <div class="w-full nc-pinned-date-picker" data-testid="nc-pinned-date-picker">
                      <NcDatePicker
                        v-model:page-date="datePickerPageDate"
                        :selected-date="filter.value ? dayjs(filter.value as string) : null"
                        :is-open="openFilterId === filter.id"
                        :type="getDatePickerType(filter)"
                        size="medium"
                        @update:selected-date="(d: any) => onExactDatePick(filter, d)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer: disabled status indicator + Select all · Clear all / Clear value -->
              <div
                v-if="!isEffectivelyEnabled(filter) || isMultiValueOp(filter) || filter.value"
                class="flex items-center justify-between px-3 py-2 border-t border-nc-border-gray-medium"
              >
                <span v-if="!isEffectivelyEnabled(filter)" class="text-xs text-nc-content-gray-muted flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-nc-content-gray-muted" />
                  {{ isParentGroupDisabled(filter) ? 'Group disabled' : 'Disabled' }}
                </span>
                <div v-else />

                <!-- Multi-value ops: Select all · Clear all -->
                <div v-if="isMultiValueOp(filter)" class="flex items-center gap-1.5 text-xs">
                  <span
                    class="cursor-pointer hover:text-nc-content-gray"
                    :class="isAllSelected(filter) ? 'text-nc-content-gray-muted' : 'text-nc-content-brand'"
                    @click.stop="selectAllOptions(filter)"
                  >
                    {{ $t('general.selectAll') }}
                  </span>
                  <span class="text-nc-content-gray-muted">·</span>
                  <span
                    class="cursor-pointer hover:text-nc-content-gray"
                    :class="!filter.value ? 'text-nc-content-gray-muted' : 'text-nc-content-brand'"
                    @click.stop="clearValue(filter)"
                  >
                    {{ $t('labels.clearAll') }}
                  </span>
                </div>
                <!-- Single-value ops: Clear value -->
                <span
                  v-else-if="filter.value"
                  class="text-xs text-nc-content-brand cursor-pointer hover:text-nc-content-gray"
                  @click.stop="clearValue(filter)"
                >
                  Clear value
                </span>
              </div>
            </div>
          </template>
        </NcDropdown>
      </NcTooltip>
    </template>

    <!-- Trailing separator (between pinned filters and next toolbar section) -->
    <div class="h-5 w-px bg-nc-border-gray-medium mx-0.5 flex-none" />
  </div>
</template>

<style lang="scss" scoped>
.nc-pinned-filter-pill {
  transition: all 0.15s ease;
}

.nc-pinned-filter-panel {
  box-shadow: 0px 4px 16px -2px rgba(0, 0, 0, 0.1), 0px 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* Tag sizes used in the dropdown options list */
.rounded-tag {
  @apply py-[1px] px-2 rounded-[12px];
}

/* Compact tag sizes used inside the pill trigger — uniform for select and user types */
.nc-pinned-select-tag {
  @apply py-0.5 px-1.5 rounded-[10px];
}

.nc-pinned-user-tag {
  @apply py-0.5 pl-0 pr-1.5 rounded-[10px];
}

/**
 * Diagonal strike-through line for negated operator chips (e.g. "is not", "not any of").
 * Uses a CSS gradient on ::after to draw a 1px diagonal line across the chip,
 * providing a clear visual distinction from positive operators.
 */
:deep(.nc-negated-tag) {
  @apply relative overflow-hidden;

  &::after {
    content: '';
    @apply absolute inset-0 pointer-events-none;
    background: linear-gradient(
      to top right,
      transparent calc(50% - 0.5px),
      rgb(107 114 128 / 0.55) calc(50% - 0.5px),
      rgb(107 114 128 / 0.55) calc(50% + 0.5px),
      transparent calc(50% + 0.5px)
    );
  }
}

:deep(.ant-tag) {
  @apply "rounded-tag" my-0;
}

:deep(.nc-user-avatar) {
  @apply min-h-4.2;
}

/**
 * Make the inline NcDatePicker fill the available width of the pinned filter panel.
 * NcMonthYearSelector defaults to `max-w-[350px]` without a base width, which causes
 * the month/year grid to shrink to its content. Force the inner wrapper to span 100%.
 */
.nc-pinned-date-picker {
  :deep(.nc-month-year-grid) {
    @apply max-w-full w-full;
  }
}
</style>

<!--
  Global (non-scoped) styles to reset the NcDropdown overlay's default visual treatment.
  NcDropdown applies `rounded-lg border-1 border-nc-border-gray-medium shadow-lg` on its
  overlay wrapper. We strip these so only the inner .nc-pinned-filter-panel provides
  the visual container, preventing a visible double-border / double-shadow effect.
-->
<style lang="scss">
.nc-pinned-filter-dropdown-overlay.nc-dropdown {
  @apply !border-0 !shadow-none !bg-transparent !rounded-none !p-0;
}
</style>
