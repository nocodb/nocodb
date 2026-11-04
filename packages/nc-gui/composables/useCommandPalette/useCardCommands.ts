import type { ColumnType } from 'nocodb-sdk'
import type { CmdCommand, Row } from '~/lib/types'
import type { CmdCardDeps, CmdRecordExtras } from '~/lib/cmdPaletteTypes'

/**
 * Cmd+K on the gallery or kanban card under the pointer: expand, copy its URL, comments and delete.
 * `extras` lets the EE edition add rows and typed edits to that record. Bind the returned handlers on each card.
 */
export function useCardCommands(deps: CmdCardDeps, extras?: (record: Row, section: string) => CmdRecordExtras) {
  const { t } = useI18n()

  const { cmdK } = useCommand()

  // The card under the pointer, kept while the palette covers it.
  const card = ref<Row | null>(null)

  // mousemove too: a pointer already resting on a card (page load, palette just closed) fires no mouseenter.
  function onCardEnter(record: Row) {
    if (!cmdK.value && card.value !== record) card.value = record
  }

  function onCardLeave(record: Row) {
    if (!cmdK.value && card.value === record) card.value = null
  }

  watch(cmdK, (open) => {
    if (!open) card.value = null
  })

  const route = useRoute()

  const { $api } = useNuxtApp()

  const { isUIAllowed } = useRoles()

  const { isMobileMode } = useGlobal()

  const { copy } = useCopy()

  const { dashboardUrl } = useDashboard()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

  const meta = inject(MetaInj, ref())

  const view = inject(ActiveViewInj, ref())

  const isPublic = inject(IsPublicInj, ref(false))

  const interfacePageDataApi = inject(InterfacePageDataInj, undefined)

  useCommandProvider(
    () => `${deps.key}:${view.value?.id}`,
    'record',
    () => {
      const record = card.value
      if (!record || record.rowMeta?.new || deps.isBlocked.value) return { commands: [] }

      const section = t('labels.commandPalette.sections.record')
      const rowId = extractPkFromRow(record.row, meta.value?.columns as ColumnType[])
      const extra = extras?.(record, section)
      const commands: CmdCommand[] = []

      if (deps.canExpand.value) {
        commands.push({
          id: 'record:expand',
          priority: CMD_PRIORITY.primary,
          title: t('labels.commandPalette.record.expand'),
          section,
          icon: { type: 'icon', name: 'ncMaximize2' },
          keywords: ['open'],
          run: () => deps.expandForm(record),
        })
      }

      if (rowId && !isPublic.value) {
        commands.push({
          id: 'record:copy-url',
          priority: CMD_PRIORITY.normal,
          title: t('labels.commandPalette.copyRecordUrl'),
          section,
          icon: { type: 'icon', name: 'ncLink' },
          keywords: ['link'],
          feedback: t('labels.commandPalette.copied'),
          run: () => {
            if (!interfacePageDataApi) {
              const { typeOrId, baseId } = route.params
              return copy(
                encodeURI(`${dashboardUrl.value}/${typeOrId}/${baseId}/${meta.value?.id}/${view.value?.id}?rowId=${rowId}`),
              )
            }
            const [origin, hash = ''] = window.location.href.split('#')
            const [hashPath, hashQuery = ''] = hash.split('?')
            const params = new URLSearchParams(hashQuery)
            params.set('rowId', rowId)
            return copy(`${origin}#${hashPath}?${params.toString()}`)
          },
        })
      }

      // Same gate and call as the grid record chip's comment commands.
      if (rowId && !interfacePageDataApi && !isPublic.value && isUIAllowed('commentEdit') && !isMobileMode.value) {
        commands.push(
          {
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
                try {
                  await $api.internal.postOperation(
                    activeWorkspaceId.value!,
                    meta.value!.base_id!,
                    { operation: 'commentRow' },
                    { fk_model_id: meta.value!.id!, row_id: rowId, comment: value.trim().replace(/\n/g, '<br />') },
                  )
                } catch (e: unknown) {
                  throw new Error(await extractSdkResponseErrorMsg(e as Error & { response?: unknown }))
                }
                record.rowMeta.commentCount = (record.rowMeta.commentCount ?? 0) + 1
              },
            },
          },
          {
            id: 'record:open-comments',
            priority: CMD_PRIORITY.normal,
            title: t('labels.commandPalette.openComments'),
            section,
            icon: { type: 'icon', name: 'ncMessageCircle' },
            run: () => {
              isExpandedFormCommentMode.value = true
              deps.expandForm(record)
            },
          },
        )
      }

      if (deps.canDelete(record)) {
        commands.push({
          id: 'record:delete',
          title: t('labels.commandPalette.deleteRecord'),
          section,
          icon: { type: 'icon', name: 'delete' },
          danger: true,
          run: () => deps.deleteRow(record),
        })
      }

      commands.push(...(extra?.commands ?? []))

      const displayField = deps.displayField.value
      return {
        context: {
          prefix: meta.value?.title,
          label: (displayField && String(record.row[displayField.title!] ?? '')) || String(rowId ?? ''),
          icon: { type: 'table', icon: parseProp(meta.value?.meta).icon },
        },
        commands,
        fallbacks: extra?.fallbacks,
      }
    },
  )

  return { onCardEnter, onCardLeave }
}
