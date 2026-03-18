import type { DocumentType } from 'nocodb-sdk'
import {
  getPermissionOptionValue,
  PermissionEntity,
  PermissionGrantedType,
  type PermissionKey,
  type PermissionRole,
} from 'nocodb-sdk'

interface PermissionRecord {
  entity: string
  entity_id: string
  permission: string
  granted_type: string
  granted_role?: string | null
  [key: string]: any
}

/**
 * Shared logic for resolving effective document permissions by walking the parent chain.
 * Used by both DlgDocPermissions and DocsPermissions settings page.
 */
export function useDocPermissionResolver(permissions: Ref<PermissionRecord[] | undefined>, activeDocuments: Ref<DocumentType[]>) {
  const docsById = computed(() => new Map(activeDocuments.value.map((d) => [d.id, d])))

  /**
   * Walk up the parent chain from a given doc to find the nearest explicit permission.
   * Returns the PermissionOptionValue string, or undefined if no explicit permission
   * exists anywhere in the chain (i.e. the default applies).
   */
  const resolveDocPermission = (docId: string, permissionKey: PermissionKey): string | undefined => {
    if (!permissions.value) return undefined

    let currentDoc = docsById.value.get(docId)

    while (currentDoc) {
      const perm = permissions.value.find(
        (p) => p.entity === PermissionEntity.DOCUMENT && p.entity_id === currentDoc!.id && p.permission === permissionKey,
      )
      if (perm) {
        return getPermissionOptionValue(perm.granted_type as PermissionGrantedType, perm.granted_role as PermissionRole)
      }
      currentDoc = currentDoc.parent_id ? docsById.value.get(currentDoc.parent_id) : undefined
    }

    return undefined
  }

  /**
   * Inherited effective value — only returns a value if the doc has no explicit permission.
   */
  const getEffectiveValue = (docId: string, permissionKey: PermissionKey): string | undefined => {
    if (!permissions.value) return undefined

    const hasExplicit = permissions.value.some(
      (p) => p.entity === PermissionEntity.DOCUMENT && p.entity_id === docId && p.permission === permissionKey,
    )
    if (hasExplicit) return undefined

    return resolveDocPermission(docId, permissionKey)
  }

  /**
   * Parent's effective permission — for constraining child options.
   */
  const getParentEffectiveValue = (docId: string, permissionKey: PermissionKey): string | undefined => {
    const doc = docsById.value.get(docId)
    if (!doc?.parent_id) return undefined
    return resolveDocPermission(doc.parent_id, permissionKey)
  }

  /**
   * Find the nearest ancestor (including self) that has an explicit permission for the given key.
   * Returns the docId of that ancestor, or undefined if none found.
   */
  const findDocWithExplicitPermission = (docId: string, permissionKey: PermissionKey): string | undefined => {
    if (!permissions.value) return undefined

    let currentDoc = docsById.value.get(docId)

    while (currentDoc) {
      const hasPerm = permissions.value.some(
        (p) => p.entity === PermissionEntity.DOCUMENT && p.entity_id === currentDoc!.id && p.permission === permissionKey,
      )
      if (hasPerm) return currentDoc.id
      currentDoc = currentDoc.parent_id ? docsById.value.get(currentDoc.parent_id) : undefined
    }

    return undefined
  }

  return {
    resolveDocPermission,
    getEffectiveValue,
    getParentEffectiveValue,
    findDocWithExplicitPermission,
  }
}
