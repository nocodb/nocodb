import type { CSSProperties, FunctionalComponent, SVGAttributes } from 'nuxt/dist/app/compat/capi'
import { SyncDataType, IntegrationCategoryType } from '~/lib/enums'

export interface IntegrationItemType {
  title: string
  icon: FunctionalComponent<SVGAttributes, {}, any, {}>
  value: SyncDataType
  categories: IntegrationCategoryType[]
  isAvailable?: boolean
  iconStyle?: CSSProperties
}

export interface CategoryItemType {
  title: string
  subtitle: string
  value: IntegrationCategoryType
  icon: FunctionalComponent<SVGAttributes, {}, any, {}>
  iconBgColor?: string
}

export const integrationCategories: CategoryItemType[] = [
  {
    title: 'labels.database',
    subtitle: 'objects.integrationCategories.databaseSubtitle',
    value: IntegrationCategoryType.DATABASE,
    icon: iconMap.database,
    iconBgColor: '',
  },
  {
    title: 'objects.integrationCategories.communication',
    subtitle: 'objects.integrationCategories.communicationSubtitle',
    value: IntegrationCategoryType.COMMUNICATION,
    icon: iconMap.database,
    iconBgColor: '',
  },
  {
    title: 'objects.integrationCategories.projectManagement',
    subtitle: 'objects.integrationCategories.projectManagementSubtitle',
    value: IntegrationCategoryType.PROJECT_MANAGEMENT,
    icon: iconMap.database,
    iconBgColor: '',
  },
  {
    title: 'objects.integrationCategories.crm',
    subtitle: 'objects.integrationCategories.crmSubtitle',
    value: IntegrationCategoryType.CRM,
    icon: iconMap.database,
    iconBgColor: '',
  },
  {
    title: 'objects.integrationCategories.marketing',
    subtitle: 'objects.integrationCategories.marketingSubtitle',
    value: IntegrationCategoryType.MARKETING,
    icon: iconMap.database,
    iconBgColor: '',
  },
  {
    title: 'objects.integrationCategories.ats',
    subtitle: 'objects.integrationCategories.atsSubtitle',
    value: IntegrationCategoryType.ATS,
    icon: iconMap.database,
    iconBgColor: '',
  },
  {
    title: 'objects.integrationCategories.development',
    subtitle: 'objects.integrationCategories.developmentSubtitle',
    value: IntegrationCategoryType.DEVELOPMENT,
    icon: iconMap.database,
    iconBgColor: '',
  },
  {
    title: 'objects.integrationCategories.finance',
    subtitle: 'objects.integrationCategories.financeSubtitle',
    value: IntegrationCategoryType.FINANCE,
    icon: iconMap.database,
    iconBgColor: '',
  },
  {
    title: 'objects.integrationCategories.ticketing',
    subtitle: 'objects.integrationCategories.ticketingSubtitle',
    value: IntegrationCategoryType.TICKETING,
    icon: iconMap.database,
    iconBgColor: '',
  },
  {
    title: 'labels.storage',
    subtitle: 'objects.integrationCategories.storageSubtitle',
    value: IntegrationCategoryType.STORAGE,
    icon: iconMap.database,
    iconBgColor: '',
  },
  {
    title: 'objects.integrationCategories.others',
    subtitle: 'objects.integrationCategories.othersSubtitle',
    value: IntegrationCategoryType.OTHERS,
    icon: iconMap.database,
    iconBgColor: '',
  },
]

export const allIntegrations: IntegrationItemType[] = [
  // Database
  {
    title: 'objects.syncData.microsoftAccess',
    value: SyncDataType.MICROSOFT_ACCESS,
    icon: iconMap.microsoftAccess,
    categories: [IntegrationCategoryType.DATABASE],
  },
  {
    title: 'objects.syncData.snowflake',
    value: SyncDataType.SNOWFLAKE,
    icon: iconMap.snowflake,
    categories: [IntegrationCategoryType.DATABASE],
  },

  // Communication
  {
    title: 'objects.syncData.microsoftOutlook',
    value: SyncDataType.MICROSOFT_OUTLOOK,
    icon: iconMap.microsoftOutlook,
    categories: [IntegrationCategoryType.COMMUNICATION],
  },

  // Project Management
  {
    title: 'objects.syncData.asana',
    value: SyncDataType.ASANA,
    icon: iconMap.asana,
    categories: [IntegrationCategoryType.PROJECT_MANAGEMENT],
  },
  {
    title: 'objects.syncData.jira',
    value: SyncDataType.JIRA,
    icon: iconMap.jira,
    categories: [IntegrationCategoryType.PROJECT_MANAGEMENT, IntegrationCategoryType.TICKETING],
  },
  {
    title: 'objects.syncData.miro',
    value: SyncDataType.MIRO,
    icon: iconMap.miro,
    categories: [IntegrationCategoryType.PROJECT_MANAGEMENT],
  },
  {
    title: 'objects.syncData.tableau',
    value: SyncDataType.TABLEAU,
    icon: iconMap.tableau,
    categories: [IntegrationCategoryType.PROJECT_MANAGEMENT],
  },

  // CRM
  {
    title: 'objects.syncData.salesforce',
    value: SyncDataType.SALESFORCE,
    icon: iconMap.salesforce,
    categories: [IntegrationCategoryType.CRM],
  },

  // Marketing
  {
    title: 'objects.syncData.salesforce',
    value: SyncDataType.SALESFORCE,
    icon: iconMap.salesforce,
    categories: [IntegrationCategoryType.MARKETING],
  },
  {
    title: 'objects.syncData.hubspot',
    value: SyncDataType.HUBSPOT,
    icon: iconMap.hubspot,
    categories: [IntegrationCategoryType.MARKETING],
  },
  {
    title: 'objects.syncData.mailchimp',
    value: SyncDataType.MAILCHIMP,
    icon: iconMap.mailchimp,
    categories: [IntegrationCategoryType.MARKETING],
  },
  {
    title: 'objects.syncData.surveyMonkey',
    value: SyncDataType.SURVEYMONKEY,
    icon: iconMap.surveyMonkey,
    categories: [IntegrationCategoryType.MARKETING],
  },
  {
    title: 'objects.syncData.typeform',
    value: SyncDataType.TYPEFORM,
    icon: iconMap.typeform,
    categories: [IntegrationCategoryType.MARKETING],
  },

  // ATS
  {
    title: 'objects.syncData.workday',
    value: SyncDataType.WORKDAY,
    icon: iconMap.workday,
    categories: [IntegrationCategoryType.ATS],
  },

  // Development
  {
    title: 'objects.syncData.github',
    value: SyncDataType.GITHUB,
    icon: iconMap.githubSolid,
    categories: [IntegrationCategoryType.DEVELOPMENT],
  },
  {
    title: 'objects.syncData.gitlab',
    value: SyncDataType.GITLAB,
    icon: iconMap.gitlab,
    categories: [IntegrationCategoryType.DEVELOPMENT],
  },

  // Finance
  {
    title: 'objects.syncData.stripe',
    value: SyncDataType.STRIPE,
    icon: iconMap.stripe,
    categories: [IntegrationCategoryType.FINANCE],
  },

  // Ticketing
  {
    title: 'objects.syncData.zendesk',
    value: SyncDataType.ZENDESK,
    icon: iconMap.zendesk,
    categories: [IntegrationCategoryType.TICKETING],
  },

  // Storage
  { title: 'objects.syncData.box', value: SyncDataType.BOX, icon: iconMap.box, categories: [IntegrationCategoryType.STORAGE] },
  {
    title: 'objects.syncData.googleDrive',
    value: SyncDataType.GOOGLE_DRIVE,
    icon: iconMap.googleDrive,
    categories: [IntegrationCategoryType.STORAGE],
  },

  {
    title: 'objects.syncData.appleNumbers',
    value: SyncDataType.APPLE_NUMBERS,
    icon: iconMap.appleSolid,
    categories: [IntegrationCategoryType.OTHERS],
  },
  {
    title: 'objects.syncData.googleCalendar',
    value: SyncDataType.GOOGLE_CALENDAR,
    icon: iconMap.googleCalendar,
    categories: [IntegrationCategoryType.OTHERS],
  },
  {
    title: 'objects.syncData.microsoftExcel',
    value: SyncDataType.MICROSOFT_EXCEL,
    icon: iconMap.microsoftExcel,
    categories: [IntegrationCategoryType.OTHERS],
  },
  {
    title: 'objects.syncData.googleSheets',
    value: SyncDataType.GOOGLE_SHEETS,
    icon: iconMap.googleSheet,
    categories: [IntegrationCategoryType.OTHERS],
  },
]

export const syncDataTypes = [{ title: 'objects.syncData.trello', value: SyncDataType.TRELLO, icon: iconMap.trello }] as {
  title: string
  icon: FunctionalComponent<SVGAttributes, {}, any, {}>
  value: SyncDataType
}[]

export const syncDataTypesMap = allIntegrations.reduce((acc, curr) => {
  acc[curr.value] = curr
  return acc
}, {} as Record<string, IntegrationItemType>)
