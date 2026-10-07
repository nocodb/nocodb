export interface PlaygroundNavItem {
  name: string
  path: string
  description: string
  icon: string
}

export interface PlaygroundNavSection {
  title: string
  items: PlaygroundNavItem[]
}

export const playgroundNav: PlaygroundNavSection[] = [
  {
    title: 'Design system',
    items: [
      {
        name: 'Foundations',
        path: '/playground/foundations',
        description: 'Colour tokens, typography, shadows, spacing and radii',
        icon: 'ncPalette',
      },
      { name: 'Icons', path: '/playground/icons', description: 'Every icon in iconUtils', icon: 'star' },
      {
        name: 'Nc components',
        path: '/playground/nc',
        description: 'Buttons, inputs, menus, modals and the rest of components/nc',
        icon: 'appStore',
      },
      {
        name: 'General components',
        path: '/playground/general',
        description: 'Shared app-level pieces from components/general',
        icon: 'ncGrid',
      },
      {
        name: 'Cells',
        path: '/playground/cells',
        description: 'Every field type in display and edit mode',
        icon: 'ncType',
      },
    ],
  },
  {
    title: 'Views (mock data)',
    items: [
      { name: 'Grid', path: '/playground/views/grid', description: 'Canvas grid with toolbar', icon: 'grid' },
      { name: 'Gallery', path: '/playground/views/gallery', description: 'Gallery cards', icon: 'gallery' },
      { name: 'Kanban', path: '/playground/views/kanban', description: 'Kanban stacks', icon: 'kanban' },
      { name: 'Calendar', path: '/playground/views/calendar', description: 'Month / week / day', icon: 'calendar' },
      { name: 'Form', path: '/playground/views/form', description: 'Form view builder', icon: 'form' },
      { name: 'Map', path: '/playground/views/map', description: 'Geo markers (tiles need network)', icon: 'map' },
      { name: 'List', path: '/playground/views/list', description: 'Nested list view', icon: 'ncList' },
      { name: 'Timeline', path: '/playground/views/timeline', description: 'Date-range bars', icon: 'timeline' },
      { name: 'Gantt', path: '/playground/views/gantt', description: 'Bars with dependencies', icon: 'gantt' },
      {
        name: 'Expanded record',
        path: '/playground/views/expanded',
        description: 'Record modal with comments and revision history',
        icon: 'maximize',
      },
    ],
  },
  {
    title: 'Surfaces (mock data)',
    items: [
      {
        name: 'Toolbar menus',
        path: '/playground/surfaces/toolbar',
        description: 'Filter, sort, group, fields, row height, search and view actions',
        icon: 'filter',
      },
      {
        name: 'Field editor',
        path: '/playground/surfaces/fields',
        description: 'Field editor per type and the column header menu',
        icon: 'cellText',
      },
      {
        name: 'Table details',
        path: '/playground/surfaces/details',
        description: 'Fields, relations, webhooks, API snippets, record templates',
        icon: 'table',
      },
      {
        name: 'Base settings',
        path: '/playground/surfaces/base-settings',
        description: 'The real base settings shell and every pane',
        icon: 'settings',
      },
    ],
  },
  {
    title: 'Live app',
    items: [
      {
        name: 'Live pages',
        path: '/playground/live',
        description: 'Any of your bases — real views and settings, with token overrides applied',
        icon: 'ncMonitor',
      },
    ],
  },
  {
    title: 'Feature sandboxes',
    items: [
      {
        name: 'Filters',
        path: '/playground/components/filter/filter-group',
        description: 'Filter group builder',
        icon: 'filter',
      },
      {
        name: 'Row colour toolbar',
        path: '/playground/components/row-color-picker-toolbar/using-filter-panel',
        description: 'Row colouring panels',
        icon: 'ncDroplet',
      },
      {
        name: 'Colour pickers',
        path: '/playground/components/advance-color-picker',
        description: 'Advance + base icon colour pickers',
        icon: 'ncPalette',
      },
      { name: 'Plans', path: '/playground/plans', description: 'Plan badges and billing tables', icon: 'ncArrowUpCircle' },
    ],
  },
]
