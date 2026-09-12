import type { BaseType, SourceType } from 'nocodb-sdk'
import { ManagedAppCategory, parseProp } from 'nocodb-sdk'
import { getI18n } from '~/plugins/a.i18n'

const isDefaultBase = (source: SourceType) => source.is_meta

/**
 * Represents the schema prompts for creating various AI base schemas.
 * Each object has a `tag` that identifies the schema type and a `description`
 * that explains its purpose.
 */
export const aiBaseSchemaPrompts: { tag: string; description: string }[] = [
  {
    tag: 'Project Management',
    description: 'Streamline project management by organizing tasks, assigning responsibilities, and tracking progress.',
  },
  {
    tag: 'CRM',
    description: 'Manage customer relationships, monitor leads, and track sales activities with actionable insights.',
  },
  {
    tag: 'Marketing campaigns',
    description: 'Plan, launch, and monitor multi-channel campaigns, while analyzing performance metrics in real-time.',
  },
  {
    tag: 'Content roadmap',
    description:
      'Organize and schedule content across platforms to maintain consistent brand communication and track publishing timelines.',
  },
  {
    tag: 'Resource allocation',
    description:
      'Manage team capacity and optimize resource allocation to ensure efficient project staffing and task distribution.',
  },
  {
    tag: 'Inventory Management',
    description:
      'Track stock levels, sales, and orders to maintain seamless inventory management and avoid stockouts or overstocking.',
  },
  {
    tag: 'Product Roadmap',
    description: 'Visualize product development stages, set priorities, and track progress toward key milestones and deadlines.',
  },
  {
    tag: 'User research',
    description: 'Collect and analyze user feedback to gain valuable insights for improving products and services.',
  },
  {
    tag: 'Application tracking',
    description:
      'Streamline the hiring process by managing candidate applications, scheduling interviews, and tracking hiring outcomes.',
  },
  {
    tag: 'Vendor Management',
    description:
      'Maintain vendor relationships, track contracts, and efficiently manage procurement requests and vendor communications.',
  },
  {
    tag: 'Asset Library',
    description: 'Centralize digital assets like images and videos for easy access, organization, and sharing across teams.',
  },
  {
    tag: 'Event Planning',
    description:
      'Coordinate every aspect of event logistics, from scheduling and budgeting to vendor management and attendee engagement.',
  },
  {
    tag: 'Tickets & requests',
    description:
      'Efficiently manage customer support by organizing and resolving tickets, ensuring timely responses to inquiries.',
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

export const extractAiBaseCreateQueryParams = (query: any) => {
  const searchQuery = {} as Record<string, string>

  if (query?.basePrompt) {
    searchQuery.basePrompt = query?.basePrompt as string
  }

  if (query?.baseName) {
    searchQuery.baseName = query?.baseName as string
  }

  return searchQuery
}

/** Display label for a stored category key. Legacy freeform values fall back to the raw text. */
export const managedAppCategoryLabel = (key: string) => {
  const trimmed = key.trim()
  if (!trimmed) return ''

  if (!(Object.values(ManagedAppCategory) as string[]).includes(trimmed.toLowerCase())) return trimmed

  const { t } = getI18n().global
  return t(`objects.appCategories.${trimmed.toLowerCase()}`)
}

/** `ManagedAppType.categories` → display labels. */
export const managedAppCategoryLabels = (categories?: ManagedAppCategory[] | null) =>
  (categories || []).map(managedAppCategoryLabel).filter(Boolean)

export const managedAppCategoryOptions = () =>
  Object.values(ManagedAppCategory).map((value) => ({ value, label: managedAppCategoryLabel(value) }))

export const suggestManagedAppNextVersion = (currentVersion?: string) => {
  if (!currentVersion) {
    return '1.0.0'
  }

  const versionParts = currentVersion.split('.')

  if (versionParts.length === 3) {
    // Increment minor version for new draft
    versionParts[1] = String(Number(versionParts[1]) + 1)
    versionParts[2] = '0'
    return versionParts.join('.')
  } else {
    return ''
  }
}

/**
 * `base.meta.appFirst` — the base was created through the App or Website build
 * flow, so its app leads the mini sidebar instead of trailing Data/Workflows/Interfaces.
 * Written once at creation; users reorder nothing.
 */
export const BASE_META_APP_FIRST = 'appFirst'

export const isAppFirstBase = (base?: Pick<BaseType, 'meta'> | null) => !!parseProp(base?.meta)?.[BASE_META_APP_FIRST]
