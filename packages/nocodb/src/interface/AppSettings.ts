/**
 * Application-wide settings stored in nc_store
 */
export interface AppSettings {
  /**
   * When true, only users with invite tokens can sign up
   * Prevents open registration
   * @default false
   */
  invite_only_signup?: boolean;

  /**
   * Prevent non-super users from creating new workspaces
   * @default false
   */
  restrict_workspace_creation?: boolean;
}

/**
 * Default values for app settings
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  invite_only_signup: false,
  restrict_workspace_creation: false,
};
