// based on source restriction decide the icon color
import type { SourceType } from 'nocodb-sdk'
import { clientTypes } from '~/utils/baseCreateUtils'

export const getSourceIconColor = (source: SourceType) => {
  if (source.is_schema_readonly && source.is_data_readonly) {
    return '#278bff'
  }
  if (source.is_schema_readonly) {
    return '#df830f'
  }
  return '#de0062'
}

// based on source restriction decide the tooltip message with docs link
export const getSourceTooltip = (source: SourceType) => {
  const dbLabel = `Connection type is ${clientTypes.find((c) => c.value === source.type)?.text || source.type?.toUpperCase()}.`

  if (source.is_schema_readonly && source.is_data_readonly) {
    return h(
      'div',
      {
        className: 'w-max',
      },
      [
        dbLabel,
        h('br'),
        'Both data and schema editing are disabled.',
        h('br'),
        'These settings are ideal for read-only use cases of your data.',
        h('br'),
        h(
          'a',
          {
            className: '!text-current',
            href: 'https://docs.nocodb.com/data-sources/connect-to-data-source#configuring-permissions',
            target: '_blank',
          },
          'Learn more',
        ),
      ],
    )
  }
  if (source.is_schema_readonly) {
    return h(
      'div',
      {
        className: 'max-w-90',
      },
      [
        dbLabel,
        h('br'),
        'Data editing is allowed and Schema edit is not allowed.',
        h('br'),
        'An ideal settings for administrative users who need to change data directly on database.',
        h('br'),
        h(
          'a',
          {
            className: '!text-current',
            href: 'https://docs.nocodb.com/data-sources/connect-to-data-source#configuring-permissions',
            target: '_blank',
          },
          'Learn more',
        ),
      ],
    )
  }
  return h(
    'div',
    {
      className: 'max-w-90',
    },
    [
      dbLabel,
      h('br'),
      'Both Data and Schema Editing are enabled.',
      h('br'),
      'We highly recommend ',
      h(
        'a',
        {
          className: '!text-current',
          href: 'https://docs.nocodb.com/data-sources/connect-to-data-source#configuring-permissions',
          target: '_blank',
        },
        'disabling schema editing',
      ),
      ' to maintain data integrity and avoid potential issues.',
    ],
  )
}
