import { type ColumnType, LongTextAiMetaProp, UITypes, UITypesName, isAiButton, parseProp } from 'nocodb-sdk'

type Translate = (key: string) => string
type TranslationExists = (key: string) => boolean

// Reuse translations that predate the corresponding datatype.* keys. This also
// lets existing locales translate these types before the next Crowdin sync.
const legacyFieldTypeKeys: Record<string, string> = {
  LinkToAnotherRecord: 'labels.linkToAnotherRecord',
  Links: 'labels.links',
  Order: 'labels.order',
  Colour: 'general.colour',
  JSON: 'labels.json',
  QrCode: 'title.qrCode',
  User: 'objects.user',
  CreatedBy: 'labels.createdBy',
  LastModifiedBy: 'labels.lastModifiedBy',
}

/** Translate display names without changing SDK identifiers or generated field names. */
export const getUidtI18nName = (uidt: string | undefined, t: Translate, te: TranslationExists): string => {
  if (!uidt) return ''

  for (const key of [`datatype.${uidt}`, legacyFieldTypeKeys[uidt]]) {
    // t() returns the key itself for missing messages, so a truthiness fallback
    // would expose untranslated keys such as "datatype.SmartText" in the UI.
    if (!key || !te(key)) continue
    const label = t(key)
    if (label.trim()) return label
  }

  const englishName = UITypesName[uidt as keyof typeof UITypesName]
  return typeof englishName === 'string' ? englishName : uidt
}

/** Match the SDK's rich-text, smart-text and AI variants when naming a column. */
export const getColumnTypeI18nName = (column: ColumnType | undefined, t: Translate, te: TranslationExists): string => {
  if (!column?.uidt) return ''

  let uidt: string = column.uidt
  if (column.uidt === UITypes.LongText) {
    const meta = parseProp(column.meta)
    if (meta.richMode) uidt = 'RichText'
    else if (meta.smartMode) uidt = 'SmartText'
    else if (meta[LongTextAiMetaProp]) uidt = 'AIPrompt'
  } else if (isAiButton(column)) {
    uidt = 'AIButton'
  }

  return getUidtI18nName(uidt, t, te)
}
