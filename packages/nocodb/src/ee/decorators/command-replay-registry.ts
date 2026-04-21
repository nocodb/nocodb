export interface ReplayEntry {
  serviceClass: Function;
  method: string;
}

/**
 * Static registry mapping operation names to their service class + method for
 * sandbox merge replay. Populated automatically by @TraceCommand at module load
 * time — no manual OPERATION_MAP maintenance required.
 */
export class CommandReplayRegistry {
  private static readonly entries = new Map<string, ReplayEntry>();

  static register(operation: string, entry: ReplayEntry): void {
    const existing = this.entries.get(operation);
    if (existing && existing.serviceClass !== entry.serviceClass) {
      // eslint-disable-next-line no-console
      console.warn(
        `[CommandReplayRegistry] Operation '${operation}' registered by ` +
          `${existing.serviceClass.name} is being overwritten by ` +
          `${entry.serviceClass.name}. Add operation: '<unique-name>' to one ` +
          `of the @TraceCommand decorators to disambiguate.`,
      );
    }
    this.entries.set(operation, entry);
  }

  static get(operation: string): ReplayEntry | undefined {
    return this.entries.get(operation);
  }

  static registeredOperations(): string[] {
    return [...this.entries.keys()];
  }
}
