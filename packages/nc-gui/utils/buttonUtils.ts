import { ButtonActionsType, UITypes } from 'nocodb-sdk'
import type { ButtonActionConfig, ButtonRecordUpdate, ButtonType, ColumnType } from 'nocodb-sdk'
import useNcConfirmModal from '~/composables/useNcConfirmModal'
import { getI18n } from '~/plugins/a.i18n'
import { getCheckBoxValue } from '~/utils/dataUtils'

export const buttonColorMap = {
  solid: {
    brand: {
      base: { background: 'var(--nc-brand-accent)', text: '#FFFFFF' },
      hover: { background: 'var(--nc-brand-accent-hover)', text: '#FFFFFF' },
      loader: 'var(--nc-brand-accent)',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    red: {
      base: { background: '#FF4A3F', text: '#FFFFFF' },
      hover: { background: '#CB3F36', text: '#FFFFFF' },
      loader: '#FF4A3F',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    green: {
      base: { background: '#27D665', text: '#FFFFFF' },
      hover: { background: '#1FAB51', text: '#FFFFFF' },
      loader: '#27D665',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    maroon: {
      base: { background: '#B33771', text: '#FFFFFF' },
      hover: { background: '#9D255D', text: '#FFFFFF' },
      loader: '#B33771',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    blue: {
      base: { background: '#36BFFF', text: '#FFFFFF' },
      hover: { background: '#2B99CC', text: '#FFFFFF' },
      loader: '#36BFFF',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    orange: {
      base: { background: '#FA8231', text: '#FFFFFF' },
      hover: { background: '#E1752C', text: '#FFFFFF' },
      loader: '#FA8231',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    pink: {
      base: { background: '#FC3AC6', text: '#FFFFFF' },
      hover: { background: '#CA2E9E', text: '#FFFFFF' },
      loader: '#FC3AC6',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    purple: {
      base: { background: '#7D26CD', text: '#FFFFFF' },
      hover: { background: '#641EA4', text: '#FFFFFF' },
      loader: '#7D26CD',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    yellow: {
      base: { background: '#fcbe3a', text: '#FFFFFF' },
      hover: { background: '#ca982e', text: '#FFFFFF' },
      loader: '#fcbe3a',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    gray: {
      base: { background: '#6A7184', text: '#FFFFFF' },
      hover: { background: '#4A5268', text: '#FFFFFF' },
      loader: '#6A7184',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
  },
  light: {
    brand: {
      base: { background: 'var(--color-brand-50)', text: 'var(--color-brand-600)' },
      hover: { background: 'var(--color-brand-100)', text: 'var(--color-brand-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-brand-600)',
    },
    red: {
      base: { background: 'var(--color-red-50)', text: 'var(--color-red-600)' },
      hover: { background: 'var(--color-red-100)', text: 'var(--color-red-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-red-600)',
    },
    green: {
      base: { background: 'var(--color-green-50)', text: 'var(--color-green-600)' },
      hover: { background: 'var(--color-green-100)', text: 'var(--color-green-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-green-600)',
    },
    maroon: {
      base: { background: 'var(--color-maroon-50)', text: 'var(--color-maroon-600)' },
      hover: { background: 'var(--color-maroon-100)', text: 'var(--color-maroon-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-maroon-600)',
    },
    blue: {
      base: { background: 'var(--color-blue-50)', text: 'var(--color-blue-600)' },
      hover: { background: 'var(--color-blue-100)', text: 'var(--color-blue-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-blue-600)',
    },
    orange: {
      base: { background: 'var(--color-orange-50)', text: 'var(--color-orange-600)' },
      hover: { background: 'var(--color-orange-100)', text: 'var(--color-orange-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-orange-600)',
    },
    pink: {
      base: { background: 'var(--color-pink-50)', text: 'var(--color-pink-600)' },
      hover: { background: 'var(--color-pink-100)', text: 'var(--color-pink-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-pink-600)',
    },
    purple: {
      base: { background: 'var(--color-purple-50)', text: 'var(--color-purple-600)' },
      hover: { background: 'var(--color-purple-100)', text: 'var(--color-purple-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-purple-600)',
    },
    yellow: {
      base: { background: 'var(--color-yellow-50)', text: 'var(--color-yellow-600)' },
      hover: { background: 'var(--color-yellow-100)', text: 'var(--color-yellow-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-yellow-600)',
    },
    gray: {
      base: { background: 'var(--nc-bg-gray-extralight)', text: 'var(--nc-content-gray-subtle2)' },
      hover: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-subtle2)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--nc-content-gray-subtle2)',
    },
  },
  text: {
    brand: {
      base: { background: 'transparent', text: 'var(--nc-brand-accent)' },
      hover: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-brand-accent)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--nc-brand-accent)',
    },
    red: {
      base: { background: 'transparent', text: '#FF4A3F' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#FF4A3F' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#FF4A3F',
    },
    green: {
      base: { background: 'transparent', text: '#27D665' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#27D665' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#27D665',
    },
    maroon: {
      base: { background: 'transparent', text: '#B33771' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#B33771' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#B33771',
    },
    blue: {
      base: { background: 'transparent', text: '#36BFFF' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#36BFFF' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#36BFFF',
    },
    orange: {
      base: { background: 'transparent', text: '#FA8231' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#FA8231' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },

      loader: '#FA8231',
    },
    pink: {
      base: { background: 'transparent', text: '#FC3AC6' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#FC3AC6' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#FC3AC6',
    },
    purple: {
      base: { background: 'transparent', text: '#7D26CD' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#7D26CD' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#7D26CD',
    },
    yellow: {
      base: { background: 'transparent', text: '#fcbe3a' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#fcbe3a' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#fcbe3a',
    },
    gray: {
      base: { background: 'transparent', text: 'var(--nc-content-gray-muted)' },
      hover: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-muted)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--nc-content-gray-muted)',
    },
  },
} as const

export const getButtonColors = (
  theme: 'solid' | 'light' | 'text',
  color: 'brand' | 'red' | 'green' | 'maroon' | 'blue' | 'orange' | 'pink' | 'purple' | 'yellow' | 'gray',
  isHovered: boolean,
  isDisabled: boolean,
  getColor: GetColorType,
) => {
  const themeColors = buttonColorMap[theme]?.[color]
  if (!themeColors) {
    return isHovered && !isDisabled
      ? { background: 'var(--nc-brand-accent-hover)', text: '#FFFFFF', loader: 'var(--nc-brand-accent)' }
      : { background: 'var(--nc-brand-accent)', text: '#FFFFFF', loader: 'var(--nc-brand-accent)' }
  }

  const state = isHovered && !isDisabled ? 'hover' : 'base'
  const colors = themeColors[state]

  return {
    background: getColor(colors.background),
    text: getColor(colors.text),
    loader: getColor(themeColors.loader),
  }
}

export const getButtonColorsCssVariables = (
  theme: 'solid' | 'light' | 'text',
  color: 'brand' | 'red' | 'green' | 'maroon' | 'blue' | 'orange' | 'pink' | 'purple' | 'yellow' | 'gray',
  getColor: GetColorType,
) => {
  const defaultColors = getButtonColors(theme, color, false, false, getColor)

  const hoverColors = getButtonColors(theme, color, true, false, getColor)

  const disabledColors = getButtonColors(theme, color, false, true, getColor)

  return {
    '--btn-cell-bg': defaultColors.background,
    '--btn-cell-text': defaultColors.text,

    '--btn-cell-bg-hover': hoverColors.background,
    '--btn-cell-text-hover': hoverColors.text,

    '--btn-cell-disabled-bg': disabledColors.background,
    '--btn-cell-disabled-text': disabledColors.text,
  }
}

/** Column types whose stored and read-back shapes differ enough that a raw compare is wrong. */
const BUTTON_USER_VALUE_TYPES: string[] = [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy]

/** User cells arrive as user objects, one object, or a comma-joined id/email list. */
function buttonUserKeys(value: unknown): string {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : value ? [value] : []

  return list
    .map((entry) => {
      if (entry === null || entry === undefined) return ''
      if (typeof entry === 'object') {
        const user = entry as { id?: string; email?: string }
        return (user.id ?? user.email ?? '').trim()
      }
      return String(entry).trim()
    })
    .filter(Boolean)
    .sort()
    .join(',')
}

/** Multi-select is a set — stored comma-joined, sometimes read back as an array. */
function buttonTokenSet(value: unknown): string {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : value ? [value] : []

  return list
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
    .sort()
    .join(',')
}

/**
 * Loose value equality for "already applied" checks — `'40'` ≡ `40`, `null` ≡ `''` ≡
 * `undefined`, objects by JSON.
 *
 * `column` makes the comparison type-aware where a raw compare is simply wrong: a
 * checkbox configured `true` reads back as `1` on MySQL/SQLite, and a user cell is
 * written as the picker's object but read back as the API's user objects with a
 * different key set and order — neither survives `String()` or `JSON.stringify`.
 */
export function buttonValuesEqual(a: unknown, b: unknown, column?: ColumnType): boolean {
  if (column?.uidt === UITypes.Checkbox) {
    return getCheckBoxValue(a as never) === getCheckBoxValue(b as never)
  }

  if (column?.uidt && BUTTON_USER_VALUE_TYPES.includes(column.uidt)) {
    return buttonUserKeys(a) === buttonUserKeys(b)
  }

  if (column?.uidt === UITypes.MultiSelect) {
    return buttonTokenSet(a) === buttonTokenSet(b)
  }

  const norm = (v: unknown) => (v === undefined || v === null || v === '' ? null : v)
  const x = norm(a)
  const y = norm(b)

  if (x === null || y === null) return x === y
  if (typeof x !== 'object' && typeof y !== 'object') return String(x) === String(y)

  return JSON.stringify(x) === JSON.stringify(y)
}

/**
 * An Update-record button reads as "done" (its `appearance_after`) when the
 * record already carries every configured value — derived from data, so it
 * survives reloads and agrees across users.
 */
export function buttonUpdatesApplied(
  updates: ButtonRecordUpdate[] | null | undefined,
  row: Record<string, any> | null | undefined,
  columns: ColumnType[] | null | undefined,
): boolean {
  if (!row || !updates?.length) return false

  return updates.every((update) => {
    const column = columns?.find((c) => c.id === update.fk_column_id)

    return !!column?.title && buttonValuesEqual(row[column.title], update.value, column)
  })
}

/** Runs a Button field's action, behind its confirmation dialog when the field asks for one. */
export function withButtonConfirmation(
  colOptions: (ButtonType & { action_config?: ButtonActionConfig | null }) | null | undefined,
  run: () => unknown,
) {
  const config = colOptions?.action_config
  if (!config?.require_confirmation) {
    run()
    return
  }

  const { t } = getI18n().global

  const defaultMessage =
    colOptions?.type === ButtonActionsType.UpdateRecord
      ? t('msg.info.interfaceButtonConfirmUpdateRecord')
      : colOptions?.type === ButtonActionsType.Url
      ? t('msg.info.interfaceButtonConfirmExternalUrl')
      : colOptions?.type === ButtonActionsType.Workflow
      ? t('msg.info.interfaceButtonConfirmRunAutomation')
      : t('msg.info.interfaceButtonConfirmMessage')

  useNcConfirmModal().showInfoModal({
    title: config.confirmation?.title || colOptions?.label || t('general.confirm'),
    content: config.confirmation?.message || defaultMessage,
    okText: config.confirmation?.button_label || t('general.confirm'),
    showIcon: false,
    showCancelBtn: true,
    // Close at once — the action shows its own progress.
    okCallback: async () => {
      run()
    },
  })
}
