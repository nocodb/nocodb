/**
 * Stub NocoLicense for the EE build (non-on-prem).
 *
 * In the plain EE build, EE features are always active.
 * The on-prem build overrides this with the real implementation
 * at src/ee-on-prem/NocoLicense.ts (via ~/ path resolution).
 */
export default class NocoLicense {
  /** EE is always active in the plain EE build */
  static get isEE(): boolean {
    return true;
  }

  static get isExpired(): boolean {
    return false;
  }

  static get isSuspended(): boolean {
    return false;
  }

  /** License status: always 'active' in the plain EE build */
  static get licenseStatus(): string {
    return 'active';
  }

  static isInitialized(): boolean {
    return true;
  }

  static isTrial(): boolean {
    return false;
  }

  static getStatus(): undefined {
    return undefined;
  }

  static getExpiry(): undefined {
    return undefined;
  }

  static getSeatCount(): number {
    return 0;
  }

  static getWorkspaceLimit(): undefined {
    return undefined;
  }

  static getConfig(): undefined {
    return undefined;
  }

  static shouldBlockAccess(): boolean {
    return false;
  }

  static reset(): void {
    // no-op in stub
  }

  static async init(): Promise<void> {
    // no-op in stub
  }
}
