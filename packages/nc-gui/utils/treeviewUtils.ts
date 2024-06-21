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
  const dbLabel = `External DB - ${clientTypes.find((c) => c.value === source.type)?.text || source.type?.toUpperCase()}`

  if (source.is_schema_readonly && source.is_data_readonly) {
    return h(
      'div',
      {
        className: 'w-max',
      },
      [
        dbLabel,
        h('br'),
        `External source is connected in Read Only Mode.`,
        h('br'),
        `Schema and Data is not editable.`,
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
        className: 'w-max',
      },
      [
        dbLabel,
        h('br'),
        'Data Edit is enabled.',
        h('br'),
        'Schema is in disabled state.',
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
  if (source.is_data_readonly) {
    return h(
      'div',
      {
        className: 'w-max',
      },
      [
        dbLabel,
        h('br'),
        'Schema Edit is enabled.',
        h('br'),
        'Data is in disabled state.',
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
      className: 'w-max',
    },
    [
      dbLabel,
      h('br'),
      'Both Data and Schema Editing is enabled.',
      h('br'),
      'We suggest to disable ',
      h(
        'a',
        {
          className: '!text-current',
          href: 'https://docs.nocodb.com/data-sources/connect-to-data-source#configuring-permissions',
          target: '_blank',
        },
        'Schema editing',
      ),
      '.',
    ],
  )
}
