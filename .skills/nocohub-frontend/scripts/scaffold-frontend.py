#!/usr/bin/env python3
"""
NocoDB Frontend Scaffolding Tool

Generates boilerplate for Vue components, composables, and Pinia stores.

Usage:
    python scaffold-frontend.py component MyComponent --category dashboard
    python scaffold-frontend.py component MyFeature --category dashboard --ee
    python scaffold-frontend.py composable useMyFeature --type injection
    python scaffold-frontend.py composable useMyHelper --type simple
    python scaffold-frontend.py store myFeature
    python scaffold-frontend.py store myFeature --ee
"""

import argparse
import os
from pathlib import Path
from datetime import datetime

# Base path for nc-gui
NC_GUI_PATH = Path(__file__).parent.parent.parent.parent / "packages" / "nc-gui"


def create_component(name: str, category: str, ee: bool = False):
    """Create a Vue component."""

    # Determine path
    if ee:
        base_path = NC_GUI_PATH / "ee" / "components" / category
    else:
        base_path = NC_GUI_PATH / "components" / category

    base_path.mkdir(parents=True, exist_ok=True)
    file_path = base_path / f"{name}.vue"

    if file_path.exists():
        print(f"❌ Component already exists: {file_path}")
        return False

    content = f'''<script lang="ts" setup>
/**
 * {name} Component
 * Created: {datetime.now().strftime("%Y-%m-%d")}
 */

// Props
const props = withDefaults(
  defineProps<{{
    modelValue?: string
    disabled?: boolean
  }}>(),
  {{
    disabled: false,
  }}
)

// Emits
const emit = defineEmits<{{
  'update:modelValue': [value: string]
}}>()

// Composables
const {{ t }} = useI18n()

// State
const localValue = useVModel(props, 'modelValue', emit)

// Computed

// Methods

// Lifecycle
onMounted(() => {{
  // initialization
}})
</script>

<template>
  <div class="nc-{name.lower().replace('_', '-')}">
    <!-- Component content -->
  </div>
</template>

<style lang="scss" scoped>
.nc-{name.lower().replace('_', '-')} {{
  @apply flex items-center;
}}
</style>
'''

    file_path.write_text(content)
    print(f"✅ Created component: {file_path}")

    # If EE component, also create CE placeholder
    if ee:
        ce_path = NC_GUI_PATH / "components" / category
        ce_path.mkdir(parents=True, exist_ok=True)
        ce_file = ce_path / f"{name}.vue"

        if not ce_file.exists():
            ce_content = '''<template>
  <span></span>
</template>
'''
            ce_file.write_text(ce_content)
            print(f"✅ Created CE placeholder: {ce_file}")

    return True


def create_composable(name: str, composable_type: str, ee: bool = False):
    """Create a composable."""

    if not name.startswith('use'):
        name = f"use{name[0].upper()}{name[1:]}"

    # Determine path
    if ee:
        base_path = NC_GUI_PATH / "ee" / "composables"
    else:
        base_path = NC_GUI_PATH / "composables"

    if composable_type == "injection":
        # Injection state composables get their own folder
        folder_path = base_path / name
        folder_path.mkdir(parents=True, exist_ok=True)
        file_path = folder_path / "index.ts"
    else:
        base_path.mkdir(parents=True, exist_ok=True)
        file_path = base_path / f"{name}.ts"

    if file_path.exists():
        print(f"❌ Composable already exists: {file_path}")
        return False

    if composable_type == "simple":
        content = f'''import type {{ Ref }} from 'vue'

/**
 * {name} - Simple utility composable
 * Created: {datetime.now().strftime("%Y-%m-%d")}
 */
export function {name}() {{
  const {{ t }} = useI18n()
  const {{ api }} = useApi()

  // State
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed

  // Methods
  const doSomething = async () => {{
    isLoading.value = true
    error.value = null

    try {{
      // Implementation
    }} catch (e: any) {{
      error.value = e.message
      message.error(t('msg.error.somethingWentWrong'))
    }} finally {{
      isLoading.value = false
    }}
  }}

  return {{
    isLoading: readonly(isLoading),
    error: readonly(error),
    doSomething,
  }}
}}
'''
    elif composable_type == "injection":
        # Extract the base name without 'use' prefix for the store name
        store_name = name[3:].lower() if name.startswith('use') else name.lower()

        content = f'''import type {{ Ref }} from 'vue'

/**
 * {name} - Injection state composable
 * Created: {datetime.now().strftime("%Y-%m-%d")}
 *
 * Usage:
 *   Parent: useProvide{name[3:]}(args)
 *   Child:  const store = {name}OrThrow()
 */

const [useProvide{name[3:]}, {name}] = useInjectionState(
  (
    // Add your arguments here
    // example: tableRef: Ref<TableType | undefined>,
  ) => {{
    const {{ api }} = useApi()
    const {{ t }} = useI18n()

    // State
    const items = ref<any[]>([])
    const isLoading = ref(false)
    const selectedId = ref<string | null>(null)

    // Computed
    const selectedItem = computed(() =>
      items.value.find(item => item.id === selectedId.value)
    )

    const isEmpty = computed(() => items.value.length === 0)

    // Actions
    const loadItems = async () => {{
      isLoading.value = true
      try {{
        // items.value = await api.someEndpoint.list()
      }} catch (e: any) {{
        message.error(await extractSdkResponseErrorMsg(e))
      }} finally {{
        isLoading.value = false
      }}
    }}

    const selectItem = (id: string | null) => {{
      selectedId.value = id
    }}

    const reset = () => {{
      items.value = []
      selectedId.value = null
    }}

    return {{
      // State
      items: readonly(items),
      isLoading: readonly(isLoading),
      selectedId,

      // Computed
      selectedItem,
      isEmpty,

      // Actions
      loadItems,
      selectItem,
      reset,
    }}
  }},
  '{store_name}-store',
)

export {{ useProvide{name[3:]} }}

export function {name}OrThrow() {{
  const store = {name}()
  if (!store) {{
    throw new Error('Please call `useProvide{name[3:]}` on the appropriate parent component')
  }}
  return store
}}
'''
    elif composable_type == "global":
        content = f'''import {{ createGlobalState }} from '@vueuse/core'

/**
 * {name} - Global state composable (singleton)
 * Created: {datetime.now().strftime("%Y-%m-%d")}
 */
export const {name} = createGlobalState(() => {{
  // Persisted storage (optional)
  const storage = useStorage('{name.replace("use", "nc-").lower()}', {{
    enabled: false,
    // Add more persisted state
  }})

  // State
  const enabled = toRef(storage.value, 'enabled')
  const isLoading = ref(false)

  // Non-persisted state
  const tempData = ref<any>(null)

  // Computed
  const isReady = computed(() => !isLoading.value && enabled.value)

  // Actions
  const toggle = () => {{
    enabled.value = !enabled.value
  }}

  const reset = () => {{
    enabled.value = false
    tempData.value = null
  }}

  return {{
    // State
    enabled,
    isLoading: readonly(isLoading),
    tempData,

    // Computed
    isReady,

    // Actions
    toggle,
    reset,
  }}
}})
'''
    else:
        print(f"❌ Unknown composable type: {composable_type}")
        return False

    file_path.write_text(content)
    print(f"✅ Created composable: {file_path}")
    return True


def create_store(name: str, ee: bool = False):
    """Create a Pinia store."""

    # Ensure proper naming
    store_name = name if name.startswith('use') else f"use{name[0].upper()}{name[1:]}"
    if not store_name.endswith('Store'):
        store_name = f"{store_name}Store"

    # Determine path
    if ee:
        base_path = NC_GUI_PATH / "ee" / "store"
    else:
        base_path = NC_GUI_PATH / "store"

    base_path.mkdir(parents=True, exist_ok=True)

    # Convert useSomethingStore to something.ts
    file_name = name.replace('use', '').replace('Store', '').lower()
    file_path = base_path / f"{file_name}.ts"

    if file_path.exists():
        print(f"❌ Store already exists: {file_path}")
        return False

    content = f'''import {{ acceptHMRUpdate, defineStore }} from 'pinia'

/**
 * {store_name}
 * Created: {datetime.now().strftime("%Y-%m-%d")}
 */
export const {store_name} = defineStore('{file_name}Store', () => {{
  // ============================================
  // DEPENDENCIES
  // ============================================
  const {{ api, isLoading: apiLoading }} = useApi()
  const router = useRouter()
  const route = router.currentRoute
  const {{ t }} = useI18n()

  // ============================================
  // STATE
  // ============================================
  const items = ref<any[]>([])
  const selectedId = ref<string | null>(null)
  const isInitialized = ref(false)
  const error = ref<string | null>(null)

  // ============================================
  // COMPUTED
  // ============================================
  const selectedItem = computed(() =>
    items.value.find(item => item.id === selectedId.value)
  )

  const itemCount = computed(() => items.value.length)

  const isEmpty = computed(() => items.value.length === 0)

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Load all items
   */
  async function loadItems(force = false) {{
    if (isInitialized.value && !force) return

    error.value = null

    try {{
      // const response = await api.someEndpoint.list()
      // items.value = response.list || []
      isInitialized.value = true
    }} catch (e: any) {{
      error.value = e.message
      message.error(t('msg.error.loadFailed'))
      console.error('Failed to load items:', e)
    }}
  }}

  /**
   * Create a new item
   */
  async function createItem(data: any): Promise<any | null> {{
    try {{
      // const newItem = await api.someEndpoint.create(data)
      // items.value.push(newItem)
      message.success(t('msg.success.created'))
      // return newItem
      return null
    }} catch (e: any) {{
      message.error(await extractSdkResponseErrorMsg(e))
      return null
    }}
  }}

  /**
   * Update an existing item
   */
  async function updateItem(id: string, data: any): Promise<any | null> {{
    try {{
      // const updated = await api.someEndpoint.update(id, data)
      // const index = items.value.findIndex(item => item.id === id)
      // if (index !== -1) {{
      //   items.value[index] = {{ ...items.value[index], ...updated }}
      // }}
      message.success(t('msg.success.updated'))
      // return updated
      return null
    }} catch (e: any) {{
      message.error(await extractSdkResponseErrorMsg(e))
      return null
    }}
  }}

  /**
   * Delete an item
   */
  async function deleteItem(id: string): Promise<boolean> {{
    try {{
      // await api.someEndpoint.delete(id)
      items.value = items.value.filter(item => item.id !== id)

      if (selectedId.value === id) {{
        selectedId.value = null
      }}

      message.success(t('msg.success.deleted'))
      return true
    }} catch (e: any) {{
      message.error(await extractSdkResponseErrorMsg(e))
      return false
    }}
  }}

  /**
   * Set selected item
   */
  function setSelectedId(id: string | null) {{
    selectedId.value = id
  }}

  /**
   * Reset store state
   */
  function reset() {{
    items.value = []
    selectedId.value = null
    isInitialized.value = false
    error.value = null
  }}

  // ============================================
  // WATCHERS
  // ============================================

  // ============================================
  // RETURN PUBLIC API
  // ============================================
  return {{
    // State
    items: readonly(items),
    selectedId,
    isInitialized: readonly(isInitialized),
    error: readonly(error),
    isLoading: apiLoading,

    // Computed
    selectedItem,
    itemCount,
    isEmpty,

    // Actions
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    setSelectedId,
    reset,
  }}
}})

// HMR support
if (import.meta.hot) {{
  import.meta.hot.accept(acceptHMRUpdate({store_name} as any, import.meta.hot))
}}
'''

    file_path.write_text(content)
    print(f"✅ Created store: {file_path}")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="NocoDB Frontend Scaffolding Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scaffold-frontend.py component MyButton --category general
  python scaffold-frontend.py component MyFeature --category dashboard --ee
  python scaffold-frontend.py composable useMyFeature --type injection
  python scaffold-frontend.py composable useHelper --type simple
  python scaffold-frontend.py composable useSettings --type global
  python scaffold-frontend.py store myFeature
  python scaffold-frontend.py store myFeature --ee
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Component command
    comp_parser = subparsers.add_parser("component", help="Create a Vue component")
    comp_parser.add_argument("name", help="Component name (PascalCase)")
    comp_parser.add_argument(
        "--category", "-c",
        required=True,
        help="Component category (e.g., dashboard, general, cell, dlg)"
    )
    comp_parser.add_argument(
        "--ee",
        action="store_true",
        help="Create as EE component with CE placeholder"
    )

    # Composable command
    comp_parser = subparsers.add_parser("composable", help="Create a composable")
    comp_parser.add_argument("name", help="Composable name (should start with 'use')")
    comp_parser.add_argument(
        "--type", "-t",
        choices=["simple", "injection", "global"],
        default="simple",
        help="Type of composable"
    )
    comp_parser.add_argument(
        "--ee",
        action="store_true",
        help="Create as EE composable"
    )

    # Store command
    store_parser = subparsers.add_parser("store", help="Create a Pinia store")
    store_parser.add_argument("name", help="Store name")
    store_parser.add_argument(
        "--ee",
        action="store_true",
        help="Create as EE store"
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # Verify nc-gui path exists
    if not NC_GUI_PATH.exists():
        print(f"❌ nc-gui path not found: {NC_GUI_PATH}")
        print("Make sure you're running from the nocohub repository root.")
        return

    if args.command == "component":
        create_component(args.name, args.category, args.ee)
    elif args.command == "composable":
        create_composable(args.name, args.type, args.ee)
    elif args.command == "store":
        create_store(args.name, args.ee)


if __name__ == "__main__":
    main()
