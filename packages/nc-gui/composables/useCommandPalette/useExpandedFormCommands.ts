import { type ButtonType, UITypes, isAIPromptCol, isSystemColumn } from 'nocodb-sdk'
import type { CmdCommand } from '~/lib/types'
import type { CmdRecordExtras } from '~/lib/cmdPaletteTypes'

/** The expanded form's row for a field, as rendered. */
export function cmdFormRowEl(columnId: string) {
  return document.querySelector<HTMLElement>(`.nc-expanded-form-row[col-id="${columnId}"]`)
}

export interface CmdExpandedRecordDeps {
  /** A saved record in a real (non-template) form. */
  hasRecordCommands: Ref<boolean>
  options: Ref<{
    copyRecordUrl: boolean
    sendRecord: boolean
    duplicateRecord: boolean
    reloadRecord: boolean
    deleteRecord: boolean
  }>
  rowId: () => string | undefined
  recordTitle: Ref<string>
  copyRecordUrl: () => unknown
  duplicate: () => unknown
  deleteRecord: () => unknown
  /** EE: the compact-view toggle and Send record. */
  showCompactToggle: () => boolean
  compactMode: () => boolean
  setCompactMode: (compact: boolean) => void
  openSendRecord: () => void
}

/**
 * Cmd+K on the expanded record: copy its URL, comments and history, duplicate, reload, its buttons and delete.
 * `extras` lets the EE edition add rows and typed edits to that record.
 */
export function useExpandedRecordCommands(deps: CmdExpandedRecordDeps, extras?: (section: string) => CmdRecordExtras) {
  const { t } = useI18n()

  const { isUIAllowed } = useRoles()

  const isPublic = inject(IsPublicInj, ref(false))

  const { isSqlView } = useSmartsheetStoreOrThrow()

  const expandedFormStore = useExpandedFormStoreOrThrow()

  const { isNew, primaryKey, meta, loadRow } = expandedFormStore

  useCommandProvider(
    () => `record:${meta.value?.id}:${primaryKey.value}`,
    'record',
    () => {
      if (!deps.hasRecordCommands.value) return { commands: [] }

      const section = t('labels.commandPalette.sections.record')
      const extra = extras?.(section)
      const commands: CmdCommand[] = []

      if (deps.options.value.copyRecordUrl) {
        commands.push({
          id: 'record:copy-url',
          priority: CMD_PRIORITY.high,
          title: t('labels.commandPalette.copyRecordUrl'),
          section,
          icon: { type: 'icon', name: 'copy' },
          keywords: ['link'],
          feedback: t('labels.commandPalette.copied'),
          run: () => {
            deps.copyRecordUrl()
          },
        })
      }

      // Same gates as the sidebar's comment box and feeds (none on SQL views or shared views).
      if (!isNew.value && deps.rowId() && !isSqlView.value && !isPublic.value) {
        if (isUIAllowed('commentEdit')) {
          commands.push({
            id: 'record:add-comment',
            priority: CMD_PRIORITY.normal,
            title: t('labels.commandPalette.addComment'),
            section,
            icon: { type: 'icon', name: 'ncMessageCircle' },
            keywords: ['comment', 'note', 'discuss'],
            feedback: t('labels.commandPalette.commentAdded'),
            edit: {
              value: '',
              multiline: true,
              placeholder: t('labels.commandPalette.commentPlaceholder'),
              validate: (value) => (value.trim() ? undefined : t('labels.commandPalette.commentRequired')),
              submit: async (value) => {
                await expandedFormStore.saveComment(value.trim().replace(/\n/g, '<br />'), undefined, undefined, undefined, {
                  notify: false,
                })
                expandedFormStore.requestedSidebarFeed.value = 'comments'
              },
            },
          })
        }

        if (isUIAllowed('commentList')) {
          commands.push({
            id: 'record:open-comments',
            priority: CMD_PRIORITY.normal,
            title: t('labels.commandPalette.openComments'),
            section,
            icon: { type: 'icon', name: 'ncMessageCircle' },
            run: () => {
              expandedFormStore.requestedSidebarFeed.value = 'comments'
            },
          })
        }

        if (expandedFormStore.isAuditEnabled.value) {
          commands.push({
            id: 'record:open-history',
            priority: CMD_PRIORITY.low,
            title: t('labels.commandPalette.openRevisionHistory'),
            section,
            icon: { type: 'icon', name: 'ncClock' },
            keywords: ['audit', 'history', 'changes', 'log'],
            run: () => {
              expandedFormStore.requestedSidebarFeed.value = 'audits'
            },
          })
        }
      }

      if (deps.options.value.duplicateRecord && !meta.value?.synced) {
        commands.push({
          id: 'record:duplicate',
          priority: CMD_PRIORITY.normal,
          title: t('labels.commandPalette.duplicateRecord'),
          section,
          icon: { type: 'icon', name: 'duplicate' },
          feedback: t('msg.success.rowDuplicatedWithoutSavedYet'),
          run: deps.duplicate,
        })
      }

      if (deps.options.value.reloadRecord) {
        commands.push({
          id: 'record:reload',
          priority: CMD_PRIORITY.low,
          title: `${t('general.reload')} ${t('objects.record')}`,
          section,
          icon: { type: 'icon', name: 'reload' },
          keywords: ['refresh'],
          run: () => loadRow(),
        })
      }

      // Button and AI fields: click the form's own control, so its gates, confirmations and status apply.
      for (const col of meta.value?.columns ?? []) {
        if (!col.id || isSystemColumn(col)) continue
        const isButton = col.uidt === UITypes.Button
        if (!isButton && !isAIPromptCol(col)) continue
        const selector = isButton ? '[data-testid="nc-button-cell"], .nc-cell-ai-button' : 'button.theme-ai'
        const control = cmdFormRowEl(col.id)?.querySelector<HTMLElement>(selector)
        if (!control || control.matches('[disabled], .disabled')) continue
        commands.push({
          id: `record:run:${col.id}`,
          priority: CMD_PRIORITY.normal,
          title: t(isButton ? 'labels.commandPalette.runButton' : 'labels.commandPalette.generateField', { field: col.title }),
          section,
          icon: { type: 'field', column: col },
          keywords: ['run', 'click', 'button', 'generate', (col.colOptions as ButtonType | undefined)?.label ?? ''],
          // After the palette closes, so focus and any dialog the action opens land in the form.
          run: () => setTimeout(() => cmdFormRowEl(col.id!)?.querySelector<HTMLElement>(selector)?.click(), 0),
        })
      }

      commands.push(...(extra?.commands ?? []))

      if (deps.options.value.deleteRecord && !meta.value?.synced) {
        commands.push({
          id: 'record:delete',
          title: t('labels.commandPalette.deleteRecord'),
          section,
          icon: { type: 'icon', name: 'delete' },
          danger: true,
          run: deps.deleteRecord,
        })
      }

      return {
        context: {
          prefix: meta.value?.title,
          label: deps.recordTitle.value || String(primaryKey.value),
          icon: { type: 'table', icon: parseProp(meta.value?.meta).icon },
        },
        commands,
        fallbacks: extra?.fallbacks,
      }
    },
  )
}

export interface CmdRecordNavDeps {
  key: () => string
  isOpen: () => boolean
  isNew: Ref<boolean>
  canPrev: () => boolean
  canNext: () => boolean
  prev: () => unknown
  next: () => unknown
  navShortcuts: [string, string]
  canSave: () => boolean
  save: () => unknown
  saveShortcut: string[]
  saveFeedback?: string
  hasUnsavedChanges: Ref<boolean>
  discard: () => unknown
  close: () => unknown
  /** The docked panel's sidebar and fullscreen toggles (EE). */
  panel?: {
    isFullscreen: Ref<boolean>
    isSidebarShown: Ref<boolean>
    toggleSidebar: () => unknown
    setFullscreen: (fullscreen: boolean) => unknown
  }
}

/**
 * Cmd+K record navigation for the expanded form (modal or docked panel): previous / next, save, discard and close.
 * MoreOptionsMenu registers the record chip and its actions. `extras` adds rows (EE).
 */
export function useRecordNavCommands(deps: CmdRecordNavDeps, extras?: (section: string) => CmdCommand[]) {
  const { t } = useI18n()

  const meta = inject(MetaInj, ref())

  useCommandProvider(deps.key, 'record', () => {
    if (!deps.isOpen()) return { commands: [] }

    const section = t('labels.commandPalette.sections.record')
    const commands: CmdCommand[] = []

    // An unsaved record still owns the record level, so Cmd+K never acts on the grid row behind the form.
    const newRecordContext = deps.isNew.value
      ? {
          prefix: meta.value?.title,
          label: t('activity.newRecord'),
          icon: { type: 'table' as const, icon: parseProp(meta.value?.meta).icon },
        }
      : undefined

    if (deps.canPrev() && !deps.isNew.value) {
      commands.push({
        id: 'record:previous',
        priority: CMD_PRIORITY.high,
        title: t('labels.commandPalette.previousRecord'),
        section,
        icon: { type: 'icon', name: 'ncChevronLeft' },
        shortcut: ['Alt', deps.navShortcuts[0]],
        run: deps.prev,
      })
    }

    if (deps.canNext() && !deps.isNew.value) {
      commands.push({
        id: 'record:next',
        priority: CMD_PRIORITY.high,
        title: t('labels.commandPalette.nextRecord'),
        section,
        icon: { type: 'icon', name: 'ncChevronRight' },
        shortcut: ['Alt', deps.navShortcuts[1]],
        run: deps.next,
      })
    }

    if (deps.canSave()) {
      commands.push({
        id: 'record:save',
        priority: CMD_PRIORITY.primary,
        title: t('labels.commandPalette.saveRecord'),
        section,
        icon: { type: 'icon', name: 'ncSave' },
        shortcut: deps.saveShortcut,
        feedback: deps.saveFeedback,
        run: deps.save,
      })
    }

    if (deps.hasUnsavedChanges.value && !deps.isNew.value) {
      commands.push({
        id: 'record:discard',
        priority: CMD_PRIORITY.high,
        title: t('labels.commandPalette.discardChanges'),
        section,
        icon: { type: 'icon', name: 'ncRotateCcw' },
        keywords: ['revert', 'undo', 'cancel'],
        // No inline feedback: the command unregisters once clean, which would drop its status row.
        run: deps.discard,
      })
    }

    commands.push(...(extras?.(section) ?? []), {
      id: 'record:close',
      priority: CMD_PRIORITY.low,
      title: t('labels.commandPalette.closeRecord'),
      section,
      icon: { type: 'icon', name: 'ncX' },
      shortcut: ['Esc'],
      // Unsaved edits raise the discard dialog, as the close button does.
      run: deps.close,
    })

    return { context: newRecordContext, commands }
  })
}

/** Cmd+K mirror of the expanded form's "Hide blank fields" checkbox; unavailable on a new record, as there. */
export function useHideBlankFieldsCommands(deps: { isNew: () => boolean; hideBlankFields: Ref<boolean> }) {
  const { t } = useI18n()

  useCommandProvider(`record-hide-blank:${useId()}`, 'record', () => ({
    commands: deps.isNew()
      ? []
      : [
          {
            id: 'record:hide-blank-fields',
            priority: CMD_PRIORITY.low,
            title: t('labels.hideBlankFields'),
            section: t('labels.commandPalette.sections.record'),
            icon: { type: 'icon', name: 'eyeSlash' },
            keywords: ['empty', 'filled', 'fields'],
            checked: deps.hideBlankFields.value,
            run: () => {
              deps.hideBlankFields.value = !deps.hideBlankFields.value
            },
          },
        ],
  }))
}

export interface CmdRecordViewModeItem {
  value: string
  icon: string
  tooltip?: string
  locked?: boolean
}

// The record view tabs and the hidden-fields toggle are EE in Cmd+K; CE registers none.

export function useRecordViewModeCommands<I extends CmdRecordViewModeItem>(_deps: {
  isEnabled: Ref<boolean>
  items: Ref<I[]>
  current: Ref<string>
  select: (item: I) => unknown
}) {}

export function useHiddenFieldsCommands(_deps: { isAvailable: Ref<boolean>; count: () => number; isShown: Ref<boolean> }) {}
