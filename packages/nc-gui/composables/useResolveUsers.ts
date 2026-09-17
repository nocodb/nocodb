import type { UserFieldRecordType } from 'nocodb-sdk'

/**
 * Resolves user ids that are NOT base collaborators (e.g. external submitters
 * captured by a "require sign-in" shared form) to their minimal public profile
 * so they can be displayed in CreatedBy / User cells.
 *
 * Collaborators are still resolved from the `basesUser` store as before — this
 * cache only ever holds users who are NOT in that list, and is deliberately
 * kept separate so external submitters never leak into the assign-user
 * dropdown or collaborator-management UI.
 *
 * Resolution is batched, de-duplicated, and cached for the session. Ids that
 * the backend cannot resolve are tomb-stoned (per base) to avoid refetching.
 */
export const useResolveUsers = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const BATCH_SIZE = 50

  // Resolved profiles keyed by user id (ids are globally unique).
  const resolvedUsers = ref<Map<string, UserFieldRecordType>>(new Map())

  // Ids the backend could not resolve, keyed by `${baseId}:${tableId}:${id}` —
  // resolution is scoped to the table the id was seen in, so a miss in one
  // table doesn't block resolution in another.
  const missedKeys = ref<Set<string>>(new Set())

  // Ids currently being fetched — prevents duplicate in-flight requests.
  const inFlight = new Set<string>()

  const getResolvedUser = (id?: string | null) => (id ? resolvedUsers.value.get(id.trim()) : undefined)

  // `tableId` is required by the backend to scope resolution to ids actually
  // present in that table — without it only base collaborators resolve.
  const resolveUsers = async (baseId?: string, tableId?: string, ids: (string | null | undefined)[] = []) => {
    if (!baseId || !tableId) return

    const toFetch = [
      ...new Set(
        ids
          .filter((id): id is string => !!id && typeof id === 'string')
          .map((id) => id.trim())
          .filter(
            (id) =>
              id && !resolvedUsers.value.has(id) && !missedKeys.value.has(`${baseId}:${tableId}:${id}`) && !inFlight.has(id),
          ),
      ),
    ]

    if (!toFetch.length) return

    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      const batch = toFetch.slice(i, i + BATCH_SIZE)

      batch.forEach((id) => inFlight.add(id))

      try {
        const res = await $api.instance.post(`/api/v2/meta/bases/${baseId}/users/resolve`, {
          user_ids: batch,
          table_id: tableId,
        })

        const users: UserFieldRecordType[] = res?.data?.users ?? []

        const nextResolved = new Map(resolvedUsers.value)
        const found = new Set<string>()

        for (const user of users) {
          if (user?.id) {
            nextResolved.set(user.id, user)
            found.add(user.id)
          }
        }

        resolvedUsers.value = nextResolved

        // Tomb-stone ids the backend did not return so we don't keep asking.
        const nextMissed = new Set(missedKeys.value)
        batch.filter((id) => !found.has(id)).forEach((id) => nextMissed.add(`${baseId}:${tableId}:${id}`))
        missedKeys.value = nextMissed
      } catch (e) {
        // Swallow — resolution is best-effort. Leaving ids un-tomb-stoned lets a
        // later render retry once the cause (e.g. transient network) clears.
      } finally {
        batch.forEach((id) => inFlight.delete(id))
      }
    }
  }

  return {
    resolvedUsers,
    resolveUsers,
    getResolvedUser,
  }
})
