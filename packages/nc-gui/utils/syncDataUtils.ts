import type { FormDefinition } from 'nocodb-sdk'
import type { VNode } from '@vue/runtime-dom'
import type { CSSProperties, FunctionalComponent, SVGAttributes } from 'nuxt/dist/app/compat/capi'
import { ClientType, IntegrationCategoryType, SyncDataType } from '#imports'

export const integrationsInitialized = ref(false)
export interface IntegrationItemType {
  title: string
  icon: FunctionalComponent<SVGAttributes, {}, any, {}> | VNode
  sub_type: SyncDataType | ClientType
  type: IntegrationCategoryType
  isAvailable?: boolean
  iconStyle?: CSSProperties
  isOssOnly?: boolean
  subtitle?: string
  dynamic?: boolean
  hidden?: boolean
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
    title: 'objects.syncData.nocodb',
    sub_type: SyncDataType.NOCODB,
    icon: iconMap.nocodbPg,
    type: IntegrationCategoryType.DATABASE,
    isAvailable: true,
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },
  {
    title: 'objects.syncData.mysql',
    sub_type: ClientType.MYSQL,
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
    sub_type: ClientType.PG,
    icon: iconMap.postgreSql,
    type: IntegrationCategoryType.DATABASE,
    isAvailable: true,
  },
  {
    title: 'objects.syncData.sqlite',
    sub_type: ClientType.SQLITE,
    icon: iconMap.sqlServer,
    type: IntegrationCategoryType.DATABASE,
    isAvailable: true,
    isOssOnly: true,
  },
  {
    title: 'objects.syncData.snowflake',
    sub_type: ClientType.SNOWFLAKE,
    icon: iconMap.snowflake,
    type: IntegrationCategoryType.DATABASE,
  },
  {
    title: 'objects.syncData.dataBricks',
    sub_type: ClientType.DATABRICKS,
    icon: iconMap.dataBricks,
    type: IntegrationCategoryType.DATABASE,
  },
  {
    title: 'objects.syncData.mssqlServer',
    sub_type: ClientType.MSSQL,
    icon: iconMap.mssqlServer,
    type: IntegrationCategoryType.DATABASE,
  },
  {
    title: 'objects.syncData.oracle',
    sub_type: SyncDataType.ORACLE,
    icon: iconMap.oracle,
    type: IntegrationCategoryType.DATABASE,
  },

  // Communication
  {
    title: 'general.slack',
    sub_type: SyncDataType.SLACK,
    icon: iconMap.slack,
    type: IntegrationCategoryType.COMMUNICATION,
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },
  {
    title: 'general.discord',
    sub_type: SyncDataType.DISCORD,
    icon: iconMap.ncDiscord,
    type: IntegrationCategoryType.COMMUNICATION,
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },
  {
    title: 'general.twilio',
    sub_type: SyncDataType.TWILLO,
    icon: iconMap.twilio,
    type: IntegrationCategoryType.COMMUNICATION,
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },

  {
    title: 'objects.syncData.microsoftOutlook',
    sub_type: SyncDataType.MICROSOFT_OUTLOOK,
    icon: iconMap.microsoftOutlook,
    type: IntegrationCategoryType.COMMUNICATION,
  },
  {
    title: 'general.microsoftTeams',
    sub_type: SyncDataType.MICROSOFT_TEAMS,
    icon: iconMap.microsoftTeams,
    type: IntegrationCategoryType.COMMUNICATION,
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },
  {
    title: 'objects.syncData.gmail',
    sub_type: SyncDataType.GMAIL,
    icon: iconMap.gmail,
    type: IntegrationCategoryType.COMMUNICATION,
  },
  {
    title: 'objects.syncData.telegram',
    sub_type: SyncDataType.TELEGRAM,
    icon: iconMap.telegram,
    type: IntegrationCategoryType.COMMUNICATION,
  },
  {
    title: 'objects.syncData.whatsapp',
    sub_type: SyncDataType.WHATSAPP,
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
    sub_type: SyncDataType.ASANA,
    icon: iconMap.asana,
    type: IntegrationCategoryType.PROJECT_MANAGEMENT,
  },
  {
    title: 'objects.syncData.jira',
    sub_type: SyncDataType.JIRA,
    icon: iconMap.jira,
    type: IntegrationCategoryType.PROJECT_MANAGEMENT,
  },
  {
    title: 'objects.syncData.miro',
    sub_type: SyncDataType.MIRO,
    icon: iconMap.miro,
    type: IntegrationCategoryType.PROJECT_MANAGEMENT,
  },

  {
    title: 'objects.syncData.trello',
    sub_type: SyncDataType.TRELLO,
    icon: iconMap.trello,
    type: IntegrationCategoryType.PROJECT_MANAGEMENT,
  },

  // CRM
  {
    title: 'objects.syncData.salesforce',
    sub_type: SyncDataType.SALESFORCE,
    icon: iconMap.salesforce,
    type: IntegrationCategoryType.CRM,
  },
  {
    title: 'objects.syncData.hubspot',
    sub_type: SyncDataType.HUBSPOT,
    icon: iconMap.hubspot,
    type: IntegrationCategoryType.CRM,
  },
  {
    title: 'objects.syncData.pipedrive',
    sub_type: SyncDataType.PIPEDRIVE,
    icon: iconMap.pipedrive,
    type: IntegrationCategoryType.CRM,
  },
  {
    title: 'objects.syncData.microsoftDynamics365',
    sub_type: SyncDataType.MICROSOFT_DYNAMICS_365,
    icon: iconMap.microsoftDynamics365,
    type: IntegrationCategoryType.CRM,
  },
  {
    title: 'objects.syncData.zohoCrm',
    sub_type: SyncDataType.ZOHO_CRM,
    icon: iconMap.zohoCrm,
    type: IntegrationCategoryType.CRM,
  },

  // Marketing
  {
    title: 'objects.syncData.hubspot',
    sub_type: SyncDataType.HUBSPOT,
    icon: iconMap.hubspot,
    type: IntegrationCategoryType.MARKETING,
  },
  {
    title: 'objects.syncData.mailchimp',
    sub_type: SyncDataType.MAILCHIMP,
    icon: iconMap.mailchimp,
    type: IntegrationCategoryType.MARKETING,
  },
  {
    title: 'objects.syncData.surveyMonkey',
    sub_type: SyncDataType.SURVEYMONKEY,
    icon: iconMap.surveyMonkey,
    type: IntegrationCategoryType.MARKETING,
  },
  {
    title: 'objects.syncData.typeform',
    sub_type: SyncDataType.TYPEFORM,
    icon: iconMap.typeform,
    type: IntegrationCategoryType.MARKETING,
  },

  // ATS
  {
    title: 'objects.syncData.workday',
    sub_type: SyncDataType.WORKDAY,
    icon: iconMap.workday,
    type: IntegrationCategoryType.ATS,
  },
  {
    title: 'objects.syncData.greenhouse',
    sub_type: SyncDataType.GREENHOUSE,
    icon: iconMap.greenhouse,
    type: IntegrationCategoryType.ATS,
  },
  {
    title: 'objects.syncData.lever',
    sub_type: SyncDataType.LEVER,
    icon: iconMap.lever,
    type: IntegrationCategoryType.ATS,
  },

  // Development
  {
    title: 'objects.syncData.bitbucket',
    sub_type: SyncDataType.BITBUCKET,
    icon: iconMap.bitBucket,
    type: IntegrationCategoryType.DEVELOPMENT,
  },
  {
    title: 'objects.syncData.github',
    sub_type: SyncDataType.GITHUB,
    icon: iconMap.githubSolid,
    type: IntegrationCategoryType.DEVELOPMENT,
  },
  {
    title: 'objects.syncData.gitlab',
    sub_type: SyncDataType.GITLAB,
    icon: iconMap.gitlab,
    type: IntegrationCategoryType.DEVELOPMENT,
  },

  // Finance
  {
    title: 'objects.syncData.stripe',
    sub_type: SyncDataType.STRIPE,
    icon: iconMap.stripe,
    type: IntegrationCategoryType.FINANCE,
  },
  {
    title: 'objects.syncData.quickbooks',
    sub_type: SyncDataType.QUICKBOOKS,
    icon: iconMap.quickbooks,
    type: IntegrationCategoryType.FINANCE,
  },

  // Ticketing
  {
    title: 'objects.syncData.freshdesk',
    sub_type: SyncDataType.FRESHDESK,
    icon: iconMap.freshdesk,
    type: IntegrationCategoryType.TICKETING,
  },
  {
    title: 'objects.syncData.intercom',
    sub_type: SyncDataType.INTERCOM,
    icon: iconMap.intercom,
    type: IntegrationCategoryType.TICKETING,
  },
  {
    title: 'objects.syncData.zendesk',
    sub_type: SyncDataType.ZENDESK,
    icon: iconMap.zendesk,
    type: IntegrationCategoryType.TICKETING,
  },
  {
    title: 'objects.syncData.salesforce',
    subtitle: 'objects.syncData.serviceCloud',
    sub_type: SyncDataType.SALESFORCE_SERVICE_CLOUD,
    icon: iconMap.salesforce,
    type: IntegrationCategoryType.TICKETING,
  },
  {
    title: 'objects.syncData.hubspot',
    subtitle: 'objects.syncData.serviceHub',
    sub_type: SyncDataType.HUBSPOT_SERVICE_HUB,
    icon: iconMap.hubspot,
    type: IntegrationCategoryType.TICKETING,
  },

  // Storage
  { title: 'objects.syncData.box', sub_type: SyncDataType.BOX, icon: iconMap.box, type: IntegrationCategoryType.STORAGE },
  {
    title: 'objects.syncData.dropbox',
    sub_type: SyncDataType.DROPBOX,
    icon: iconMap.dropbox,
    type: IntegrationCategoryType.STORAGE,
  },
  {
    title: 'objects.syncData.googleDrive',
    sub_type: SyncDataType.GOOGLE_DRIVE,
    icon: iconMap.googleDrive,
    type: IntegrationCategoryType.STORAGE,
  },

  // Spreadsheet
  {
    title: 'objects.syncData.appleNumbers',
    sub_type: SyncDataType.APPLE_NUMBERS,
    icon: iconMap.appleSolid,
    type: IntegrationCategoryType.SPREAD_SHEET,
  },
  {
    title: 'objects.syncData.microsoftExcel',
    sub_type: SyncDataType.MICROSOFT_EXCEL,
    icon: iconMap.microsoftExcel,
    type: IntegrationCategoryType.SPREAD_SHEET,
  },
  {
    title: 'objects.syncData.googleSheets',
    sub_type: SyncDataType.GOOGLE_SHEETS,
    icon: iconMap.googleSheet,
    type: IntegrationCategoryType.SPREAD_SHEET,
  },

  // Others
  // {
  //   title: 'objects.syncData.googleCalendar',
  //   sub_type: SyncDataType.GOOGLE_CALENDAR,
  //   icon: iconMap.googleCalendar,
  //   type: IntegrationCategoryType.OTHERS,
  // },
]

export const allIntegrationsMapBySubType = allIntegrations.reduce((acc, integration) => {
  acc[integration.sub_type] = integration

  return acc
}, {} as Record<(typeof allIntegrations)[number]['sub_type'], IntegrationItemType>)
