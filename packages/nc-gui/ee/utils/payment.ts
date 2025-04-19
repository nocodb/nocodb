export interface PlanFeatureAndLimitsItemType {
  title: string
  free: string | boolean
  team: string | boolean
  business: string | boolean
  enterprise: string | boolean
}

export interface PlanFeatureAndLimitsType {
  sectionName: string
  features: PlanFeatureAndLimitsItemType[]
}

export const planFeatureAndLimits: PlanFeatureAndLimitsType[] = [
  {
    sectionName: 'General',
    features: [
      {
        title: 'Bases',
        free: 'Unlimited',
        team: 'Unlimited',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        title: 'Records',
        free: '1000',
        team: '100,000',
        business: '500,000',
        enterprise: 'Unlimited',
      },
      {
        title: 'Editors',
        free: '5',
        team: '20',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        title: 'Viewers',
        free: '50',
        team: 'Unlimited',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        title: 'Attachments',
        free: '1 GB',
        team: '20 GB',
        business: '100 GB',
        enterprise: '1000 GB',
      },
      {
        title: 'Record Audit',
        free: '2 weeks',
        team: '1 year',
        business: '2 years',
        enterprise: '3+ years',
      },
      {
        title: 'Base Snapshots',
        free: '5',
        team: '20',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
    ],
  },
  {
    sectionName: 'Views',
    features: [
      {
        title: 'Grid',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Kanban',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Gallery',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Forms',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Calendar',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Locked View',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Personal View',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Forms',
    features: [
      {
        title: 'Theme',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Email Responces',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Prefilled Forms',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Custom logo & banner',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Hide NocoDB Branding',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Redirect to URL',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Input Validations',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Conditional field visibility',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Automations',
    features: [
      {
        title: 'Webhooks',
        free: '3',
        team: 'Unlimited',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        title: 'Triggers/month',
        free: '100',
        team: '25,000',
        business: '100,000',
        enterprise: '500,000',
      },
      {
        title: 'Webhook Logs',
        free: '1 week',
        team: '3 months',
        business: '2 years',
        enterprise: '3+ years',
      },
      {
        title: 'Conditional Webhooks',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Custom Payload',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Advanced',
    features: [
      {
        title: 'Dynamic filters for linked records',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Aggregations',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Group Aggregations',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Extensions',
        free: '1',
        team: 'Unlimited',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        title: 'Sync',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
      {
        title: 'Scripts',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Share',
    features: [
      {
        title: 'Custom URL',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Password Protected',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Developer Platform',
    features: [
      {
        title: 'Rest API',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Swagger specification',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'API Snippets',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'API calls/month',
        free: '1,000',
        team: '1,000,000',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
    ],
  },
  {
    sectionName: 'Collaboration',
    features: [
      {
        title: 'Role base permissions',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Notifications',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Record Comments',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Access Control',
    features: [
      {
        title: 'Table Permissions',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'View Permissions',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Field Permissions',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Row Permissions',
        free: false,
        team: false,
        business: true,
        enterprise: true,
      },
      {
        title: 'Custom Roles',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Integrations',
    features: [
      {
        title: 'Postgress & MySQL',
        free: '1',
        team: '1',
        business: '10',
        enterprise: 'Unlimited',
      },
      {
        title: 'Open AI/ Claude/ Ollama/ Grok',
        free: false,
        team: '1',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
    ],
  },
  {
    sectionName: 'Admin',
    features: [
      {
        title: 'SSO',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Admin Panel',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
      {
        title: 'Workspace Audit',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
      {
        title: '2FA',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
      {
        title: 'API Token Permissions',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Support',
    features: [
      {
        title: 'Help center and community',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Email Support',
        free: false,
        team: false,
        business: true,
        enterprise: true,
      },
      {
        title: 'Priority support',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
    ],
  },
]
