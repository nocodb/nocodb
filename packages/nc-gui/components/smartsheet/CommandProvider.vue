<script setup lang="ts">
import type { Component } from 'vue'
import dayjs from 'dayjs'
import type { ColumnType, FilterType, GalleryType, KanbanType, SelectOptionsType, TableType, ViewType } from 'nocodb-sdk'
import {
  ExportTypes,
  PermissionEntity,
  PermissionKey,
  PlanFeatureTypes,
  PlanTitles,
  UITypes,
  ViewTypes,
  getAvailableAggregations,
  isSystemColumn,
  isVirtualCol,
  viewTypeAlias,
} from 'nocodb-sdk'
import {
  DlgBaseErd,
  DlgQuickImport,
  DlgReAssign,
  DlgTableDelete,
  DlgTableDuplicate,
  DlgTablePermissions,
  DlgViewDelete,
} from '#components'
import { LockType } from '#imports'
import type { CmdCommand, ViewPageType } from '~/lib/types'
import { useRelativeEditCommands } from '~/composables/useSetFieldCommands'
import { getOptions as getUserOptions } from '~/components/cell/User/utils'
import { matchCmdName, resolveCmdFillDate } from '~/utils/commandPaletteRelativeEdit'
import {
  type CmdCreateColumn,
  type CmdCreateKind,
  type CmdSetAction,
  type CmdStatColumn,
  type CmdStatCondition,
  type CmdStatKind,
  type CmdStatQuery,
  parseCmdQuickCreate,
  parseCmdSetAction,
  parseCmdStats,
  parseCmdWhereClause,
  splitCmdWhere,
} from '~/utils/commandPaletteDataOps'

const { t } = useI18n()

const { $e, $api } = useNuxtApp()

const route = useRoute()

const { isUIAllowed, isDataReadOnly, environmentRestrictionReason } = useRoles()

const { copy } = useCopy()

const { isMobileMode, user } = useGlobal()

const { showEEFeatures, getFeature, getPlanTitle, handleUpgradePlan, showRecordPlanLimitExceededModal } = useEeConfig()

const { isAllowed: isPermissionAllowed } = usePermissions()

const bookmarkCommand = useBookmarkCommand()

const { dashboardUrl } = useDashboard()

const { showShareModal } = storeToRefs(useShare())

const { pendingCreateHook } = storeToRefs(useWebhooksStore())

const viewsStore = useViewsStore()

const {
  navigateToView,
  duplicateView,
  updateView,
  updateViewMeta,
  onOpenCopyViewConfigFromAnotherViewModal,
  getCopyViewConfigBtnAccessStatus,
  onViewsTabChange,
  isUserViewOwner,
} = viewsStore

const { views, allRecentViews, isShowEveryonePersonalViewsEnabled } = storeToRefs(viewsStore)

const tablesStore = useTablesStore()

const baseStore = useBase()

const { basesUser } = storeToRefs(useBases())

const { isMysql, isPg, loadTables } = baseStore

const { base, isPrivateBase } = storeToRefs(baseStore)

const { setMeta, metas } = useMetas()

const { internalGet } = useInternalBatch()

const { refreshCommandPalette } = useCommandPalette()

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

const visibleFields = inject(FieldsInj, ref([]))

const { isSqlView, isGallery, isKanban, isGrid, nestedFilters } = useSmartsheetStoreOrThrow()

const { toolGroups } = useTableToolsNav()

const { exportFile } = useViewExport()

const { canModifyView, canDeleteView, isPersonalView, isLockedView } = usePersonalViewPermissions(view)

const { blockViewOperations, disableLockTypeMenu, disablePersonalView, disableCollaborativeOption, changeLockType } =
  useViewLockType(view, meta)

const { tableCommands: eeTableCommands, viewCommands: eeViewCommands } = useSmartsheetCommandsEe(meta, view)

const source = computed(() => base.value?.sources?.find((s) => s.id === meta.value?.source_id))

const sections = computed(() => ({
  view: t('labels.commandPalette.sections.view'),
  table: t('labels.commandPalette.sections.table'),
}))

async function copyToClipboard(text: string) {
  await copy(text)
}

/** A menu item behind PaymentUpgradeBadgeProvider: badged and opening the upgrade modal while the plan lacks it. */
function planGated(
  feature: PlanFeatureTypes,
  upgrade: { title?: string; content?: string; limitOrFeature?: string },
  run: () => unknown,
): Pick<CmdCommand, 'upgradeFeature' | 'run'> {
  if (!isEeUI || getFeature(feature)) return { run }
  return {
    upgradeFeature: feature,
    run: () => handleUpgradePlan({ limitOrFeature: feature, ...upgrade, triggerSource: 'command-palette' }),
  }
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

/** The sidebar's table permissions dialog (its `visible` model). */
function openTablePermissions(table: TableType) {
  const isOpen = ref(true)

  const { close } = useDialog(DlgTablePermissions, {
    'visible': isOpen,
    'tableId': table.id,
    'title': table.title,
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

  const copyConfigStatus = getCopyViewConfigBtnAccessStatus(currentView)
  if (copyConfigStatus.isVisible && !copyConfigStatus.isDisabled && showEEFeatures.value) {
    commands.push({
      id: 'view:copy-config',
      priority: CMD_PRIORITY.low,
      title: t('labels.commandPalette.copyViewConfig'),
      section: sections.value.view,
      icon: { type: 'icon', name: 'ncCopy' },
      ...planGated(
        PlanFeatureTypes.FEATURE_COPY_VIEW_SETTING_FROM_OTHER,
        {
          limitOrFeature: t('upgrade.toAccessCopyViewConfigFromAnotherView'),
          content: t('upgrade.upgradeToAccessCopyViewConfigFromAnotherViewSubtitle', { plan: getPlanTitle(PlanTitles.PLUS) }),
        },
        () => onOpenCopyViewConfigFromAnotherViewModal({ destView: currentView }),
      ),
    })
  }

  if (canEditViews && !disableLockTypeMenu.value) {
    commands.push({
      id: 'view:lock',
      priority: CMD_PRIORITY.normal,
      title: t('labels.commandPalette.changeViewLock'),
      section: sections.value.view,
      icon: { type: 'icon', name: 'ncLock' },
      keywords: ['personal', 'collaborative', 'locked', 'mode'],
      children: () => {
        const current = currentView.lock_type || LockType.Collaborative
        const options: CmdCommand[] = []

        // Anything into or out of Locked asks for confirmation in a dialog, so only the rest confirm inline.
        const inlineFeedback = (type: LockType) =>
          current === LockType.Locked || type === LockType.Locked ? undefined : t(lockTypeSwitchedMessage[type])

        if (!disableCollaborativeOption.value) {
          options.push({
            id: 'view:lock:collaborative',
            title: t('title.collaborative'),
            icon: { type: 'icon', name: 'users' },
            checked: current === LockType.Collaborative,
            feedback: inlineFeedback(LockType.Collaborative),
            run: () => changeLockType(LockType.Collaborative, { notify: false }),
          })
        }

        // Listed with a plan badge when the plan lacks personal views, like the view menu.
        if (showEEFeatures.value && !disablePersonalView.value) {
          const isPlanBlocked = !getFeature(PlanFeatureTypes.FEATURE_PERSONAL_VIEWS)
          options.push({
            id: 'view:lock:personal',
            title: t('title.personal'),
            icon: { type: 'icon', name: 'ncUser' },
            checked: current === LockType.Personal,
            upgradeFeature: PlanFeatureTypes.FEATURE_PERSONAL_VIEWS,
            feedback: isPlanBlocked ? undefined : inlineFeedback(LockType.Personal),
            run: () =>
              isPlanBlocked
                ? handleUpgradePlan({
                    limitOrFeature: PlanFeatureTypes.FEATURE_PERSONAL_VIEWS,
                    triggerSource: 'command-palette-personal-view',
                  })
                : changeLockType(LockType.Personal, { notify: false }),
          })
        }

        if (isUIAllowed('fieldAdd')) {
          options.push({
            id: 'view:lock:locked',
            title: t('title.locked'),
            icon: { type: 'icon', name: 'ncLock' },
            checked: current === LockType.Locked,
            run: () => changeLockType(LockType.Locked),
          })
        }

        return options
      },
    })
  }

  // The view menu's owner actions: reassign a personal view, or assign a collaborative one as someone's personal view.
  if (canEditViews && showEEFeatures.value) {
    const reassignAllowed = isUIAllowed('reAssignViewOwner')
    const assignAllowed = !blockViewOperations.value && !(isLockedView.value && !isUIAllowed('fieldAdd')) && reassignAllowed
    if (isPersonalView.value ? reassignAllowed : assignAllowed) {
      commands.push({
        id: 'view:reassign-owner',
        priority: CMD_PRIORITY.low,
        title: isPersonalView.value ? t('labels.reAssignView') : t('labels.assignAsPersonalView'),
        section: sections.value.view,
        icon: { type: 'icon', name: 'ncUser' },
        keywords: ['owner', 'personal', 'assign', 'transfer'],
        ...planGated(
          PlanFeatureTypes.FEATURE_PERSONAL_VIEWS,
          isPersonalView.value
            ? {
                limitOrFeature: t('upgrade.toAccessReassignPersonalView'),
                content: t('upgrade.upgradeToAccessReassignViewSubtitle', { plan: getPlanTitle(PlanTitles.PLUS) }),
              }
            : {
                limitOrFeature: t('upgrade.toAccessAssignAsPersonalView'),
                content: t('upgrade.upgradeToAccessAssignAsPersonalViewSubtitle', { plan: getPlanTitle(PlanTitles.PLUS) }),
              },
          () => openDialog(DlgReAssign, { view: currentView }),
        ),
      })
    }
  }

  // Gallery/kanban card field names (the view menu's field header toggle); reverts locally if the save fails.
  if (canEditViews && showEEFeatures.value && (currentView.type === ViewTypes.GALLERY || currentView.type === ViewTypes.KANBAN)) {
    const cardMeta = parseProp((currentView.view as GalleryType | KanbanType | undefined)?.meta)
    const isHeaderVisible = cardMeta?.is_field_header_visible ?? true
    const isBlocked = isEeUI && !getFeature(PlanFeatureTypes.FEATURE_CARD_FIELD_HEADER_VISIBILITY)
    commands.push({
      id: 'view:card-field-header',
      priority: CMD_PRIORITY.low,
      title: isHeaderVisible ? t('labels.hideFieldHeader') : t('labels.showFieldHeader'),
      section: sections.value.view,
      icon: { type: 'icon', name: isHeaderVisible ? 'eyeSlash' : 'eye' },
      keywords: ['card', 'field', 'name', 'label', 'header'],
      feedback: isBlocked ? undefined : t('labels.commandPalette.saved'),
      ...planGated(
        PlanFeatureTypes.FEATURE_CARD_FIELD_HEADER_VISIBILITY,
        {
          limitOrFeature: t('upgrade.toAccessCardFieldHeaderVisibility'),
          content: t('upgrade.upgradeToAccessCardFieldHeaderVisibilitySubtitle', { plan: getPlanTitle(PlanTitles.PLUS) }),
        },
        async () => {
          const payload = { ...cardMeta, is_field_header_visible: !isHeaderVisible }
          currentView.meta = payload
          try {
            await updateViewMeta(currentView.id!, currentView.type!, { meta: payload })
          } catch (e: unknown) {
            currentView.meta = { ...payload, is_field_header_visible: isHeaderVisible }
            throw e
          }
        },
      ),
    })
  }

  commands.push(...eeViewCommands(sections.value.view))

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
        return copyToClipboard(encodeURI(`${dashboardUrl.value}/nc/${sharedType}/${currentView.uuid}`))
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
        copyToClipboard(
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
      run: () => copyToClipboard(currentView.id!),
    },
  )

  // The view menu's BookmarksMenuAction target and meta.
  if (meta.value?.id && base.value?.id) {
    const viewBookmark = bookmarkCommand(
      {
        type: 'view',
        id: currentView.id!,
        meta: {
          view_type: currentView.type,
          workspace_id: base.value.fk_workspace_id,
          base_id: meta.value.base_id ?? base.value.id,
          table_id: meta.value.id,
        },
      },
      sections.value.view,
      t('objects.view'),
    )
    if (viewBookmark) commands.push(viewBookmark)
  }

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
  const renameArgs = { source: source.value }
  if (
    table.source_id &&
    !table.synced &&
    isUIAllowed('tableRename', renameArgs) &&
    !environmentRestrictionReason('tableRename', renameArgs)
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

  // The sidebar table menu's gates: description, delete (not synced or M2M junction tables) and bookmark.
  const tableArgs = { source: source.value }
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

  const tableBookmark = isEeUI
    ? bookmarkCommand(
        { type: 'table', id: table.id!, meta: { workspace_id: table.fk_workspace_id, base_id: table.base_id } },
        sections.value.table,
        t('objects.table'),
      )
    : undefined
  if (tableBookmark) commands.push(tableBookmark)

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

  // The sidebar table menu's access items, with its gates and plan badges.
  const isAccessTable = isEeUI && table.type === 'table' && showEEFeatures.value
  const accessArgs = { source: source.value }
  if (
    isAccessTable &&
    isUIAllowed('tablePermission', accessArgs) &&
    !environmentRestrictionReason('tablePermission', accessArgs)
  ) {
    commands.push({
      id: 'table:permissions',
      priority: CMD_PRIORITY.low,
      title: t('title.editTablePermissions'),
      section: sections.value.table,
      icon: { type: 'icon', name: 'ncLock' },
      keywords: ['permissions', 'access', 'roles', 'field'],
      ...planGated(
        PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS,
        {
          title: t('upgrade.upgradeToUseTableAndFieldPermissions'),
          content: t('upgrade.upgradeToUseTableAndFieldPermissionsSubtitle', { plan: PlanTitles.PLUS }),
        },
        () => openTablePermissions(table),
      ),
    })
  }
  if (isAccessTable && isUIAllowed('rlsManage', accessArgs) && !environmentRestrictionReason('rlsManage', accessArgs)) {
    commands.push({
      id: 'table:rls',
      priority: CMD_PRIORITY.low,
      title: t('objects.permissions.rlsPolicy.rowLevelSecurity'),
      section: sections.value.table,
      icon: { type: 'icon', name: 'ncShield' },
      keywords: ['rls', 'row', 'record', 'security', 'policy'],
      ...planGated(
        PlanFeatureTypes.FEATURE_RLS,
        {
          title: t('upgrade.upgradeToUseRls'),
          content: t('upgrade.upgradeToUseRlsSubtitle', { plan: PlanTitles.ENTERPRISE }),
        },
        () => onViewsTabChange('rls'),
      ),
    })
  }
  if (isAccessTable && isUIAllowed('dateDependencyManage', accessArgs)) {
    commands.push({
      id: 'table:date-dependency',
      priority: CMD_PRIORITY.low,
      title: t('labels.dateDependency.title'),
      section: sections.value.table,
      icon: { type: 'icon', name: 'ncCalendar' },
      keywords: ['date', 'dependency', 'gantt', 'schedule'],
      ...planGated(
        PlanFeatureTypes.FEATURE_DATE_DEPENDENCY,
        { title: t('upgrade.upgradeToUseDateDependency'), content: t('upgrade.upgradeToUseDateDependencySubtitle') },
        () => onViewsTabChange('dates'),
      ),
    })
  }

  commands.push(...eeTableCommands(sections.value.table))

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
    run: () => copyToClipboard(encodeURI(`${location.origin}/${route.params.typeOrId}/${table.base_id}/${table.id}`)),
  })

  commands.push({
    id: 'table:copy-id',
    priority: CMD_PRIORITY.low,
    title: t('labels.commandPalette.copyTableId'),
    section: sections.value.table,
    icon: { type: 'icon', name: 'ncCopy' },
    feedback: t('labels.commandPalette.copied'),
    run: () => copyToClipboard(table.id!),
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

function statKind(column: ColumnType): CmdStatKind | undefined {
  switch (column.uidt) {
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Duration:
    case UITypes.Rating:
      return 'number'
    case UITypes.Date:
    case UITypes.DateTime:
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
      return 'date'
    case UITypes.Checkbox:
      return 'checkbox'
    case UITypes.SingleSelect:
    case UITypes.MultiSelect:
      return 'select'
    case UITypes.User:
      return 'user'
    case UITypes.SingleLineText:
    case UITypes.LongText:
    case UITypes.Email:
    case UITypes.URL:
    case UITypes.PhoneNumber:
      return 'text'
  }
}

function optionTitles(column: ColumnType) {
  return ((column.colOptions as SelectOptionsType | undefined)?.options ?? []).map((option) => option.title!).filter(Boolean)
}

type StatResult = { at: number } & (
  | { status: 'loading' }
  | { status: 'done'; value: string }
  | { status: 'error'; message: string }
)

// Server results per query; reading the map inside the provider re-renders the row when one lands.
const statResults = reactive(new Map<string, StatResult>())

const pendingStat = shallowRef<{ key: string; query: CmdStatQuery }>()

const STAT_TTL = 30_000

function statKey(query: CmdStatQuery) {
  return JSON.stringify([
    view.value?.id,
    query.aggregation,
    query.column?.id,
    query.where.map((c) => [c.column.id, c.op, c.value]),
  ])
}

function statFilter(condition: CmdStatCondition): FilterType {
  const isMulti = meta.value?.columns?.find((c) => c.id === condition.column.id)?.uidt === UITypes.MultiSelect
  const op = isMulti && condition.op === 'eq' ? 'anyof' : isMulti && condition.op === 'neq' ? 'nanyof' : condition.op
  return {
    fk_column_id: condition.column.id,
    comparison_op: op as FilterType['comparison_op'],
    ...(condition.value !== undefined ? { value: condition.value } : {}),
    logical_op: 'and',
  }
}

async function loadStat(key: string, query: CmdStatQuery) {
  const table = meta.value
  const target = query.column
    ? table?.columns?.find((c) => c.id === query.column!.id)
    : table?.columns?.find((c) => c.pv) ?? table?.columns?.[0]
  if (!table?.id || !view.value?.id || !target?.id) return

  statResults.set(key, { status: 'loading', at: Date.now() })
  // Unsaved toolbar filters (no filter-sync) apply too, as the footer does; the view's saved filters apply server-side.
  const filters: FilterType[] = [
    ...(!isUIAllowed('filterSync') && nestedFilters.value.length
      ? [{ is_group: true, children: nestedFilters.value, logical_op: 'and' } as FilterType]
      : []),
    ...query.where.map(statFilter),
  ]
  try {
    const data = await internalGet<Record<string, unknown>>(table.fk_workspace_id!, table.base_id!, {
      operation: 'dataAggregate',
      tableId: table.id,
      viewId: view.value.id,
      baseId: table.base_id!,
      aggregation: JSON.stringify([{ field: target.id, type: query.aggregation }]),
      ...(filters.length ? { filterArrJson: JSON.stringify(filters) } : {}),
    })
    const raw = data?.[target.title!]
    const value =
      query.aggregation === 'count'
        ? Number(raw ?? 0).toLocaleString('en-US')
        : getFormattedAggrationValue(query.aggregation, raw, target, [], {
            col: target,
            meta: table as TableType,
            metas: metas.value,
            isMysql,
            isPg,
          })
    statResults.set(key, { status: 'done', value: value === undefined || value === null ? '–' : String(value), at: Date.now() })
  } catch (e) {
    statResults.set(key, {
      status: 'error',
      message: await extractSdkResponseErrorMsg(e as Error & { response?: unknown }),
      at: Date.now(),
    })
  }
}

// Debounced so typing "sum of amount where…" doesn't fire a request per keystroke.
watchDebounced(
  pendingStat,
  (pending) => {
    if (pending) loadStat(pending.key, pending.query)
  },
  { debounce: 300 },
)

const STAT_OP_LABEL: Record<CmdStatCondition['op'], string> = {
  eq: 'is',
  neq: 'is not',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  like: 'contains',
  blank: 'is empty',
  notblank: 'is not empty',
  checked: 'is checked',
  notchecked: 'is unchecked',
  anyof: 'is',
  nanyof: 'is not',
}

function statTitle(query: CmdStatQuery) {
  const stat = query.column
    ? t('labels.commandPalette.data.statOf', {
        aggregation: t(`aggregation_type.${query.aggregation}`),
        field: query.column.title,
      })
    : t('labels.commandPalette.data.statCount')
  if (!query.where.length) return stat
  return t('labels.commandPalette.data.statWhere', { stat, conditions: conditionsText(query.where) })
}

/** The table's fields as the stats/where parsers see them. */
function statColumns(): CmdStatColumn[] {
  return (meta.value?.columns ?? [])
    .filter((column) => !isSystemColumn(column) && statKind(column))
    .map((column) => ({
      id: column.id!,
      title: column.title!,
      kind: statKind(column)!,
      aggregations: getAvailableAggregations(column.uidt!),
      options: optionTitles(column),
      members: column.uidt === UITypes.User ? statMembers(column) : undefined,
    }))
}

function statMembers(column: ColumnType) {
  const baseUsers = meta.value?.base_id ? basesUser.value.get(meta.value.base_id) ?? [] : []
  return getUserOptions(column, false, false, baseUsers)
    .filter((option) => !option.deleted && option.id)
    .map((option) => ({ id: option.id!, name: option.display_name || option.email || '', email: option.email }))
}

function conditionsText(where: CmdStatCondition[]) {
  return where
    .map((c) =>
      [c.column.title, STAT_OP_LABEL[c.op], c.value === '@me' ? t('labels.commandPalette.data.me') : c.label ?? c.value]
        .filter(Boolean)
        .join(' '),
    )
    .join(` ${t('labels.commandPalette.data.and')} `)
}

/** "sum of amount where stage is won": the view's own figure from the server, copied on Enter. Grid views only. */
function statCommands(query: string): CmdCommand[] {
  if (!isGrid.value || isSqlView.value || !meta.value?.columns) return []
  const columns = statColumns()
  const aggLabel = (agg: string) =>
    agg === 'mode' ? t('labels.commandPalette.data.statMostCommon') : t(`aggregation_type.${agg}`)

  const base = (id: string, title: string) =>
    ({
      id: `data:stat:${id}`,
      lead: true,
      title,
      section: t('labels.commandPalette.data.stats'),
      icon: { type: 'icon', name: 'ncBarChart2' },
    } satisfies CmdCommand)

  // Fetch one at a time: the first readable figure; ties ("prise" → Price/Prize) list each.
  let fetching = false

  return parseCmdStats(query, columns).map((reading, i): CmdCommand => {
    if (reading.kind === 'no-field') {
      return {
        ...base(`none:${i}`, t('labels.commandPalette.data.statNoFieldTitle', { aggregation: aggLabel(reading.aggregation) })),
        hint: t('labels.commandPalette.data.statNoField', { text: reading.text }),
        disabled: true,
        error: true,
      }
    }
    if (reading.kind === 'bad-condition') {
      const title = reading.column
        ? t('labels.commandPalette.data.statOf', { aggregation: aggLabel(reading.aggregation), field: reading.column.title })
        : t('labels.commandPalette.data.statNoFieldTitle', { aggregation: aggLabel(reading.aggregation) })
      return {
        ...base(`bad-condition:${i}`, title),
        hint: t('labels.commandPalette.data.statBadCondition', { text: reading.text }),
        disabled: true,
        error: true,
      }
    }
    if (reading.kind === 'unsupported') {
      const suggestions = reading.suggestions.map((agg) => aggLabel(agg).toLowerCase()).join(' / ')
      return {
        ...base(
          `unsupported:${reading.column.id}`,
          t('labels.commandPalette.data.statOf', { aggregation: aggLabel(reading.aggregation), field: reading.column.title }),
        ),
        hint: suggestions
          ? t('labels.commandPalette.data.statUnsupported', { suggestions })
          : t('labels.commandPalette.data.statUnsupportedNone'),
        disabled: true,
        error: true,
      }
    }

    const parsed = reading.query
    const row = base(parsed.column?.id ?? 'count', statTitle(parsed))

    // The aggregate endpoint only sums fields the view shows.
    if (parsed.column && !visibleFields.value.some((field) => field.id === parsed.column!.id)) {
      return {
        ...row,
        hint: t('labels.commandPalette.data.statHidden', { field: parsed.column.title }),
        disabled: true,
        error: true,
      }
    }

    const key = statKey(parsed)
    const result = statResults.get(key)
    if (!fetching && (!result || (result.status !== 'loading' && Date.now() - result.at > STAT_TTL))) {
      fetching = true
      // Not from inside the provider's read; the watcher picks it up.
      queueMicrotask(() => {
        if (pendingStat.value?.key !== key) pendingStat.value = { key, query: parsed }
      })
    }
    if (!result || result.status === 'loading') return { ...row, loading: true, disabled: true }
    if (result.status === 'error') return { ...row, hint: result.message, disabled: true, error: true }
    const value = result.value
    return {
      ...row,
      value,
      feedback: t('labels.commandPalette.copiedValue', { value }),
      run: () => copy(value),
    }
  })
}

function createKind(column: ColumnType): CmdCreateKind {
  if (isSystemColumn(column) || isVirtualCol(column) || column.readonly || column.ai || column.pk) return 'other'
  switch (column.uidt) {
    case UITypes.SingleLineText:
    case UITypes.LongText:
    case UITypes.Email:
    case UITypes.URL:
    case UITypes.PhoneNumber:
      return parseProp(column.meta)?.richMode ? 'other' : 'text'
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Rating:
      return 'number'
    case UITypes.Date:
      return 'date'
    case UITypes.DateTime:
      return 'datetime'
    case UITypes.SingleSelect:
      return 'select'
    case UITypes.MultiSelect:
      return 'multiselect'
    case UITypes.User:
      return 'user'
    case UITypes.Checkbox:
      return 'checkbox'
    default:
      return 'other'
  }
}

/** "new deal Acme 5000 won": one row showing what goes where; Enter inserts it without the form. */
function quickCreateCommands(query: string): CmdCommand[] {
  const table = meta.value
  if (
    !table?.id ||
    !view.value?.id ||
    !(isGrid.value || isGallery.value || isKanban.value) ||
    !isUIAllowed('dataInsert') ||
    isDataReadOnly.value ||
    isSqlView.value ||
    table.synced ||
    !isPermissionAllowed(PermissionEntity.TABLE, table.id, PermissionKey.TABLE_RECORD_ADD)
  ) {
    return []
  }

  const visibleIds = new Set(visibleFields.value.map((field) => field.id))
  const toCreateColumn = (column: ColumnType, hidden: boolean): CmdCreateColumn => ({
    title: column.title!,
    // Values only land in fields the view shows; hidden ones still count when required.
    kind: hidden ? 'other' : createKind(column),
    pv: !!column.pv,
    required: !!column.rqd && !column.cdf && createKind(column) !== 'other',
    options: optionTitles(column),
    ...(column.uidt === UITypes.Rating ? { max: parseProp(column.meta)?.max ?? 5 } : {}),
  })
  const columns = [
    ...visibleFields.value.map((column) => toCreateColumn(column, false)),
    ...(table.columns ?? [])
      .filter((column) => !visibleIds.has(column.id) && !isSystemColumn(column))
      .map((column) => toCreateColumn(column, !column.pv)),
  ]

  const plan = parseCmdQuickCreate(query, {
    tableTitle: table.title!,
    columns,
    currentUserLabel: user.value?.display_name || user.value?.email,
  })
  if (!plan) return []

  const mapping = plan.pairs.map((pair) => `${pair.column.title} ${pair.display}`).join(' · ')
  const command = {
    id: 'data:quick-create',
    lead: true,
    title: t('labels.commandPalette.data.createRecord', { mapping }),
    section: t('labels.commandPalette.sections.create'),
    icon: { type: 'icon', name: 'plus' },
  } satisfies Partial<CmdCommand>

  const problem =
    plan.error ??
    (plan.missingRequired.length
      ? t('labels.commandPalette.data.missingRequired', { fields: plan.missingRequired.join(', ') })
      : undefined)
  if (problem) return [{ ...command, hint: problem, disabled: true, error: true }]

  // "@me" is the signed-in user, sent the way the user cell does (by email).
  const values = Object.fromEntries(
    Object.entries(plan.values).map(([title, value]) => [title, value === '@me' ? user.value?.email : value]),
  )
  return [
    {
      ...command,
      feedback: t('labels.commandPalette.data.created'),
      run: async () => {
        await $api.dbViewRow.create('noco', table.base_id!, table.id!, view.value!.id!, values)
        reloadViewDataHook.trigger()
      },
    },
  ]
}

/* "set stage won where amount > 1000": the view's matching records, previewed, confirmed, bulk-updated. */

const relativeEdit = useRelativeEditCommands()

const { showWarningModal } = useNcConfirmModal()

// Interface pages have their own record grants; bulk edits stay in the data view.
const interfacePageData = inject(InterfacePageDataInj, undefined)

type WhereRows = { at: number } & (
  | { status: 'loading' }
  | { status: 'done'; rows: Record<string, any>[]; total: number }
  | { status: 'error'; message: string }
)

const whereResults = reactive(new Map<string, WhereRows>())

const pendingWhere = shallowRef<{ key: string; where: CmdStatCondition[] }>()

/** Matching records fetched and updated in one go; more than this asks for a narrower condition. */
const WHERE_ROW_CAP = 1000

function whereKey(where: CmdStatCondition[]) {
  return JSON.stringify([view.value?.id, where.map((c) => [c.column.id, c.op, c.value])])
}

async function loadWhereRows(key: string, where: CmdStatCondition[]) {
  const table = meta.value
  if (!table?.id || !view.value?.id) return
  whereResults.set(key, { status: 'loading', at: Date.now() })
  // Within this view: its saved filters apply server-side; unsaved toolbar ones (no filter-sync) are sent along.
  const filters: FilterType[] = [
    ...(!isUIAllowed('filterSync') && nestedFilters.value.length
      ? [{ is_group: true, children: nestedFilters.value, logical_op: 'and' } as FilterType]
      : []),
    ...where.map(statFilter),
  ]
  const params = { filterArrJson: JSON.stringify(filters), limit: WHERE_ROW_CAP, offset: 0 }
  try {
    const data = await $api.dbViewRow.list('noco', table.base_id!, table.id, view.value.id, params)
    const rows = (data.list ?? []) as Record<string, any>[]
    whereResults.set(key, { status: 'done', rows, total: data.pageInfo?.totalRows ?? rows.length, at: Date.now() })
  } catch (e) {
    whereResults.set(key, {
      status: 'error',
      message: await extractSdkResponseErrorMsg(e as Error & { response?: unknown }),
      at: Date.now(),
    })
  }
}

watchDebounced(
  pendingWhere,
  (pending) => {
    if (pending) loadWhereRows(pending.key, pending.where)
  },
  { debounce: 300 },
)

/** One bulk update for the records whose value changes; the palette has closed, so errors toast as other bulk saves do. */
async function saveWhereRows(
  key: string,
  rows: Record<string, any>[],
  column: ColumnType,
  next: (prev: unknown, index?: number) => unknown,
) {
  const table = meta.value
  if (!table?.id) return
  const title = column.title!
  const updates = rows.flatMap((row, i) => {
    const prev = row[title]
    const value = next(prev, i)
    if (value === undefined || JSON.stringify(value ?? null) === JSON.stringify(prev ?? null)) return []
    return [{ ...rowPkData(row, table.columns as ColumnType[]), [title]: value }]
  })
  if (!updates.length) return
  try {
    await $api.dbTableRow.bulkUpdate('noco', table.base_id!, table.id, updates, { typecast: 'true' })
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e as Error & { response?: unknown }))
    return
  }
  whereResults.delete(key)
  reloadViewDataHook.trigger()
}

/** An absolute value fitted to the field as its cells store it, or why it can't be. */
function resolveSetValue(column: ColumnType, action: CmdSetAction): { value: unknown } | { error: string } {
  if (action.clear) return { value: null }
  const raw = action.value
  const invalid = { error: t('labels.commandPalette.where.invalidValue', { value: raw, field: column.title }) }
  const columnMeta = parseProp(column.meta)
  switch (column.uidt) {
    case UITypes.SingleSelect: {
      const option = matchCmdName(raw, optionTitles(column))
      return option ? { value: option } : invalid
    }
    case UITypes.MultiSelect: {
      const options = raw.split(/\s*,\s*/).map((part) => matchCmdName(part, optionTitles(column)))
      return options.every(Boolean) ? { value: options.join(',') } : invalid
    }
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Rating:
    case UITypes.Year: {
      const match = /^-?[\d,]*\.?\d+([km])?$/i.exec(raw.replace(/[\s$€£₹%]/g, ''))
      if (!match) return invalid
      const n = Number(match[0].replace(/[,km]/gi, '')) * (match[1]?.toLowerCase() === 'k' ? 1e3 : match[1] ? 1e6 : 1)
      if (!Number.isFinite(n)) return invalid
      if (column.uidt === UITypes.Number || column.uidt === UITypes.Year) return { value: Math.round(n) }
      if (column.uidt === UITypes.Rating) return { value: Math.min(Number(columnMeta.max ?? 5), Math.max(0, Math.round(n))) }
      return { value: n }
    }
    case UITypes.Date:
    case UITypes.DateTime: {
      const day = resolveCmdFillDate(raw) ?? (dayjs(raw).isValid() ? dayjs(raw) : undefined)
      if (!day) return invalid
      if (column.uidt === UITypes.Date) return { value: day.format('YYYY-MM-DD') }
      const timezone = columnMeta.timezone && isEeUI ? (columnMeta.timezone as string) : undefined
      const local = timezone ? dayjs.tz(day.format('YYYY-MM-DD HH:mm:ss'), timezone) : day
      return { value: local.utc().format('YYYY-MM-DD HH:mm:ssZ') }
    }
    case UITypes.Checkbox:
      if (/^(true|yes|checked|done|on|1|ticked)$/i.test(raw)) return { value: true }
      if (/^(false|no|unchecked|off|0|unticked)$/i.test(raw)) return { value: false }
      return invalid
    case UITypes.User:
      if (/^(me|myself)$/i.test(raw)) return { value: user.value?.email }
      return raw.includes('@') ? { value: raw } : invalid
    default:
      return { value: raw }
  }
}

function whereEditCommands(query: string): CmdCommand[] {
  const table = meta.value
  if (!isGrid.value || isSqlView.value || !table?.id || !view.value?.id || !table.columns) return []
  if (!isUIAllowed('dataEdit') || isDataReadOnly.value || table.synced || interfacePageData) return []

  const split = splitCmdWhere(query)
  if (!split) return []
  const columns = statColumns()
  // "sum of amount where …" and "count where …" are stats.
  if (parseCmdStats(query, columns).length) return []
  const where = parseCmdWhereClause(split.clause, columns)
  if (!where?.length) return []

  const key = whereKey(where)
  const result = whereResults.get(key)
  const rows = result?.status === 'done' ? result.rows : []
  const pv = table.columns.find((column) => column.pv)
  const section = t('labels.commandPalette.where.section')
  // Only fields the view shows come back from its list; hidden ones can't be read or previewed.
  const target = {
    meta: table as TableType,
    columns: visibleFields.value.map((column) => ({ column })),
    values: (column: ColumnType) => rows.map((row) => row[column.title!]),
    save: (column: ColumnType, next: (prev: unknown, index?: number) => unknown) => saveWhereRows(key, rows, column, next),
    section,
    count: rows.length,
    rowLabels: rows.map((row, i) =>
      String((pv && row[pv.title!]) ?? extractPkFromRow(row, table.columns as ColumnType[]) ?? i + 1),
    ),
  }

  const commands = relativeEdit(target, split.action)
  const absolute = parseCmdSetAction(split.action, columns)
  const setColumn = absolute && table.columns.find((column) => column.id === absolute.column.id)
  if (setColumn && relativeEdit.isSettable(setColumn) && !commands.some((c) => c.id === `relative-edit:${setColumn.id}`)) {
    const resolved = resolveSetValue(setColumn, absolute!)
    const field = setColumn.title
    const title = absolute!.clear
      ? t('labels.commandPalette.where.clearField', { field })
      : t('labels.commandPalette.where.setTo', {
          field,
          value: 'value' in resolved ? relativeEdit.display(setColumn, resolved.value, table) : absolute!.value,
        })
    const shown = visibleFields.value.some((column) => column.id === setColumn.id)
    const prevs = target.values(setColumn)
    commands.push({
      id: `set:${setColumn.id}`,
      title,
      section,
      icon: { type: 'field', column: setColumn },
      ...(!shown
        ? { hint: t('labels.commandPalette.where.hidden', { field }), disabled: true, error: true }
        : 'error' in resolved
        ? { hint: resolved.error, disabled: true, error: true }
        : {
            run: () =>
              showWarningModal({
                title: t('labels.commandPalette.relative.confirmTitle', { count: rows.length }, rows.length),
                content: `${title} · ${
                  relativeEdit.changeList(
                    setColumn,
                    target.rowLabels,
                    prevs,
                    prevs.map(() => resolved.value),
                    table,
                  ) || '—'
                }`,
                showCancelBtn: true,
                okText: t('general.update'),
                okCallback: async () => {
                  await saveWhereRows(key, rows, setColumn, () => resolved.value)
                },
              }),
          }),
    })
  }
  if (!commands.length) return []

  if (!result || (result.status !== 'loading' && Date.now() - result.at > STAT_TTL)) {
    // Not from inside the provider's read; the watcher picks it up.
    queueMicrotask(() => {
      if (pendingWhere.value?.key !== key) pendingWhere.value = { key, where }
    })
  }

  const suffix = t('labels.commandPalette.where.suffix', { conditions: conditionsText(where) })
  const count = rows.length
  return commands.map((command): CmdCommand => {
    const row = { ...command, id: `data:where:${command.id}`, title: `${command.title} ${suffix}`, section, lead: true }
    const blocked = { ...row, value: undefined, run: undefined, disabled: true }
    if (command.disabled && command.error) return { ...blocked, hint: command.hint, error: true }
    if (!result || result.status === 'loading') return { ...blocked, hint: undefined, loading: true }
    if (result.status === 'error') return { ...blocked, hint: result.message, error: true }
    if (result.total > count) {
      return {
        ...blocked,
        hint: t('labels.commandPalette.where.tooMany', { count: result.total, cap: WHERE_ROW_CAP }),
        error: true,
      }
    }
    if (!count) return { ...blocked, hint: t('labels.commandPalette.where.noMatch') }
    return { ...row, value: command.value ?? t('labels.commandPalette.where.count', { count }, count) }
  })
}

useCommandProvider(
  () => `view:${view.value?.id}`,
  'view',
  () => {
    if (isPublic.value || !view.value?.id || !meta.value?.id) return { commands: [] }

    return {
      context: {
        prefix: meta.value.title,
        label: view.value.title!,
        icon: { type: 'view', viewType: view.value.type, icon: view.value.meta?.icon },
      },
      commands: [...viewCommands(), ...tableCommands()],
      fallbacks: (query) => [...whereEditCommands(query), ...statCommands(query), ...quickCreateCommands(query)],
    }
  },
)
</script>

<template>
  <NcSpanHidden />
</template>
