import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'
import { type ColumnType, LongTextAiMetaProp, UITypes, UITypesName, columnTypeName } from 'nocodb-sdk'
import { getColumnTypeI18nName, getUidtI18nName } from '../utils/fieldTypeI18n'
import en from '../lang/en.json'
import ko from '../lang/ko.json'
import ja from '../lang/ja.json'
import zhHans from '../lang/zh-Hans.json'
import de from '../lang/de.json'
import fr from '../lang/fr.json'
import es from '../lang/es.json'

const composer = (locale = 'ko') =>
  createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    missingWarn: false,
    fallbackWarn: false,
    messages: { en, ko, ja, 'zh-Hans': zhHans, de, fr, es },
  }).global

describe('field type display names', () => {
  it.each([
    ['ko', '한 줄 텍스트'],
    ['ja', 'テキスト'],
    ['zh-Hans', '单行文本'],
    ['de', 'Einzeiliger Text'],
    ['fr', "Texte d'une ligne"],
    ['es', 'Texto de una sola línea'],
  ])('uses existing %s translations', (locale, label) => {
    const { t, te } = composer(locale)
    expect(getUidtI18nName(UITypes.SingleLineText, t, te)).toBe(label)
  })

  it.each([
    [UITypes.LongText, '긴 텍스트'],
    [UITypes.Number, '숫자'],
    [UITypes.Decimal, '소수'],
    [UITypes.Attachment, '첨부파일'],
    [UITypes.Checkbox, '체크박스'],
  ])('translates the %s option shown in the field editor', (uidt, label) => {
    const { t, te } = composer()
    expect(getUidtI18nName(uidt, t, te)).toBe(label)
  })

  it.each([
    [UITypes.LinkToAnotherRecord, '다른 항목에 대한 링크'],
    [UITypes.Links, '링크'],
    [UITypes.QrCode, 'QR 코드'],
    [UITypes.Colour, '색상'],
    [UITypes.User, '사용자'],
    [UITypes.CreatedBy, '생성자'],
    [UITypes.LastModifiedBy, '최종 수정자'],
  ])('reuses the existing translated key for %s before Crowdin adds its datatype key', (uidt, label) => {
    const { t, te } = composer()
    expect(getUidtI18nName(uidt, t, te)).toBe(label)
  })

  it('prefers a canonical datatype translation over a legacy label', () => {
    const { t, te, mergeLocaleMessage } = composer()
    mergeLocaleMessage('ko', { datatype: { LinkToAnotherRecord: '레코드 연결' } })
    expect(getUidtI18nName(UITypes.LinkToAnotherRecord, t, te)).toBe('레코드 연결')
  })

  it('falls back to English for missing or empty translations and to the ID for unknown types', () => {
    const { t, te, mergeLocaleMessage } = composer()
    expect(getUidtI18nName('SmartText', t, te)).toBe(UITypesName.SmartText)
    mergeLocaleMessage('ko', { datatype: { SmartText: ' ' } })
    expect(getUidtI18nName('SmartText', t, te)).toBe(UITypesName.SmartText)
    expect(getUidtI18nName('FutureFieldType', t, te)).toBe('FutureFieldType')
    expect(getUidtI18nName(undefined, t, te)).toBe('')
  })

  it('provides an English source message for every SDK display type', () => {
    const { t, te } = composer('en')
    for (const uidt of Object.keys(UITypesName)) {
      expect(te(`datatype.${uidt}`), uidt).toBe(true)
      expect(getUidtI18nName(uidt, t, te)).toBe(t(`datatype.${uidt}`))
    }
  })

  it('updates computed names when the language changes without changing SDK names', () => {
    const { t, te, locale } = composer()
    const sdkNames = { ...UITypesName }
    const name = computed(() => getUidtI18nName(UITypes.SingleLineText, t, te))
    expect(name.value).toBe('한 줄 텍스트')
    locale.value = 'ja'
    expect(name.value).toBe('テキスト')
    locale.value = 'en'
    expect(name.value).toBe(en.datatype.SingleLineText)
    expect(UITypesName).toEqual(sdkNames)
  })
})

describe('column type display names', () => {
  it.each([
    { uidt: UITypes.LongText },
    { uidt: UITypes.LongText, meta: { richMode: true } },
    { uidt: UITypes.LongText, meta: { smartMode: true } },
    { uidt: UITypes.LongText, meta: { [LongTextAiMetaProp]: true } },
    { uidt: UITypes.LongText, meta: JSON.stringify({ smartMode: true }) },
    { uidt: UITypes.LongText, meta: { richMode: true, smartMode: true, [LongTextAiMetaProp]: true } },
    { uidt: UITypes.Button, colOptions: { type: 'ai' } },
    { uidt: UITypes.Button, colOptions: { type: 'url' } },
  ])('preserves SDK variant selection for %j', (value) => {
    const column = value as ColumnType
    const { t, te } = composer('en')
    const original = JSON.stringify(column)
    // Some existing English messages use title case; variant selection stays the same.
    expect(getColumnTypeI18nName(column, t, te).toLowerCase()).toBe(columnTypeName(column).toLowerCase())
    expect(JSON.stringify(column)).toBe(original)
  })

  it('uses translated names for variants and tolerates absent column metadata', () => {
    const { t, te, mergeLocaleMessage } = composer()
    mergeLocaleMessage('ko', { datatype: { SmartText: '스마트 텍스트', AIButton: 'AI 버튼' } })
    expect(getColumnTypeI18nName({ uidt: UITypes.LongText, meta: { smartMode: true } }, t, te)).toBe('스마트 텍스트')
    expect(getColumnTypeI18nName({ uidt: UITypes.Button, colOptions: { type: 'ai' } } as ColumnType, t, te)).toBe('AI 버튼')
    expect(getColumnTypeI18nName(undefined, t, te)).toBe('')
    expect(getColumnTypeI18nName({}, t, te)).toBe('')
  })
})
