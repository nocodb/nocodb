# N Components

A standardized component library for NocoDB GUI with consistent naming conventions and patterns.

## Overview

All components in this directory follow the `N` prefix convention, making them easily identifiable and maintainable. For example: `<NSelect/>`, `<NButton/>`, `<NInput/>`.

## Benefits

- **Easy Identification**: The `N` prefix helps developers quickly recognize custom NocoDB components
- **Consistent Naming**: Standardized naming convention across the entire codebase
- **Documentation Ready**: Serves as a single source of truth for component documentation
- **Better Maintainability**: Centralized component organization

## Usage Guidelines

### Component Naming

- All components must start with the `N` prefix
- Use PascalCase for component names: `NComponentName`
- Keep names descriptive and concise

### Examples

```vue
<template>
  <div>
    <NSelect v-model="selectedValue" :options="options" />
    <NButton @click="handleSubmit">Submit</NButton>
    <NInput v-model="inputValue" placeholder="Enter text" />
  </div>
</template>
```

### Creating New Components

1. Create component file with `N` prefix
2. Follow existing component patterns and structure
3. Add proper TypeScript types
4. Include JSDoc comments for props and events
5. Add to component exports

## Component Structure

```text
components/n/
├── NButton/
│   ├── index.vue
│   └── types.ts
├── NSelect/
│   ├── index.vue
│   └── types.ts
└── README.md
```

## Reference

- Original proposal: [#4023](https://github.com/nocodb/nocohub/issues/4023)
- Component guidelines: Follow Vue 3 composition API patterns
- Styling: Use Tailwind CSS classes and design system tokens