import type { SourceType } from 'nocodb-sdk'

const isDefaultBase = (source: SourceType) => source.is_meta

export const predefinedAiBasePrompts = {
  'Project Management': 'Manage tasks, timelines, and project milestones across teams.',
  'CRM': 'Keep track of customers and leads, monitor sales activities, and maintain customer relationships.',
  'Marketing campaigns': 'Track and analyze marketing efforts, manage campaign timelines, and assess performance metrics.',
  'Content roadmap': 'Plan and organize content strategies, maintain editorial calendars, and track publishing workflows.',
  'Inventory Management': 'Monitor stock levels, manage product inventories, and track supply chain operations.',
  'Roadmap': 'Define product or project roadmaps, track development progress, and ensure alignment with goals.',
  'User research': 'Collect and organize research data, track participant feedback, and manage usability studies.',
  'Application tracking': 'Manage job applications, track candidates, and maintain hiring pipelines.',
  'Vendor Management': 'Track vendor relationships, manage contracts, and oversee procurement processes.',
  'Asset Library': 'Organize and manage digital assets such as images, videos, and documents.',
  'Event Planning': 'Plan, organize, and manage events, including scheduling, resources, and task delegation.',
  'Tickets & requests': 'Track and manage tickets or requests for support, maintenance, or service inquiries.',
}

export const reversePredefinedAiBasePrompts = Object.fromEntries(
  Object.entries(predefinedAiBasePrompts).map(([key, value]) => [value, key]),
)

export { isDefaultBase }
