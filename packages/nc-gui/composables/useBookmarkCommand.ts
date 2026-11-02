import { PlanFeatureTypes } from 'nocodb-sdk'
import type { BookmarkReqType } from 'nocodb-sdk'
import type { CmdCommand } from '~/lib/types'

/** Cmd+K's "Add to / Remove from bookmarks", gated like BookmarksMenuAction. */
export function useBookmarkCommand() {
  const { t } = useI18n()

  const { isBookmarkAllowed, isBookmarked, addBookmark, removeBookmarkByTarget } = useBookmarks()

  const { showEEFeatures, blockBookmarks } = useEeConfig()

  /** `noun` names the object in the title, since a base and its open object both offer one. */
  return (
    // View bookmarks carry a numeric view_type, as BookmarksMenuAction stores them.
    target: { type: string; id: string; meta: Record<string, string | number | undefined> },
    section: string,
    noun: string,
  ): CmdCommand | undefined => {
    if (!isBookmarkAllowed.value || !showEEFeatures.value) return undefined

    const bookmarked = isBookmarked(target.type, target.id, target.meta)
    const object = noun.toLowerCase()

    return {
      id: `${target.type}:bookmark`,
      priority: CMD_PRIORITY.normal,
      title: bookmarked
        ? t('labels.commandPalette.removeFromBookmarks', { object })
        : t('labels.commandPalette.addToBookmarks', { object }),
      section,
      icon: { type: 'icon', name: bookmarked ? 'ncBookmarkSolid' : 'ncBookmark' },
      keywords: ['bookmark', 'favourite', 'favorite', 'save'],
      // Blocked: addBookmark opens the upgrade modal, so the palette closes instead of confirming.
      ...(blockBookmarks.value && !bookmarked
        ? { upgradeFeature: PlanFeatureTypes.FEATURE_BOOKMARKS }
        : {
            feedback: bookmarked ? t('labels.commandPalette.removedFromBookmarks') : t('labels.commandPalette.addedToBookmarks'),
          }),
      run: () =>
        bookmarked
          ? removeBookmarkByTarget(target.type, target.id, target.meta, { notify: false })
          : addBookmark({ target_type: target.type, target_id: target.id, meta: target.meta } as BookmarkReqType, {
              notify: false,
            }),
    }
  }
}
