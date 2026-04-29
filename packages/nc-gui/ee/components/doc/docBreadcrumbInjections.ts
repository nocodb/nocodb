import type { InjectionKey, Ref } from 'vue'

// Bumped by DocBreadcrumbSegment when its dropdown closes; every open
// descendant DocBreadcrumbMenuRow watches this and force-closes its own
// hover-mounted submenu, since Ant Design's body-mounted popups don't
// auto-tear-down when an ancestor overlay hides.
export const DocBreadcrumbCloseTokenInj: InjectionKey<Ref<number>> = Symbol('DocBreadcrumbCloseToken')
