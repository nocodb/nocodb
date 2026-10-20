import type { Component } from 'vue'
import type { TableType, ViewType } from 'nocodb-sdk'
import { ExportTypes, PermissionEntity, PermissionKey, ViewTypes, viewTypeAlias } from 'nocodb-sdk'
import { DlgBaseErd, DlgQuickImport, DlgTableDelete, DlgTableDuplicate, DlgViewDelete } from '#components'
import { LockType } from '#imports'
import type { CmdCommand, CmdProviderState, ViewPageType } from '~/lib/types'

/** What an edition adds to the open view's Cmd+K context. */
export interface CmdSmartsheetExt {
  viewCommands?: (section: string) => CmdCommand[]
  tableCommands?: (section: string) => CmdCommand[]
  fallbacks?: CmdProviderState['fallbacks']
  skeleton?: CmdProviderState['skeleton']
  recent?: CmdProviderState['recent']
}

function openDialog(component: Component, props: Record<string, unknown>) {
  const isOpen = ref(true)

  const { close } = useDialog(component, {
    ...props,
    'modelValue': isOpen,
    'onUpdate:modelValue': () => {
      isOpen.value = false
      close(1000)
    },
  })
}

interface PickerEmoji {
  id: string
  name: string
  native: string
  short_names: string[]
}

let pickerEmojis: PickerEmoji[] | undefined

/** The emoji picker's set (its index and filters), flattened once; "recent" repeats emojis, so dedupe. */
function viewIconEmojis(): PickerEmoji[] {
  if (pickerEmojis) return pickerEmojis
  const index: { categories(): Array<{ emojis: PickerEmoji[] }> } = getEmojiIndex()
  const seen = new Set<string>()
  pickerEmojis = index
    .categories()
    .flatMap((category) => category.emojis)
    .filter((emoji) => emoji.native && !seen.has(emoji.id) && seen.add(emoji.id))
  return pickerEmojis
}

/** Cmd+K for the open view and its table: the view menu, the table menu and the toolbar's view-level actions. */
export function useSmartsheetCommands(ext: CmdSmartsheetExt = {}) {
  const { t } = useI18n()

  const { $e, $api } = useNuxtApp()

  const route = useRoute()

  const { isUIAllowed, isDataReadOnly, environmentRestrictionReason } = useRoles()

  const { copy } = useCopy()

  const { isMobileMode } = useGlobal()

  const { showRecordPlanLimitExceededModal } = useEeConfig()

  const { isAllowed: isPermissionAllowed } = usePermissions()

  const { dashboardUrl } = useDashboard()

  const { showShareModal } = storeToRefs(useShare())

  const { pendingCreateHook } = storeToRefs(useWebhooksStore())

  const viewsStore = useViewsStore()

  const { navigateToView, duplicateView, updateView, onViewsTabChange, isUserViewOwner } = viewsStore

  const { views, allRecentViews, isShowEveryonePersonalViewsEnabled } = storeToRefs(viewsStore)

  const tablesStore = useTablesStore()

  const baseStore = useBase()

  const { isMysql, isPg, loadTables } = baseStore

  const { base, isPrivateBase } = storeToRefs(baseStore)

  const { setMeta } = useMetas()

  const { refreshCommandPalette } = useCommandPalette()

  const meta = inject(MetaInj, ref())

  const view = inject(ActiveViewInj, ref())

  const isPublic = inject(IsPublicInj, ref(false))

  const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

  const { isSqlView, isGallery, isKanban, isGrid } = useSmartsheetStoreOrThrow()

  const { toolGroups } = useTableToolsNav()

  const { exportFile } = useViewExport()

  const { canModifyView, canDeleteView, isPersonalView } = usePersonalViewPermissions(view)

  const { blockViewOperations } = useViewLockType(view, meta)

  const source = computed(() => base.value?.sources?.find((s) => s.id === meta.value?.source_id))

  const sections = computed(() => ({
    view: t('labels.commandPalette.sections.view'),
    table: t('labels.commandPalette.sections.table'),
  }))

  /** Same rules as the sidebar's inline rename (TreeView/Views/List.vue `validate`). */
  function validateViewTitle(currentView: ViewType, title: string) {
    if (!title) return t('msg.error.viewNameRequired')
    if (views.value.some((v) => v.title?.trim() === title && v.id !== currentView.id)) return t('msg.error.viewNameDuplicate')
  }

  /** Same rules as the sidebar's inline table rename (TreeView/Table/Node.vue validators). */
  async function validateTableTitle(table: TableType, title: string) {
    await validateTableName.validator(null, title)

    let lengthLimit = 255
    if (isMysql(source.value?.id)) lengthLimit = 64
    else if (isPg(source.value?.id)) lengthLimit = 63
    if (((base.value?.prefix || '') + title).length > lengthLimit) {
      throw new Error(`Table name exceeds ${lengthLimit} characters`)
    }

    const baseTables = tablesStore.baseTables.get(table.base_id!) ?? []
    if (baseTables.some((other) => other.id !== table.id && other.title?.trim().toLowerCase() === title.toLowerCase())) {
      throw new Error('Duplicate table alias')
    }
  }

  /** Mirrors the sidebar's `handleTableRename` (TreeView/index.vue). */
  async function renameTable(table: TableType, title: string) {
    await validateTableTitle(table, title)

    await $api.internal.postOperation(
      table.fk_workspace_id!,
      table.base_id!,
      { operation: 'tableUpdate', tableId: table.id! },
      { table_name: title, title },
    )

    await tablesStore.loadProjectTables(table.base_id!, true)
    await loadTables()

    allRecentViews.value = allRecentViews.value.map((recent) => {
      if (recent.tableID !== table.id) return recent
      return { ...recent, tableName: title, viewName: recent.isDefault ? title : recent.viewName }
    })

    const newMeta = await $api.internal.getOperation(table.fk_workspace_id!, table.base_id!, {
      operation: 'tableGet',
      tableId: table.id!,
    })
    await setMeta(newMeta)

    refreshCommandPalette()

    $e('a:table:rename')
  }

  /** Mirrors the table description dialog's save (DlgTableDescriptionUpdate). */
  async function updateTableDescription(table: TableType, description: string) {
    await $api.internal.postOperation(
      table.fk_workspace_id!,
      table.base_id!,
      { operation: 'tableUpdate', tableId: table.id! },
      { description: description.trim() },
    )

    await tablesStore.loadProjectTables(table.base_id!, true)
    await loadTables()

    const newMeta = await $api.internal.getOperation(table.fk_workspace_id!, table.base_id!, {
      operation: 'tableGet',
      tableId: table.id!,
    })
    await setMeta(newMeta)

    $e('a:table:description:update')
  }

  /** The sidebar's table delete confirmation (its `visible` model, not `modelValue`); never deletes by itself. */
  function openTableDelete(table: TableType) {
    const isOpen = ref(true)

    const { close } = useDialog(DlgTableDelete, {
      'visible': isOpen,
      'tableId': table.id,
      'baseId': table.base_id,
      'onUpdate:visible': () => {
        isOpen.value = false
        close(1000)
      },
    })
  }

  async function onDuplicateView() {
    if (!view.value || !meta.value?.id || !base.value?.id) return

    const duplicatedView = await duplicateView(view.value)

    refreshCommandPalette()

    if (!duplicatedView) return

    navigateToView({
      view: duplicatedView,
      tableId: meta.value.id,
      tableTitle: meta.value.title,
      baseId: base.value.id,
      hardReload: duplicatedView.type === ViewTypes.FORM,
    })

    $e('a:view:create', { view: duplicatedView.type, sidebar: false })
  }

  // Same call as the sidebar's setIcon (Views/List.vue).
  async function setViewIcon(target: ViewType, icon: string) {
    const nextMeta = { ...parseProp(target.meta), icon }
    try {
      await $api.internal.postOperation(
        target.fk_workspace_id!,
        target.base_id!,
        { operation: 'viewUpdate', viewId: target.id! },
        { meta: nextMeta },
      )
    } catch (e: unknown) {
      throw new Error(await extractSdkResponseErrorMsg(e as Error & { response?: unknown }))
    }
    target.meta = nextMeta
  }

  function viewCommands(): CmdCommand[] {
    const currentView = view.value!
    const commands: CmdCommand[] = []
    const canEditViews = isUIAllowed('viewCreateOrEdit')

    // The sidebar's list for this table: its order, and others' personal views only when it shows them.
    const tableViews = [...views.value]
      .filter(
        (v) =>
          isShowEveryonePersonalViewsEnabled.value ||
          v.id === currentView.id ||
          v.lock_type !== LockType.Personal ||
          isUserViewOwner(v),
      )
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    if (tableViews.length > 1) {
      commands.push({
        id: 'view:switch',
        priority: CMD_PRIORITY.normal,
        title: t('labels.commandPalette.switchView'),
        section: sections.value.view,
        icon: { type: 'icon', name: 'ncArrowRight' },
        keywords: ['change', 'go'],
        searchChildren: true,
        children: () =>
          tableViews.map((v) => ({
            id: `view:switch:${v.id}`,
            title: v.title!,
            icon: { type: 'view', viewType: v.type, icon: parseProp(v.meta)?.icon },
            checked: v.id === currentView.id,
            run: () =>
              navigateToView({
                view: v,
                tableId: meta.value!.id!,
                tableTitle: meta.value!.title,
                baseId: meta.value!.base_id!,
                doNotSwitchTab: true,
              }),
          })),
      })
    }

    if (canEditViews) {
      commands.push({
        id: 'view:duplicate',
        priority: CMD_PRIORITY.normal,
        title: t('labels.commandPalette.duplicateView'),
        section: sections.value.view,
        icon: { type: 'icon', name: 'duplicate' },
        keywords: ['copy', 'clone'],
        run: onDuplicateView,
      })
    }

    if (canEditViews && canModifyView.value) {
      commands.push(
        {
          id: 'view:rename',
          priority: CMD_PRIORITY.normal,
          title: t('labels.commandPalette.renameView'),
          section: sections.value.view,
          icon: { type: 'icon', name: 'rename' },
          edit: {
            value: currentView.title ?? '',
            validate: (title) => validateViewTitle(currentView, title),
            submit: async (title) => {
              await updateView(currentView.id!, { title, order: currentView.order })
              $e('a:view:rename', { view: currentView.type })
            },
          },
        },
        {
          id: 'view:description',
          priority: CMD_PRIORITY.low,
          title: t('labels.commandPalette.editViewDescription'),
          section: sections.value.view,
          icon: { type: 'icon', name: 'ncAlignLeft' },
          edit: {
            value: currentView.description ?? '',
            multiline: true,
            placeholder: t('labels.description'),
            submit: async (description) => {
              await updateView(currentView.id!, { description: description.trim() })
              $e('a:view:description:update')
            },
          },
        },
      )
    }

    // The sidebar's icon picker: same emoji set, same gate (read-only when locked, on mobile or not modifiable).
    if (canModifyView.value && !isMobileMode.value) {
      const currentIcon = parseProp(currentView.meta)?.icon
      commands.push({
        id: 'view:icon',
        priority: CMD_PRIORITY.low,
        title: t('labels.commandPalette.changeViewIcon'),
        section: sections.value.view,
        icon: currentIcon ? { type: 'emoji', emoji: currentIcon } : { type: 'icon', name: 'ncSmile' },
        keywords: ['emoji', 'icon', 'symbol'],
        // ~1,800 emojis: searched inside the submenu only, not on every top-level keystroke.
        children: () => [
          ...(currentIcon
            ? [
                {
                  id: 'view:icon:remove',
                  title: t('labels.commandPalette.removeIcon'),
                  icon: { type: 'icon' as const, name: 'ncXCircle' },
                  feedback: t('labels.commandPalette.saved'),
                  run: () => setViewIcon(currentView, ''),
                },
              ]
            : []),
          ...viewIconEmojis().map((emoji) => ({
            id: `view:icon:${emoji.id}`,
            title: emoji.name,
            icon: { type: 'emoji' as const, emoji: emoji.native },
            keywords: emoji.short_names,
            checked: emoji.native === currentIcon,
            priority: CMD_PRIORITY.low,
            feedback: t('labels.commandPalette.saved'),
            run: () => setViewIcon(currentView, emoji.native),
          })),
        ],
      })
    }

    commands.push(...(ext.viewCommands?.(sections.value.view) ?? []))

    if (currentView.type !== ViewTypes.FORM) {
      commands.push(
        {
          id: 'view:download-csv',
          priority: CMD_PRIORITY.low,
          title: t('labels.commandPalette.downloadCsv'),
          section: sections.value.view,
          icon: { type: 'icon', name: 'download' },
          keywords: ['export'],
          feedback: t('msg.info.preparingForDownload', { type: 'CSV' }),
          run: () => exportFile(ExportTypes.CSV, { notify: false }),
        },
        {
          id: 'view:download-excel',
          priority: CMD_PRIORITY.low,
          title: t('labels.commandPalette.downloadExcel'),
          section: sections.value.view,
          icon: { type: 'icon', name: 'download' },
          keywords: ['export', 'xlsx'],
          feedback: t('msg.info.preparingForDownload', { type: 'EXCEL' }),
          run: () => exportFile(ExportTypes.EXCEL, { notify: false }),
        },
        {
          id: 'view:download-json',
          priority: CMD_PRIORITY.low,
          title: t('labels.commandPalette.view.downloadJson'),
          section: sections.value.view,
          icon: { type: 'icon', name: 'download' },
          keywords: ['export'],
          feedback: t('msg.info.preparingForDownload', { type: 'JSON' }),
          run: () => exportFile(ExportTypes.JSON, { notify: false }),
        },
      )
    }

    // The toolbar Share button's modal; it opens on the view it is launched over.
    if (isUIAllowed('viewShare')) {
      commands.push({
        id: 'view:share',
        priority: CMD_PRIORITY.high,
        title: t('labels.commandPalette.view.share'),
        section: sections.value.view,
        icon: { type: 'icon', name: 'ncShare' },
        keywords: ['public', 'publish', 'link'],
        run: () => {
          showShareModal.value = true
        },
      })
    }

    // Only once the view is shared publicly; a private base restricts sharing to forms (as SharePage does).
    if (currentView.uuid && !(isPrivateBase.value && currentView.type !== ViewTypes.FORM)) {
      commands.push({
        id: 'view:copy-shared-link',
        priority: CMD_PRIORITY.low,
        title: t('labels.commandPalette.view.copySharedLink'),
        section: sections.value.view,
        icon: { type: 'icon', name: 'ncLink' },
        keywords: ['public', 'share', 'url'],
        feedback: t('labels.commandPalette.copied'),
        run: () => {
          const sharedType = currentView.type === ViewTypes.GRID ? 'view' : viewTypeAlias[currentView.type as ViewTypes] ?? 'view'
          return copy(encodeURI(`${dashboardUrl.value}/nc/${sharedType}/${currentView.uuid}`))
        },
      })
    }

    commands.push(
      {
        id: 'view:copy-link',
        priority: CMD_PRIORITY.normal,
        title: t('labels.commandPalette.copyViewLink'),
        section: sections.value.view,
        icon: { type: 'icon', name: 'ncLink' },
        keywords: ['url', 'share'],
        feedback: t('labels.commandPalette.copied'),
        run: () =>
          copy(
            encodeURI(
              `${location.origin}/${route.params.typeOrId}/${currentView.base_id}/${currentView.fk_model_id}/${currentView.id}`,
            ),
          ),
      },
      {
        id: 'view:copy-id',
        priority: CMD_PRIORITY.low,
        title: t('labels.commandPalette.copyViewId'),
        section: sections.value.view,
        icon: { type: 'icon', name: 'ncCopy' },
        feedback: t('labels.commandPalette.copied'),
        run: () => copy(currentView.id!),
      },
    )

    // Mirrors the view menu: the last collaborative grid can't be deleted, nor a locked view.
    if (canEditViews && canDeleteView.value && !(blockViewOperations.value && !isPersonalView.value)) {
      commands.push({
        id: 'view:delete',
        title: t('labels.commandPalette.deleteView'),
        section: sections.value.view,
        icon: { type: 'icon', name: 'delete' },
        danger: true,
        run: () => openDialog(DlgViewDelete, { view: currentView }),
      })
    }

    return commands
  }

  function tableCommands(): CmdCommand[] {
    const table = meta.value!
    const commands: CmdCommand[] = []

    // Opens the new-record form. The canvas grid's listener destructures `{ overwrite, path }`.
    if ((isGrid.value || isGallery.value || isKanban.value) && isUIAllowed('dataInsert') && !isSqlView.value && !table.synced) {
      commands.push({
        id: 'table:add-record',
        priority: CMD_PRIORITY.primary,
        title: t('labels.commandPalette.addRecord'),
        // In the View section so the screen's verbs lead and table admin follows.
        section: sections.value.view,
        icon: { type: 'icon', name: 'plus' },
        keywords: ['new', 'row', 'create'],
        run: () => (isGrid.value ? openNewRecordFormHook.trigger({ overwrite: {}, path: [] }) : openNewRecordFormHook.trigger()),
      })
    }

    // Same gates as the view menu's "Upload data" submenu (ViewActionMenu `isUploadAllowed` + PermissionsTooltip).
    const canUpload =
      !isPublic.value &&
      !isDataReadOnly.value &&
      table.type !== 'view' &&
      !table.mm &&
      !table.synced &&
      view.value?.type !== ViewTypes.FORM &&
      !!table.base_id &&
      !!table.source_id &&
      isPermissionAllowed(PermissionEntity.TABLE, table.id!, PermissionKey.TABLE_RECORD_ADD)
    for (const importType of ['csv', 'excel'] as const) {
      if (!canUpload || !isUIAllowed(`${importType}TableImport`)) continue
      commands.push({
        id: `table:import-${importType}`,
        priority: CMD_PRIORITY.low,
        title: t(importType === 'csv' ? 'labels.commandPalette.table.importCsv' : 'labels.commandPalette.table.importExcel'),
        section: sections.value.table,
        icon: { type: 'icon', name: importType === 'csv' ? 'ncFileTypeCsvSmall' : 'ncFileTypeExcel' },
        keywords: ['upload', 'import', 'data'],
        run: () => {
          if (showRecordPlanLimitExceededModal()) return
          openDialog(DlgQuickImport, {
            importDataOnly: true,
            importType,
            baseId: table.base_id,
            sourceId: table.source_id,
          })
        },
      })
    }

    // Webhooks tab gate (useTableToolsNav) plus create; the tab consumes `pendingCreateHook`.
    if (isUIAllowed('hookList') && isUIAllowed('hookCreate') && !isSqlView.value) {
      commands.push({
        id: 'table:create-webhook',
        priority: CMD_PRIORITY.low,
        title: t('labels.commandPalette.table.createWebhook'),
        section: sections.value.table,
        icon: { type: 'icon', name: 'ncWebhook' },
        keywords: ['hook', 'automation', 'new'],
        run: () => {
          onViewsTabChange('webhook')
          pendingCreateHook.value = true
        },
      })
    }

    commands.push({
      id: 'table:api-snippet',
      priority: CMD_PRIORITY.low,
      title: t('labels.commandPalette.table.apiSnippet'),
      section: sections.value.table,
      icon: { type: 'icon', name: 'ncCode' },
      keywords: ['api', 'rest', 'code', 'swagger'],
      run: () => onViewsTabChange('api'),
    })

    // Gate as the sidebar table node does; synced tables keep their source's name.
    const tableArgs = { source: source.value }
    if (
      table.source_id &&
      !table.synced &&
      isUIAllowed('tableRename', tableArgs) &&
      !environmentRestrictionReason('tableRename', tableArgs)
    ) {
      commands.push({
        id: 'table:rename',
        priority: CMD_PRIORITY.low,
        title: t('labels.commandPalette.renameTable'),
        section: sections.value.table,
        icon: { type: 'icon', name: 'rename' },
        edit: {
          value: table.title ?? '',
          submit: (title) => renameTable(table, title),
        },
      })
    }

    // The sidebar table menu's gates: description and delete (not synced or M2M junction tables).
    if (isUIAllowed('tableDescriptionEdit', tableArgs) && !environmentRestrictionReason('tableDescriptionEdit', tableArgs)) {
      commands.push({
        id: 'table:description',
        priority: CMD_PRIORITY.low,
        title: t('labels.editTableDescription'),
        section: sections.value.table,
        icon: { type: 'icon', name: 'ncAlignLeft' },
        edit: {
          value: table.description ?? '',
          multiline: true,
          placeholder: t('labels.description'),
          submit: (description) => updateTableDescription(table, description),
        },
      })
    }

    const tools = toolGroups.value.flatMap((group) => group.items)
    if (tools.length) {
      commands.push({
        id: 'table:details',
        priority: CMD_PRIORITY.normal,
        title: t('labels.commandPalette.openTableDetails'),
        section: sections.value.table,
        icon: { type: 'icon', name: 'ncSettings' },
        keywords: ['fields', 'relations', 'webhooks', 'api'],
        searchChildren: true,
        children: () =>
          tools.map((tool) => ({
            id: `table:details:${tool.slug}`,
            title: tool.title,
            icon: { type: 'icon', name: tool.icon },
            run: () => onViewsTabChange(tool.slug as ViewPageType),
          })),
      })
    }

    commands.push(...(ext.tableCommands?.(sections.value.table) ?? []))

    if (table.source_id && table.base_id) {
      commands.push({
        id: 'table:erd',
        priority: CMD_PRIORITY.low,
        title: t('labels.commandPalette.openErd'),
        section: sections.value.table,
        icon: { type: 'icon', name: 'ncErd' },
        keywords: ['relations', 'diagram', 'schema'],
        run: () => openDialog(DlgBaseErd, { sourceId: table.source_id, baseId: table.base_id }),
      })
    }

    if (
      table.type === 'table' &&
      (source.value?.is_meta || source.value?.is_local) &&
      isUIAllowed('tableDuplicate', { source: source.value })
    ) {
      commands.push({
        id: 'table:duplicate',
        priority: CMD_PRIORITY.low,
        title: t('labels.commandPalette.duplicateTable'),
        section: sections.value.table,
        icon: { type: 'icon', name: 'duplicate' },
        run: () => {
          $e('c:table:duplicate')
          openDialog(DlgTableDuplicate, { table })
        },
      })
    }

    // A view-less URL opens the table's default view.
    commands.push({
      id: 'table:copy-link',
      priority: CMD_PRIORITY.normal,
      title: t('labels.commandPalette.copyTableLink'),
      section: sections.value.table,
      icon: { type: 'icon', name: 'ncLink' },
      keywords: ['url', 'share'],
      feedback: t('labels.commandPalette.copied'),
      run: () => copy(encodeURI(`${location.origin}/${route.params.typeOrId}/${table.base_id}/${table.id}`)),
    })

    commands.push({
      id: 'table:copy-id',
      priority: CMD_PRIORITY.low,
      title: t('labels.commandPalette.copyTableId'),
      section: sections.value.table,
      icon: { type: 'icon', name: 'ncCopy' },
      feedback: t('labels.commandPalette.copied'),
      run: () => copy(table.id!),
    })

    if (
      !table.synced &&
      !table.mm &&
      table.base_id &&
      isUIAllowed('tableDelete', tableArgs) &&
      !environmentRestrictionReason('tableDelete', tableArgs)
    ) {
      commands.push({
        id: 'table:delete',
        title: t('labels.commandPalette.deleteTable'),
        section: sections.value.table,
        icon: { type: 'icon', name: 'delete' },
        danger: true,
        run: () => {
          $e('c:table:delete')
          openTableDelete(table)
        },
      })
    }

    return commands
  }

  useCommandProvider(
    () => `view:${view.value?.id}`,
    'view',
    () => {
      if (isPublic.value || !view.value?.id || !meta.value?.id) return { commands: [] }

      return {
        context: {
          // A view named like its table (the default one) would read "Deals › Deals".
          prefix: view.value.title === meta.value.title ? undefined : meta.value.title,
          label: view.value.title!,
          icon: { type: 'view', viewType: view.value.type, icon: view.value.meta?.icon },
        },
        commands: [...viewCommands(), ...tableCommands()],
        fallbacks: ext.fallbacks,
        skeleton: ext.skeleton,
        recent: ext.recent,
      }
    },
  )
}
