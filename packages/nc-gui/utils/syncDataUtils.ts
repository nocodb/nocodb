import type { FormDefinition } from 'nocodb-sdk'
import type { CSSProperties, FunctionalComponent, SVGAttributes } from 'nuxt/dist/app/compat/capi'
import { ClientType, IntegrationCategoryType, SyncDataType } from '~/lib/enums'

export const integrationsInitialized = ref(false)
export interface IntegrationItemType {
  title: string
  icon: FunctionalComponent<SVGAttributes, {}, any, {}>
  subType: SyncDataType | ClientType
  type: IntegrationCategoryType
  isAvailable?: boolean
  iconStyle?: CSSProperties
  isOssOnly?: boolean
  subtitle?: string
  dynamic?: boolean
  form?: FormDefinition
}

export interface IntegrationCategoryItemType {
  title: string
  subtitle: string
  value: IntegrationCategoryType
  isAvailable?: boolean
  teleEventName?: IntegrationCategoryType
}

export const integrationCategories: IntegrationCategoryItemType[] = [
  {
    title: 'labels.database',
    subtitle: 'objects.integrationCategories.databaseSubtitle',
    value: IntegrationCategoryType.DATABASE,
    isAvailable: true,
  },
  {
    title: 'objects.integrationCategories.ai',
    subtitle: 'objects.integrationCategories.ai',
    value: IntegrationCategoryType.AI,
    isAvailable: true,
  },
  {
    title: 'objects.integrationCategories.ai',
    subtitle: 'objects.integrationCategories.ai',
    value: `${IntegrationCategoryType.AI}-coming-soon`,
  },
  {
    title: 'objects.integrationCategories.communication',
    subtitle: 'objects.integrationCategories.communicationSubtitle',
    value: IntegrationCategoryType.COMMUNICATION,
  },
  {
    title: 'objects.integrationCategories.spreadSheet',
    subtitle: 'objects.integrationCategories.spreadSheetSubtitle',
    value: IntegrationCategoryType.SPREAD_SHEET,
    teleEventName: IntegrationCategoryType.OTHERS,
  },
  {
    title: 'objects.integrationCategories.projectManagement',
    subtitle: 'objects.integrationCategories.projectManagementSubtitle',
    value: IntegrationCategoryType.PROJECT_MANAGEMENT,
  },
  {
    title: 'objects.integrationCategories.ticketing',
    subtitle: 'objects.integrationCategories.ticketingSubtitle',
    value: IntegrationCategoryType.TICKETING,
  },
  {
    title: 'objects.integrationCategories.crm',
    subtitle: 'objects.integrationCategories.crmSubtitle',
    value: IntegrationCategoryType.CRM,
  },
  {
    title: 'objects.integrationCategories.marketing',
    subtitle: 'objects.integrationCategories.marketingSubtitle',
    value: IntegrationCategoryType.MARKETING,
  },
  {
    title: 'objects.integrationCategories.ats',
    subtitle: 'objects.integrationCategories.atsSubtitle',
    value: IntegrationCategoryType.ATS,
  },
  {
    title: 'objects.integrationCategories.development',
    subtitle: 'objects.integrationCategories.developmentSubtitle',
    value: IntegrationCategoryType.DEVELOPMENT,
  },
  {
    title: 'objects.integrationCategories.finance',
    subtitle: 'objects.integrationCategories.financeSubtitle',
    value: IntegrationCategoryType.FINANCE,
  },
  {
    title: 'labels.storage',
    subtitle: 'objects.integrationCategories.storageSubtitle',
    value: IntegrationCategoryType.STORAGE,
  },
  {
    title: 'objects.integrationCategories.others',
    subtitle: 'objects.integrationCategories.othersSubtitle',
    value: IntegrationCategoryType.OTHERS,
  },
]

export const allIntegrations: IntegrationItemType[] = [
  // Database
  {
    title: 'objects.syncData.mysql',
    subType: ClientType.MYSQL,
    icon: iconMap.mysql,
    type: IntegrationCategoryType.DATABASE,
    isAvailable: true,
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },
  {
    title: 'objects.syncData.postgreSQL',
    subType: ClientType.PG,
    icon: iconMap.postgreSql,
    type: IntegrationCategoryType.DATABASE,
    isAvailable: true,
  },
  {
    title: 'objects.syncData.sqlite',
    subType: ClientType.SQLITE,
    icon: iconMap.sqlServer,
    type: IntegrationCategoryType.DATABASE,
    isAvailable: true,
    isOssOnly: true,
  },
  {
    title: 'objects.syncData.snowflake',
    subType: ClientType.SNOWFLAKE,
    icon: iconMap.snowflake,
    type: IntegrationCategoryType.DATABASE,
  },
  {
    title: 'objects.syncData.dataBricks',
    subType: ClientType.DATABRICKS,
    icon: iconMap.dataBricks,
    type: IntegrationCategoryType.DATABASE,
  },
  {
    title: 'objects.syncData.mssqlServer',
    subType: ClientType.MSSQL,
    icon: iconMap.mssqlServer,
    type: IntegrationCategoryType.DATABASE,
  },
  {
    title: 'objects.syncData.oracle',
    subType: SyncDataType.ORACLE,
    icon: iconMap.oracle,
    type: IntegrationCategoryType.DATABASE,
  },

  // AI
  {
    title: 'objects.syncData.claude',
    subType: SyncDataType.CLAUDE,
    icon: iconMap.claude,
    type: `${IntegrationCategoryType.AI}-coming-soon`,
  },
  {
    title: 'objects.syncData.ollama',
    subType: SyncDataType.OLLAMA,
    icon: iconMap.ollama,
    type: `${IntegrationCategoryType.AI}-coming-soon`,
  },
  {
    title: 'objects.syncData.groq',
    subType: SyncDataType.GROQ,
    icon: iconMap.groq,
    type: `${IntegrationCategoryType.AI}-coming-soon`,
  },

  // Communication
  {
    title: 'general.slack',
    subType: SyncDataType.SLACK,
    icon: iconMap.slack,
    type: IntegrationCategoryType.COMMUNICATION,
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },
  {
    title: 'general.discord',
    subType: SyncDataType.DISCORD,
    icon: iconMap.ncDiscord,
    type: IntegrationCategoryType.COMMUNICATION,
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },
  {
    title: 'general.twilio',
    subType: SyncDataType.TWILLO,
    icon: iconMap.twilio,
    type: IntegrationCategoryType.COMMUNICATION,
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },

  {
    title: 'objects.syncData.microsoftOutlook',
    subType: SyncDataType.MICROSOFT_OUTLOOK,
    icon: iconMap.microsoftOutlook,
    type: IntegrationCategoryType.COMMUNICATION,
  },
  {
    title: 'general.microsoftTeams',
    subType: SyncDataType.MICROSOFT_TEAMS,
    icon: iconMap.microsoftTeams,
    type: IntegrationCategoryType.COMMUNICATION,
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },
  {
    title: 'objects.syncData.gmail',
    subType: SyncDataType.GMAIL,
    icon: iconMap.gmail,
    type: IntegrationCategoryType.COMMUNICATION,
  },
  {
    title: 'objects.syncData.telegram',
    subType: SyncDataType.TELEGRAM,
    icon: iconMap.telegram,
    type: IntegrationCategoryType.COMMUNICATION,
  },
  {
    title: 'objects.syncData.whatsapp',
    subType: SyncDataType.WHATSAPP,
    icon: iconMap.whatsappSolid,
    type: IntegrationCategoryType.COMMUNICATION,
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },

  // Project Management
  {
    title: 'objects.syncData.asana',
    subType: SyncDataType.ASANA,
    icon: iconMap.asana,
    type: IntegrationCategoryType.PROJECT_MANAGEMENT,
  },
  {
    title: 'objects.syncData.jira',
    subType: SyncDataType.JIRA,
    icon: iconMap.jira,
    type: IntegrationCategoryType.PROJECT_MANAGEMENT,
  },
  {
    title: 'objects.syncData.miro',
    subType: SyncDataType.MIRO,
    icon: iconMap.miro,
    type: IntegrationCategoryType.PROJECT_MANAGEMENT,
  },

  {
    title: 'objects.syncData.trello',
    subType: SyncDataType.TRELLO,
    icon: iconMap.trello,
    type: IntegrationCategoryType.PROJECT_MANAGEMENT,
  },

  // CRM
  {
    title: 'objects.syncData.salesforce',
    subType: SyncDataType.SALESFORCE,
    icon: iconMap.salesforce,
    type: IntegrationCategoryType.CRM,
  },
  {
    title: 'objects.syncData.hubspot',
    subType: SyncDataType.HUBSPOT,
    icon: iconMap.hubspot,
    type: IntegrationCategoryType.CRM,
  },
  {
    title: 'objects.syncData.pipedrive',
    subType: SyncDataType.PIPEDRIVE,
    icon: iconMap.pipedrive,
    type: IntegrationCategoryType.CRM,
  },
  {
    title: 'objects.syncData.microsoftDynamics365',
    subType: SyncDataType.MICROSOFT_DYNAMICS_365,
    icon: iconMap.microsoftDynamics365,
    type: IntegrationCategoryType.CRM,
  },
  {
    title: 'objects.syncData.zohoCrm',
    subType: SyncDataType.ZOHO_CRM,
    icon: iconMap.zohoCrm,
    type: IntegrationCategoryType.CRM,
  },

  // Marketing
  {
    title: 'objects.syncData.hubspot',
    subType: SyncDataType.HUBSPOT,
    icon: iconMap.hubspot,
    type: IntegrationCategoryType.MARKETING,
  },
  {
    title: 'objects.syncData.mailchimp',
    subType: SyncDataType.MAILCHIMP,
    icon: iconMap.mailchimp,
    type: IntegrationCategoryType.MARKETING,
  },
  {
    title: 'objects.syncData.surveyMonkey',
    subType: SyncDataType.SURVEYMONKEY,
    icon: iconMap.surveyMonkey,
    type: IntegrationCategoryType.MARKETING,
  },
  {
    title: 'objects.syncData.typeform',
    subType: SyncDataType.TYPEFORM,
    icon: iconMap.typeform,
    type: IntegrationCategoryType.MARKETING,
  },

  // ATS
  {
    title: 'objects.syncData.workday',
    subType: SyncDataType.WORKDAY,
    icon: iconMap.workday,
    type: IntegrationCategoryType.ATS,
  },
  {
    title: 'objects.syncData.greenhouse',
    subType: SyncDataType.GREENHOUSE,
    icon: iconMap.greenhouse,
    type: IntegrationCategoryType.ATS,
  },
  {
    title: 'objects.syncData.lever',
    subType: SyncDataType.LEVER,
    icon: iconMap.lever,
    type: IntegrationCategoryType.ATS,
  },

  // Development
  {
    title: 'objects.syncData.bitbucket',
    subType: SyncDataType.BITBUCKET,
    icon: iconMap.bitBucket,
    type: IntegrationCategoryType.DEVELOPMENT,
  },
  {
    title: 'objects.syncData.github',
    subType: SyncDataType.GITHUB,
    icon: iconMap.githubSolid,
    type: IntegrationCategoryType.DEVELOPMENT,
  },
  {
    title: 'objects.syncData.gitlab',
    subType: SyncDataType.GITLAB,
    icon: iconMap.gitlab,
    type: IntegrationCategoryType.DEVELOPMENT,
  },

  // Finance
  {
    title: 'objects.syncData.stripe',
    subType: SyncDataType.STRIPE,
    icon: iconMap.stripe,
    type: IntegrationCategoryType.FINANCE,
  },
  {
    title: 'objects.syncData.quickbooks',
    subType: SyncDataType.QUICKBOOKS,
    icon: iconMap.quickbooks,
    type: IntegrationCategoryType.FINANCE,
  },

  // Ticketing
  {
    title: 'objects.syncData.freshdesk',
    value: SyncDataType.FRESHDESK,
    icon: iconMap.freshdesk,
    categories: [IntegrationCategoryType.TICKETING],
  },
  {
    title: 'objects.syncData.intercom',
    subType: SyncDataType.INTERCOM,
    icon: iconMap.intercom,
    type: IntegrationCategoryType.TICKETING,
  },
  {
    title: 'objects.syncData.zendesk',
    subType: SyncDataType.ZENDESK,
    icon: iconMap.zendesk,
    type: IntegrationCategoryType.TICKETING,
  },
  {
    title: 'objects.syncData.salesforce',
    subtitle: 'objects.syncData.serviceCloud',
    value: SyncDataType.SALESFORCE_SERVICE_CLOUD,
    icon: iconMap.salesforce,
    categories: [IntegrationCategoryType.TICKETING],
  },
  {
    title: 'objects.syncData.hubspot',
    subtitle: 'objects.syncData.serviceHub',
    value: SyncDataType.HUBSPOT_SERVICE_HUB,
    icon: iconMap.hubspot,
    categories: [IntegrationCategoryType.TICKETING],
  },

  // Storage
  { title: 'objects.syncData.box', subType: SyncDataType.BOX, icon: iconMap.box, type: IntegrationCategoryType.STORAGE },
  {
    title: 'objects.syncData.dropbox',
    subType: SyncDataType.DROPBOX,
    icon: iconMap.dropbox,
    type: IntegrationCategoryType.STORAGE,
  },
  {
    title: 'objects.syncData.googleDrive',
    subType: SyncDataType.GOOGLE_DRIVE,
    icon: iconMap.googleDrive,
    type: IntegrationCategoryType.STORAGE,
  },

  // Spreadsheet
  {
    title: 'objects.syncData.appleNumbers',
    subType: SyncDataType.APPLE_NUMBERS,
    icon: iconMap.appleSolid,
    type: IntegrationCategoryType.SPREAD_SHEET,
  },
  {
    title: 'objects.syncData.microsoftExcel',
    subType: SyncDataType.MICROSOFT_EXCEL,
    icon: iconMap.microsoftExcel,
    type: IntegrationCategoryType.SPREAD_SHEET,
  },
  {
    title: 'objects.syncData.googleSheets',
    subType: SyncDataType.GOOGLE_SHEETS,
    icon: iconMap.googleSheet,
    type: IntegrationCategoryType.SPREAD_SHEET,
  },

  // Others
  // {
  //   title: 'objects.syncData.googleCalendar',
  //   subType: SyncDataType.GOOGLE_CALENDAR,
  //   icon: iconMap.googleCalendar,
  //   type: IntegrationCategoryType.OTHERS,
  // },
]

export const allIntegrationsMapByValue = allIntegrations.reduce((acc, curr) => {
  acc[curr.subType] = curr
  return acc
}, {} as Record<string, IntegrationItemType>)
