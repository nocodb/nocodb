import type { FunctionalComponent, SVGAttributes } from 'nuxt/dist/app/compat/capi'
import { SyncDataType } from '~/lib/enums'

export const syncDataTypes = [
  { title: 'objects.syncData.appleNumbers', value: SyncDataType.APPLE_NUMBERS, icon: iconMap.appleSolid },
  { title: 'objects.syncData.asana', value: SyncDataType.ASANA, icon: iconMap.asana },
  { title: 'objects.syncData.box', value: SyncDataType.BOX, icon: iconMap.box },
  { title: 'objects.syncData.github', value: SyncDataType.GITHUB, icon: iconMap.githubSolid },
  { title: 'objects.syncData.gitlab', value: SyncDataType.GITLAB, icon: iconMap.gitlab },
  { title: 'objects.syncData.googleCalendar', value: SyncDataType.GOOGLE_CALENDAR, icon: iconMap.googleCalendar },
  { title: 'objects.syncData.googleDrive', value: SyncDataType.GOOGLE_DRIVE, icon: iconMap.googleDrive },
  { title: 'objects.syncData.googleSheets', value: SyncDataType.GOOGLE_SHEETS, icon: iconMap.googleSheet },
  { title: 'objects.syncData.hubspot', value: SyncDataType.HUBSPOT, icon: iconMap.hubspot },
  { title: 'objects.syncData.jira', value: SyncDataType.JIRA, icon: iconMap.jira },
  { title: 'objects.syncData.mailchimp', value: SyncDataType.MAILCHIMP, icon: iconMap.mailchimp },
  { title: 'objects.syncData.microsoftAccess', value: SyncDataType.MICROSOFT_ACCESS, icon: iconMap.microsoftAccess },
  { title: 'objects.syncData.microsoftExcel', value: SyncDataType.MICROSOFT_EXCEL, icon: iconMap.microsoftExcel },
  { title: 'objects.syncData.microsoftOutlook', value: SyncDataType.MICROSOFT_OUTLOOK, icon: iconMap.microsoftOutlook },
  { title: 'objects.syncData.miro', value: SyncDataType.MIRO, icon: iconMap.miro },
  { title: 'objects.syncData.salesforce', value: SyncDataType.SALESFORCE, icon: iconMap.salesforce },
  { title: 'objects.syncData.snowflake', value: SyncDataType.SNOWFLAKE, icon: iconMap.snowflake },
  { title: 'objects.syncData.stripe', value: SyncDataType.STRIPE, icon: iconMap.stripe },
  { title: 'objects.syncData.surveyMonkey', value: SyncDataType.SURVEYMONKEY, icon: iconMap.surveyMonkey },
  { title: 'objects.syncData.tableau', value: SyncDataType.TABLEAU, icon: iconMap.tableau },
  { title: 'objects.syncData.trello', value: SyncDataType.TRELLO, icon: iconMap.trello },
  { title: 'objects.syncData.typeform', value: SyncDataType.TYPEFORM, icon: iconMap.typeform },
  { title: 'objects.syncData.workday', value: SyncDataType.WORKDAY, icon: iconMap.workday },
  { title: 'objects.syncData.zendesk', value: SyncDataType.ZENDESK, icon: iconMap.zendesk },
] as {
  title: string
  icon: FunctionalComponent<SVGAttributes, {}, any, {}>
  value: SyncDataType
}[]

export const syncDataTypesMap = syncDataTypes.reduce((acc, curr) => {
  acc[curr.value] = curr
  return acc
}, {})
