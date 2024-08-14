import type { CSSProperties, FunctionalComponent, SVGAttributes } from 'nuxt/dist/app/compat/capi'
import { ClientType, IntegrationCategoryType, SyncDataType } from '~/lib/enums'

export interface IntegrationItemType {
  title: string
  icon: FunctionalComponent<SVGAttributes, {}, any, {}>
  value: SyncDataType | ClientType
  categories: IntegrationCategoryType[]
  isAvailable?: boolean
  iconStyle?: CSSProperties
}

export interface IntegrationCategoryItemType {
  title: string
  subtitle: string
  value: IntegrationCategoryType
  icon: FunctionalComponent<SVGAttributes, {}, any, {}>
  iconBgColor?: string
  iconStyle?: CSSProperties
  isAvailable?: boolean
}

export const integrationCategories: IntegrationCategoryItemType[] = [
  {
    title: 'labels.database',
    subtitle: 'objects.integrationCategories.databaseSubtitle',
    value: IntegrationCategoryType.DATABASE,
    icon: iconMap.database,
    iconBgColor: '#D4F7E0',
    iconStyle: {
      color: '#17803D',
    },
    isAvailable: true,
  },
  {
    title: 'objects.integrationCategories.ai',
    subtitle: 'objects.integrationCategories.ai',
    value: IntegrationCategoryType.AI,
    icon: iconMap.openai,
    iconBgColor: '#FFF0F7',
    iconStyle: {
      color: '#801044',
    },
  },
  {
    title: 'objects.integrationCategories.communication',
    subtitle: 'objects.integrationCategories.communicationSubtitle',
    value: IntegrationCategoryType.COMMUNICATION,
    icon: iconMap.messageCircle,
    iconBgColor: '#FFF0F7',
    iconStyle: {
      color: '#801044',
    },
  },
  {
    title: 'objects.integrationCategories.spreadSheet',
    subtitle: 'objects.integrationCategories.spreadSheetSubtitle',
    value: IntegrationCategoryType.SPREAD_SHEET,
    icon: iconMap.viewGannt,
    iconBgColor: '#FFF0D1',
    iconStyle: {
      color: '#977223',
    },
  },
  {
    title: 'objects.integrationCategories.projectManagement',
    subtitle: 'objects.integrationCategories.projectManagementSubtitle',
    value: IntegrationCategoryType.PROJECT_MANAGEMENT,
    icon: iconMap.viewGannt,
    iconBgColor: '#FFF0D1',
    iconStyle: {
      color: '#977223',
    },
  },
  {
    title: 'objects.integrationCategories.ticketing',
    subtitle: 'objects.integrationCategories.ticketingSubtitle',
    value: IntegrationCategoryType.TICKETING,
    icon: iconMap.globe,
    iconBgColor: '#FFF0D1',
    iconStyle: {
      color: '#977223',
    },
  },
  {
    title: 'objects.integrationCategories.crm',
    subtitle: 'objects.integrationCategories.crmSubtitle',
    value: IntegrationCategoryType.CRM,
    icon: iconMap.users,
    iconBgColor: '#D7F2FF',
    iconStyle: {
      color: '#207399',
    },
  },
  {
    title: 'objects.integrationCategories.marketing',
    subtitle: 'objects.integrationCategories.marketingSubtitle',
    value: IntegrationCategoryType.MARKETING,
    icon: iconMap.heart,
    iconBgColor: '#FED8F4',
    iconStyle: {
      color: '#972377',
    },
  },
  {
    title: 'objects.integrationCategories.ats',
    subtitle: 'objects.integrationCategories.atsSubtitle',
    value: IntegrationCategoryType.ATS,
    icon: iconMap.multiFile,
    iconBgColor: '#FEE6D6',
    iconStyle: {
      color: '#C86827',
    },
  },
  {
    title: 'objects.integrationCategories.development',
    subtitle: 'objects.integrationCategories.developmentSubtitle',
    value: IntegrationCategoryType.DEVELOPMENT,
    icon: iconMap.code,
    iconBgColor: '#E5D4F5',
    iconStyle: {
      color: '#4B177B',
    },
  },
  {
    title: 'objects.integrationCategories.finance',
    subtitle: 'objects.integrationCategories.financeSubtitle',
    value: IntegrationCategoryType.FINANCE,
    icon: iconMap.dollerSign,
    iconBgColor: '#D4F7E0',
    iconStyle: {
      color: '#17803D',
    },
  },
  {
    title: 'labels.storage',
    subtitle: 'objects.integrationCategories.storageSubtitle',
    value: IntegrationCategoryType.STORAGE,
    icon: iconMap.ncSave,
    iconBgColor: '#E7E7E9',
    iconStyle: {
      color: '#374151',
    },
  },
  {
    title: 'objects.integrationCategories.others',
    subtitle: 'objects.integrationCategories.othersSubtitle',
    value: IntegrationCategoryType.OTHERS,
    icon: iconMap.plusSquare,
    iconBgColor: 'white',
    iconStyle: {
      color: '#374151',
    },
  },
]

export const allIntegrations: IntegrationItemType[] = [
  // Database
  {
    title: 'objects.syncData.mysql',
    value: ClientType.MYSQL,
    icon: iconMap.mysql,
    categories: [IntegrationCategoryType.DATABASE],
    isAvailable: true,
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },
  {
    title: 'objects.syncData.postgreSQL',
    value: ClientType.PG,
    icon: iconMap.postgreSql,
    categories: [IntegrationCategoryType.DATABASE],
    isAvailable: true,
  },
  {
    title: 'objects.syncData.snowflake',
    value: ClientType.SNOWFLAKE,
    icon: iconMap.snowflake,
    categories: [IntegrationCategoryType.DATABASE],
  },
  {
    title: 'objects.syncData.dataBricks',
    value: ClientType.DATABRICKS,
    icon: iconMap.dataBricks,
    categories: [IntegrationCategoryType.DATABASE],
  },
  {
    title: 'objects.syncData.mssqlServer',
    value: ClientType.MSSQL,
    icon: iconMap.mssqlServer,
    categories: [IntegrationCategoryType.DATABASE],
  },
  {
    title: 'objects.syncData.oracle',
    value: SyncDataType.ORACLE,
    icon: iconMap.oracle,
    categories: [IntegrationCategoryType.DATABASE],
  },

  // AI
  {
    title: 'objects.syncData.openai',
    value: SyncDataType.OPENAI,
    icon: iconMap.openai,
    categories: [IntegrationCategoryType.AI],
  },
  {
    title: 'objects.syncData.claude',
    value: SyncDataType.CLAUDE,
    icon: iconMap.claude,
    categories: [IntegrationCategoryType.AI],
  },
  {
    title: 'objects.syncData.ollama',
    value: SyncDataType.OLLAMA,
    icon: iconMap.ollama,
    categories: [IntegrationCategoryType.AI],
  },
  {
    title: 'objects.syncData.groq',
    value: SyncDataType.GROQ,
    icon: iconMap.groq,
    categories: [IntegrationCategoryType.AI],
  },

  // Communication
  {
    title: 'general.slack',
    value: SyncDataType.SLACK,
    icon: iconMap.slack,
    categories: [IntegrationCategoryType.COMMUNICATION],
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },
  {
    title: 'general.discord',
    value: SyncDataType.DISCORD,
    icon: iconMap.ncDiscord,
    categories: [IntegrationCategoryType.COMMUNICATION],
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },
  {
    title: 'general.twilio',
    value: SyncDataType.TWILLO,
    icon: iconMap.twilio,
    categories: [IntegrationCategoryType.COMMUNICATION],
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },

  {
    title: 'objects.syncData.microsoftOutlook',
    value: SyncDataType.MICROSOFT_OUTLOOK,
    icon: iconMap.microsoftOutlook,
    categories: [IntegrationCategoryType.COMMUNICATION],
  },
  {
    title: 'general.microsoftTeams',
    value: SyncDataType.MICROSOFT_TEAMS,
    icon: iconMap.microsoftTeams,
    categories: [IntegrationCategoryType.COMMUNICATION],
    iconStyle: {
      width: '32px',
      height: '32px',
    },
  },
  {
    title: 'objects.syncData.gmail',
    value: SyncDataType.GMAIL,
    icon: iconMap.gmail,
    categories: [IntegrationCategoryType.COMMUNICATION],
  },
  {
    title: 'objects.syncData.telegram',
    value: SyncDataType.TELEGRAM,
    icon: iconMap.telegram,
    categories: [IntegrationCategoryType.COMMUNICATION],
  },
  {
    title: 'objects.syncData.whatsapp',
    value: SyncDataType.WHATSAPP,
    icon: iconMap.whatsappSolid,
    categories: [IntegrationCategoryType.COMMUNICATION],
    iconStyle: {
      width: '32px',
      height: '32px',
    },
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
    title: 'objects.syncData.trello',
    value: SyncDataType.TRELLO,
    icon: iconMap.trello,
    categories: [IntegrationCategoryType.PROJECT_MANAGEMENT],
  },

  // CRM
  {
    title: 'objects.syncData.salesforce',
    value: SyncDataType.SALESFORCE,
    icon: iconMap.salesforce,
    categories: [IntegrationCategoryType.CRM],
  },
  {
    title: 'objects.syncData.hubspot',
    value: SyncDataType.HUBSPOT,
    icon: iconMap.hubspot,
    categories: [IntegrationCategoryType.CRM],
  },
  {
    title: 'objects.syncData.pipedrive',
    value: SyncDataType.PIPEDRIVE,
    icon: iconMap.pipedrive,
    categories: [IntegrationCategoryType.CRM],
  },
  {
    title: 'objects.syncData.microsoftDynamics365',
    value: SyncDataType.MICROSOFT_DYNAMICS_365,
    icon: iconMap.microsoftDynamics365,
    categories: [IntegrationCategoryType.CRM],
  },
  {
    title: 'objects.syncData.zohoCrm',
    value: SyncDataType.ZOHO_CRM,
    icon: iconMap.zohoCrm,
    categories: [IntegrationCategoryType.CRM],
  },

  // Marketing
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
  {
    title: 'objects.syncData.greenhouse',
    value: SyncDataType.GREENHOUSE,
    icon: iconMap.greenhouse,
    categories: [IntegrationCategoryType.ATS],
  },
  {
    title: 'objects.syncData.lever',
    value: SyncDataType.LEVER,
    icon: iconMap.lever,
    categories: [IntegrationCategoryType.ATS],
  },

  // Development
  {
    title: 'objects.syncData.bitbucket',
    value: SyncDataType.BITBUCKET,
    icon: iconMap.bitBucket,
    categories: [IntegrationCategoryType.DEVELOPMENT],
  },
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
  {
    title: 'objects.syncData.quickbooks',
    value: SyncDataType.QUICKBOOKS,
    icon: iconMap.quickbooks,
    categories: [IntegrationCategoryType.FINANCE],
  },

  // Ticketing
  {
    title: 'objects.syncData.intercom',
    value: SyncDataType.INTERCOM,
    icon: iconMap.intercom,
    categories: [IntegrationCategoryType.TICKETING],
  },
  {
    title: 'objects.syncData.zendesk',
    value: SyncDataType.ZENDESK,
    icon: iconMap.zendesk,
    categories: [IntegrationCategoryType.TICKETING],
  },

  // Storage
  { title: 'objects.syncData.box', value: SyncDataType.BOX, icon: iconMap.box, categories: [IntegrationCategoryType.STORAGE] },
  {
    title: 'objects.syncData.dropbox',
    value: SyncDataType.DROPBOX,
    icon: iconMap.dropbox,
    categories: [IntegrationCategoryType.STORAGE],
  },
  {
    title: 'objects.syncData.googleDrive',
    value: SyncDataType.GOOGLE_DRIVE,
    icon: iconMap.googleDrive,
    categories: [IntegrationCategoryType.STORAGE],
  },

  // Others
  {
    title: 'objects.syncData.appleNumbers',
    value: SyncDataType.APPLE_NUMBERS,
    icon: iconMap.appleSolid,
    categories: [IntegrationCategoryType.SPREAD_SHEET],
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
    categories: [IntegrationCategoryType.SPREAD_SHEET],
  },
  {
    title: 'objects.syncData.googleSheets',
    value: SyncDataType.GOOGLE_SHEETS,
    icon: iconMap.googleSheet,
    categories: [IntegrationCategoryType.SPREAD_SHEET],
  },
]
