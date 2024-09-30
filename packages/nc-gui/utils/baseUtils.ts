import type { SourceType } from 'nocodb-sdk'

const isDefaultBase = (source: SourceType) => source.is_meta

/**
 * Represents the schema prompts for creating various AI base schemas.
 * Each object has a `tag` that identifies the schema type and a `description`
 * that explains its purpose.
 */
export const aiBaseSchemaPrompts: { tag: string; description: string }[] = [
  { tag: 'Project Management', description: 'Manage tasks, timelines, and project milestones across teams.' },
  {
    tag: 'CRM',
    description: 'Keep track of customers and leads, monitor sales activities, and maintain customer relationships.',
  },
  {
    tag: 'Marketing campaigns',
    description: 'Track and analyze marketing efforts, manage campaign timelines, and assess performance metrics.',
  },
  {
    tag: 'Content roadmap',
    description: 'Plan and organize content strategies, maintain editorial calendars, and track publishing workflows.',
  },
  {
    tag: 'Inventory Management',
    description: 'Monitor stock levels, manage product inventories, and track supply chain operations.',
  },
  {
    tag: 'Roadmap',
    description: 'Define product or project roadmaps, track development progress, and ensure alignment with goals.',
  },
  {
    tag: 'User research',
    description: 'Collect and organize research data, track participant feedback, and manage usability studies.',
  },
  { tag: 'Application tracking', description: 'Manage job applications, track candidates, and maintain hiring pipelines.' },
  { tag: 'Vendor Management', description: 'Track vendor relationships, manage contracts, and oversee procurement processes.' },
  { tag: 'Asset Library', description: 'Organize and manage digital assets such as images, videos, and documents.' },
  {
    tag: 'Event Planning',
    description: 'Plan, organize, and manage events, including scheduling, resources, and task delegation.',
  },
  {
    tag: 'Tickets & requests',
    description: 'Track and manage tickets or requests for support, maintenance, or service inquiries.',
  },
]

/**
 * An object that maps schema tags to their corresponding descriptions.
 * This is useful for quickly accessing a description based on the tag.
 *
 * @example
 * aiBaseSchemaPromptsMap['CRM'] // 'Keep track of customers and leads, monitor sales activities, and maintain customer relationships.'
 */
export const aiBaseSchemaPromptsMap = Object.fromEntries(aiBaseSchemaPrompts.map(({ tag, description }) => [tag, description]))

/**
 * An object that maps descriptions to their corresponding tags.
 * This is useful for quickly accessing a tag based on the description.
 *
 * @example
 * aiBaseSchemaPromptsReverseMap['Keep track of customers and leads, monitor sales activities, and maintain customer relationships.'] // 'CRM'
 */
export const aiBaseSchemaPromptsReverseMap = Object.fromEntries(
  Object.entries(aiBaseSchemaPromptsMap).map(([tag, description]) => [description, tag]),
)

export { isDefaultBase }
