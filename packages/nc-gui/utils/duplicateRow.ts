import type { ColumnType } from 'nocodb-sdk'
import { DlgRecordDuplicateLinks } from '#components'

/**
 * Build the row payload for duplicating a record, asking the user what to do
 * about links the copy can't share with the original.
 *
 * Links whose relationship allows only one linked record per record (has-many /
 * one-to-one / one-to-many) can't exist on both records at once — copying them
 * moves the linked records onto the duplicate and silently detaches them from
 * the original. Rather than pick for the user, we surface the choice: leave the
 * links out (default) or move them over.
 *
 * Lives here and not in `dataUtils` so the pure clone helpers stay importable
 * without dragging the dialog layer in.
 *
 * @returns the row to insert, or `null` if the user dismissed the modal — call
 * sites must treat `null` as "abort the duplicate".
 */
export async function prepareDuplicateRowData(
  row: Record<string, any> = {},
  columns: ColumnType[] = [],
): Promise<Record<string, any> | null> {
  const skippedLinks = getSkippedDuplicateLinks(row, columns)

  // Nothing that can't be shared — no reason to interrupt.
  if (!skippedLinks.length) return getDuplicateRowData(row, columns)

  const keepSingleParentLinks = await promptDuplicateLinks(skippedLinks.map((col) => col.title as string))

  if (keepSingleParentLinks === null) return null

  return getDuplicateRowData(row, columns, { keepSingleParentLinks })
}

/**
 * Opens the choice modal and resolves once it closes: `false` to leave the links
 * out, `true` to move them onto the copy, `null` if it was dismissed (cancel,
 * esc, mask) — dismissing must not fall through to a default.
 */
function promptDuplicateLinks(links: string[]): Promise<boolean | null> {
  const isOpen = ref(true)

  let keepLinks: boolean | null = null

  const { close } = useDialog(DlgRecordDuplicateLinks, {
    'modelValue': isOpen,
    'links': links,
    // Emitted by Continue just before the modal closes itself, so the choice is
    // always recorded before `isOpen` flips below.
    'onUpdate:keepLinks': (value: boolean) => {
      keepLinks = value
    },
    'onUpdate:modelValue': () => {
      isOpen.value = false
      // Debounced so the close transition can finish before unmount.
      close(1000)
    },
  })

  return until(isOpen)
    .toBe(false)
    .then(() => keepLinks)
}
