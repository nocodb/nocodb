<script setup lang="ts">
/**
 * NodeView component for web bookmark cards.
 *
 * Layout (matches Notion):
 * - With image:    title + description (truncated) on the left, thumbnail on the right
 * - Without image: title + description (truncated), full width
 * - Footer always shows favicon + URL (or site name)
 *
 * Clicking the card opens the URL in a new tab. While metadata is fetching
 * (isLoading attr is true), shows a skeleton placeholder. If metadata fetch
 * fails, the card falls back to showing the URL as a plain hyperlink.
 */
import type { NodeViewProps } from '@tiptap/vue-3'
import { NodeViewWrapper } from '@tiptap/vue-3'

const props = defineProps<NodeViewProps>()

const { $api } = useNuxtApp()

const { appInfo } = useGlobal()

const basesStore = useBases()
const { activeProjectId } = storeToRefs(useBases())

/**
 * Backend may return either a fully-qualified URL (S3/GCS storage) or a path
 * relative to nc/uploads/ (local storage, served by /dltemp). Relative paths
 * must be joined with the backend ncSiteUrl so the browser hits the API
 * origin instead of the frontend origin.
 */
const resolveSrc = (raw: string | null): string | null => {
  if (!raw) return null
  if (/^(https?:|blob:|data:)/i.test(raw)) return raw
  try {
    const base = new URL(appInfo.value.ncSiteUrl || '/', window.location.origin)
    return new URL(raw.replace(/^\/+/, ''), base).toString()
  } catch {
    return raw
  }
}

const url = computed<string>(() => props.node.attrs.url || '')

const title = computed<string | null>(() => props.node.attrs.title)

const description = computed<string | null>(() => props.node.attrs.description)

const faviconUrl = computed<string | null>(() => props.node.attrs.faviconUrl)

const imageUrl = computed<string | null>(() => props.node.attrs.imageUrl)

const imagePath = computed<string | null>(() => props.node.attrs.imagePath)

const siteName = computed<string | null>(() => props.node.attrs.siteName)

const isLoading = computed<boolean>(() => !!props.node.attrs.isLoading)

const displayHost = computed(() => {
  try {
    return new URL(url.value).hostname.replace(/^www\./, '')
  } catch {
    return url.value
  }
})

const displayTitle = computed(() => title.value || displayHost.value || url.value)

const faviconError = ref(false)

const imageError = ref(false)

const refreshedImageUrl = ref<string | null>(null)

const isRefreshingImage = ref(false)

// Re-entry guard for the resign-on-error flow. Set before issuing a
// webBookmarkResignImage call; cleared by <img @load> when the resulting
// URL actually renders. If the refreshed URL fails to load (auth flap,
// deleted storage object, CDN error), @error fires again and this flag
// short-circuits to the no-image fallback instead of looping forever.
// A later expiry — after the refreshed URL has rendered successfully —
// passes this gate and gets its own resign attempt.
const refreshAttempted = ref(false)

const safeFavicon = computed(() => {
  if (faviconError.value || !faviconUrl.value) return null
  if (!/^https?:\/\//i.test(faviconUrl.value)) return null
  return faviconUrl.value
})

const effectiveImageUrl = computed(() => refreshedImageUrl.value || imageUrl.value)

const safeImage = computed(() => {
  if (imageError.value || !effectiveImageUrl.value) return null
  return resolveSrc(effectiveImageUrl.value)
})

/**
 * The stored signed URL has a short TTL. When the <img> errors out, ask the
 * backend to re-sign the stable imagePath so the preview survives indefinitely.
 *
 * Re-entry is gated by `refreshAttempted`: set when a resign is issued,
 * cleared by `onImageLoad` once the resulting URL actually renders. If the
 * refreshed URL fails to load too, the flag stays set and we fall through
 * to the no-image fallback — no infinite resign loop on broken storage.
 * Later expiries (after a successful render) pass the gate freshly.
 */
const onImageError = async () => {
  if (refreshAttempted.value || isRefreshingImage.value) {
    imageError.value = true
    return
  }
  if (!imagePath.value) {
    imageError.value = true
    return
  }
  const base = basesStore.bases.get(activeProjectId.value!)
  if (!base?.fk_workspace_id || !base?.id) {
    imageError.value = true
    return
  }

  refreshAttempted.value = true
  isRefreshingImage.value = true
  try {
    const res = (await $api.internal.postOperation(
      base.fk_workspace_id,
      base.id,
      { operation: 'webBookmarkResignImage' },
      { imagePath: imagePath.value },
    )) as { imageUrl: string | null }
    if (res?.imageUrl) {
      refreshedImageUrl.value = res.imageUrl
    } else {
      imageError.value = true
    }
  } catch {
    imageError.value = true
  } finally {
    isRefreshingImage.value = false
  }
}

const onImageLoad = () => {
  // The currently-shown URL actually rendered — clear the one-shot guard so
  // a future expiry (much later in the doc's life) can resign again.
  refreshAttempted.value = false
}

const openUrl = () => {
  if (!url.value) return
  window.open(url.value, '_blank', 'noopener,noreferrer')
}

const onCardClick = (e: MouseEvent) => {
  // Don't navigate when the user clicks the delete button.
  if ((e.target as HTMLElement)?.closest('.nc-web-bookmark-delete')) return
  openUrl()
}
</script>

<template>
  <NodeViewWrapper class="nc-web-bookmark-wrapper" data-drag-handle data-testid="nc-doc-web-bookmark">
    <div
      class="nc-web-bookmark-card"
      :class="{ 'nc-web-bookmark-selected': selected, 'nc-web-bookmark-loading': isLoading }"
      role="link"
      tabindex="0"
      @click="onCardClick"
      @keydown.enter="openUrl"
    >
      <!-- Text block -->
      <div class="nc-web-bookmark-text">
        <div v-if="isLoading" class="nc-web-bookmark-skeleton-title" />
        <div v-else class="nc-web-bookmark-title" :title="displayTitle">
          {{ displayTitle }}
        </div>

        <div v-if="isLoading" class="nc-web-bookmark-skeleton-desc" />
        <div v-else-if="description" class="nc-web-bookmark-description">
          {{ description }}
        </div>

        <div class="nc-web-bookmark-footer">
          <img
            v-if="safeFavicon"
            class="nc-web-bookmark-favicon"
            :src="safeFavicon"
            alt=""
            referrerpolicy="no-referrer"
            @error="faviconError = true"
          />
          <svg
            v-else
            class="nc-web-bookmark-favicon-fallback"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3.33 2h9.34v12L8 11.33 3.33 14V2z" />
          </svg>
          <span class="nc-web-bookmark-url" :title="url">{{ siteName || displayHost || url }}</span>
        </div>
      </div>

      <!-- Image block (only when image present + loaded successfully) -->
      <div v-if="safeImage" class="nc-web-bookmark-image-wrapper">
        <img
          class="nc-web-bookmark-image"
          :src="safeImage"
          alt=""
          referrerpolicy="no-referrer"
          @load="onImageLoad"
          @error="onImageError"
        />
      </div>

      <!-- Delete button — hover/selected only -->
      <button v-if="editor?.isEditable" class="nc-web-bookmark-delete" type="button" @click.stop="deleteNode">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.nc-web-bookmark-wrapper {
  margin: 0.5rem 0;

  // ProseMirror's default NodeSelection style adds a 2px outline inside the
  // wrapper. With `overflow: hidden` on the card, it bleeds inside the
  // rounded corners. We render selection state via the card border + glow
  // instead (.nc-web-bookmark-selected).
  &.ProseMirror-selectednode {
    outline: none;
  }
}

.nc-web-bookmark-card {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 0;
  min-height: 92px;
  border: 1px solid var(--nc-border-gray-medium);
  border-radius: 8px;
  background: var(--nc-bg-default);
  overflow: hidden;
  cursor: pointer;
  // Click navigates — selecting the text inside isn't a useful interaction,
  // and ProseMirror's NodeSelection would otherwise highlight every text
  // node within when navigating via arrow keys. Selection state is shown
  // via the `nc-web-bookmark-selected` border + glow below.
  user-select: none;
  -webkit-user-select: none;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;

  // Belt-and-braces: suppress ::selection paint when the node is in a
  // ProseMirror NodeSelection (arrow-key nav, programmatic selection, …).
  *::selection,
  *::-moz-selection {
    background: transparent;
    color: inherit;
  }

  &:hover {
    border-color: var(--nc-border-gray-strong);
    background: var(--nc-bg-gray-extralight);
  }

  &.nc-web-bookmark-selected {
    border-color: var(--nc-fill-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--nc-fill-primary) 20%, transparent);
  }
}

.nc-web-bookmark-text {
  flex: 1 1 auto;
  min-width: 0;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nc-web-bookmark-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--nc-content-gray);
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.nc-web-bookmark-description {
  font-size: 12px;
  color: var(--nc-content-gray-subtle);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
  flex: 1 1 auto;
}

.nc-web-bookmark-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  min-width: 0;
}

.nc-web-bookmark-favicon,
.nc-web-bookmark-favicon-fallback {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border-radius: 2px;
  object-fit: contain;
}

.nc-web-bookmark-favicon-fallback {
  color: var(--nc-content-gray-subtle);
}

.nc-web-bookmark-url {
  font-size: 12px;
  color: var(--nc-content-gray-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.nc-web-bookmark-image-wrapper {
  flex: 0 0 auto;
  width: 220px;
  background: var(--nc-bg-gray-extralight);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nc-web-bookmark-image {
  width: 100%;
  height: 100%;
  min-height: 92px;
  // Show the full image with letterboxing instead of cover-cropping —
  // most og:images are 1.9:1 and would be heavily cropped at this width.
  object-fit: contain;
  display: block;
}

// Skeleton placeholders while metadata loads
.nc-web-bookmark-skeleton-title,
.nc-web-bookmark-skeleton-desc {
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--nc-bg-gray-light) 0%, var(--nc-bg-gray-extralight) 50%, var(--nc-bg-gray-light) 100%);
  background-size: 200% 100%;
  animation: nc-web-bookmark-pulse 1.4s ease-in-out infinite;
}

.nc-web-bookmark-skeleton-title {
  width: 60%;
  margin-bottom: 8px;
}

.nc-web-bookmark-skeleton-desc {
  width: 92%;
  height: 10px;
  margin-bottom: 6px;
}

@keyframes nc-web-bookmark-pulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.nc-web-bookmark-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: var(--nc-bg-default);
  border: 1px solid var(--nc-border-gray-medium);
  color: var(--nc-content-gray);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  z-index: 2;

  &:hover {
    background: var(--nc-bg-gray-light);
  }
}

.nc-web-bookmark-card:hover .nc-web-bookmark-delete,
.nc-web-bookmark-card.nc-web-bookmark-selected .nc-web-bookmark-delete {
  opacity: 1;
}
</style>
