import type { FunctionalComponent, SVGAttributes } from 'nuxt/dist/app/compat/capi'
import { SyncDataType } from '~/lib/enums'

export const syncDataTypes = [
  { title: 'objects.syncData.appleNumbers', value: SyncDataType.APPLE_NUMBERS, icon: iconMap.circle },
  { title: 'objects.syncData.asana', value: SyncDataType.ASANA, icon: iconMap.circle },
  { title: 'objects.syncData.box', value: SyncDataType.BOX, icon: iconMap.circle },
  { title: 'objects.syncData.github', value: SyncDataType.GITHUB, icon: iconMap.github },
  { title: 'objects.syncData.gitlab', value: SyncDataType.GITLAB, icon: iconMap.github },
  { title: 'objects.syncData.googleCalendar', value: SyncDataType.GOOGLE_CALENDAR, icon: iconMap.calendar },
  { title: 'objects.syncData.googleDrive', value: SyncDataType.GOOGLE_DRIVE, icon: iconMap.circle },
  { title: 'objects.syncData.googleSheets', value: SyncDataType.GOOGLE_SHEETS, icon: iconMap.circle },
  { title: 'objects.syncData.hubspot', value: SyncDataType.HUBSPOT, icon: iconMap.circle },
  { title: 'objects.syncData.jira', value: SyncDataType.JIRA, icon: iconMap.circle },
  { title: 'objects.syncData.mailchimp', value: SyncDataType.MAILCHIMP, icon: iconMap.circle },
  { title: 'objects.syncData.microsoftAccess', value: SyncDataType.MICROSOFT_ACCESS, icon: iconMap.circle },
  { title: 'objects.syncData.microsoftExcel', value: SyncDataType.MICROSOFT_EXCEL, icon: iconMap.excelColored },
  { title: 'objects.syncData.microsoftOutlook', value: SyncDataType.MICROSOFT_OUTLOOK, icon: iconMap.circle },
  { title: 'objects.syncData.miro', value: SyncDataType.MIRO, icon: iconMap.circle },
  { title: 'objects.syncData.salesforce', value: SyncDataType.SALESFORCE, icon: iconMap.circle },
  { title: 'objects.syncData.snowflake', value: SyncDataType.SNOWFLAKE, icon: iconMap.circle },
  { title: 'objects.syncData.stripe', value: SyncDataType.STRIPE, icon: iconMap.circle },
  { title: 'objects.syncData.surveyMonkey', value: SyncDataType.SURVEYMONKEY, icon: iconMap.circle },
  { title: 'objects.syncData.tableau', value: SyncDataType.TABLEAU, icon: iconMap.circle },
  { title: 'objects.syncData.trello', value: SyncDataType.TRELLO, icon: iconMap.circle },
  { title: 'objects.syncData.typeform', value: SyncDataType.TYPEFORM, icon: iconMap.circle },
  { title: 'objects.syncData.workday', value: SyncDataType.WORKDAY, icon: iconMap.circle },
  { title: 'objects.syncData.zendesk', value: SyncDataType.ZENDESK, icon: iconMap.circle },
] as {
  title: string
  icon: FunctionalComponent<SVGAttributes, {}, any, {}>
  value: SyncDataType
}[]

export const syncDataTypesMap = syncDataTypes.reduce((acc, curr) => {
  acc[curr.value] = curr
  return acc
}, {})
