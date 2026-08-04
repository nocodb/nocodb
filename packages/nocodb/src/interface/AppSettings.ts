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

  /**
   * When true, the email/password sign-in form is shown alongside SSO on
   * self-hosted instances. When false (default), configuring SSO hides the
   * email/password form to enforce SSO. Only relevant on-prem — on cloud the
   * password form is governed per-workspace and this flag has no effect.
   * @default false
   */
  allow_email_signin_with_sso?: boolean;
}

/**
 * Default values for app settings
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  invite_only_signup: false,
  restrict_workspace_creation: false,
  allow_email_signin_with_sso: false,
};
