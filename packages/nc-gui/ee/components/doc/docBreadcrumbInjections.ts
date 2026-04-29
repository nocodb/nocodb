import type { InjectionKey, Ref } from 'vue'

// Bumped by an ancestor row (or the segment) when its dropdown closes; every
// open descendant row watches this and force-closes its own hover-mounted
// submenu, since Ant Design's body-mounted popups don't auto-tear-down when
// an ancestor overlay hides.
//
// Each row both injects its parent's token (to react to the parent closing)
// and provides its own (so its children react to it closing), shadowing the
// parent's provider for its own subtree.
export const DocBreadcrumbCloseTokenInj: InjectionKey<Ref<number>> = Symbol('DocBreadcrumbCloseToken')

// Tracks which immediate child of a parent currently has its submenu open.
// Siblings are mutually exclusive — when one opens, all others must close,
// otherwise moving the cursor from one sibling's deep submenu to a different
// sibling leaves the first sibling's branch visible alongside the new one.
export const DocBreadcrumbOpenChildInj: InjectionKey<Ref<string | null>> = Symbol('DocBreadcrumbOpenChild')
