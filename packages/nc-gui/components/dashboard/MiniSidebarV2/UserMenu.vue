<script lang="ts" setup>
const { isRail, toggleMode } = useMiniSidebarMode()

const isMenuOpen = ref(false)

const isDockMode = computed(() => !isRail.value)
</script>

<template>
  <NcDropdown v-model:visible="isMenuOpen" placement="topLeft" overlay-class-name="!min-w-60 !left-1">
    <div class="nc-rail-avatar" :class="{ active: isMenuOpen }" title="Account">
      <img src="https://i.pravatar.cc/64?u=gilfoyle" alt="BG" />
    </div>

    <template #overlay>
      <div class="nc-user-menu">
        <!-- Profile -->
        <div class="nc-user-menu-profile">
          <div class="nc-user-menu-profile-avatar">
            <img src="https://i.pravatar.cc/64?u=gilfoyle" alt="BG" />
          </div>
          <div class="nc-user-menu-profile-info">
            <div class="nc-user-menu-profile-name">Bertram Gilfoyle</div>
            <div class="nc-user-menu-profile-email">b.gilfoyle@mercedes-benz.com</div>
          </div>
        </div>

        <div class="nc-user-menu-divider" />

        <!-- Menu items -->
        <div class="nc-user-menu-item">
          <GeneralIcon icon="ncUser" class="nc-user-menu-icon" />
          <span>My Profile</span>
        </div>
        <div class="nc-user-menu-item">
          <GeneralIcon icon="ncBell" class="nc-user-menu-icon" />
          <span>Notification Preferences</span>
        </div>
        <div class="nc-user-menu-item">
          <GeneralIcon icon="ncSun" class="nc-user-menu-icon" />
          <span>Light Mode</span>
        </div>
        <div class="nc-user-menu-item">
          <GeneralIcon icon="ncGlobe" class="nc-user-menu-icon" />
          <span>Language &amp; Region</span>
        </div>

        <div class="nc-user-menu-divider" />

        <!-- Navigation section -->
        <div class="nc-user-menu-label">Navigation</div>
        <div class="nc-user-menu-item" @click="toggleMode">
          <GeneralIcon icon="ncLayout" class="nc-user-menu-icon" />
          <span>Dock Mode</span>
          <span class="nc-menu-shortcut">{{ isDockMode ? 'on' : 'off' }}</span>
        </div>

        <div class="nc-user-menu-divider" />

        <!-- Settings items -->
        <div class="nc-user-menu-item">
          <GeneralIcon icon="ncKey2" class="nc-user-menu-icon" />
          <span>API Tokens</span>
        </div>
        <div class="nc-user-menu-item">
          <GeneralIcon icon="ncLink" class="nc-user-menu-icon" />
          <span>Connected Apps</span>
        </div>
        <div class="nc-user-menu-item">
          <GeneralIcon icon="ncShield" class="nc-user-menu-icon" />
          <span>Security &amp; 2FA</span>
        </div>
        <div class="nc-user-menu-item">
          <GeneralIcon icon="ncClock" class="nc-user-menu-icon" />
          <span>Activity Log</span>
        </div>

        <div class="nc-user-menu-divider" />

        <div class="nc-user-menu-item">
          <GeneralIcon icon="ncHelp" class="nc-user-menu-icon" />
          <span>Help &amp; Support</span>
        </div>
        <div class="nc-user-menu-item">
          <GeneralIcon icon="ncCommand" class="nc-user-menu-icon" />
          <span>Keyboard Shortcuts</span>
          <span class="nc-menu-shortcut">?</span>
        </div>
        <div class="nc-user-menu-item">
          <GeneralIcon icon="ncMegaPhoneDuo" class="nc-user-menu-icon" />
          <span>What's New</span>
        </div>

        <div class="nc-user-menu-divider" />

        <div class="nc-user-menu-item nc-user-menu-item--danger">
          <GeneralIcon icon="signout" class="nc-user-menu-icon" />
          <span>Sign Out</span>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.nc-rail-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:hover {
    box-shadow: 0 0 0 2px rgba(91, 122, 157, 0.5);
  }

  &.active {
    box-shadow: 0 0 0 2px var(--nc-content-brand);
  }
}

.nc-user-menu {
  padding: 6px;
  min-width: 240px;
}

.nc-user-menu-profile {
  @apply flex items-center;
  gap: 10px;
  padding: 10px 10px 8px;
}

.nc-user-menu-profile-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.nc-user-menu-profile-info {
  @apply flex flex-col overflow-hidden;
  gap: 1px;
}

.nc-user-menu-profile-name {
  font-size: 13px;
  font-weight: 600;
  @apply text-nc-content-gray truncate;
}

.nc-user-menu-profile-email {
  font-size: 11px;
  @apply text-nc-content-gray-muted truncate;
}

.nc-user-menu-divider {
  height: 1px;
  background: var(--nc-border-gray-medium);
  margin: 4px 0;
}

.nc-user-menu-label {
  font-size: 10px;
  font-weight: 600;
  @apply text-nc-content-gray-muted uppercase;
  letter-spacing: 0.05em;
  padding: 6px 10px 2px;
}

.nc-user-menu-item {
  @apply flex items-center cursor-pointer;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 13px;
  @apply text-nc-content-gray-subtle;

  .nc-user-menu-icon {
    font-size: 14px;
    width: 18px;
    text-align: center;
    @apply text-nc-content-gray-muted flex-shrink-0;
  }

  &:hover {
    @apply text-nc-content-gray;
    background: rgba(0, 0, 0, 0.06);

    :root[theme='dark'] & {
      background: rgba(255, 255, 255, 0.08);
    }

    .nc-user-menu-icon {
      @apply text-nc-content-gray-subtle;
    }
  }

  .nc-menu-shortcut {
    margin-left: auto;
    font-size: 10px;
    @apply text-nc-content-gray-muted;
    background: rgba(0, 0, 0, 0.04);
    padding: 1px 6px;
    border-radius: 3px;

    :root[theme='dark'] & {
      background: rgba(255, 255, 255, 0.06);
    }
  }
}

.nc-user-menu-item--danger {
  color: #e06060 !important;

  .nc-user-menu-icon {
    color: #e06060 !important;
  }

  &:hover {
    background: rgba(224, 96, 96, 0.1) !important;
    color: #e06060 !important;
  }
}
</style>
