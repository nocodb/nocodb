// Real registry — populated in Task 2.
import type {
  OperationContract,
  CommandHandler,
} from './_types';

interface RegistryEntry {
  contract: OperationContract;
  handler: CommandHandler;
}

class _OperationRegistry {
  private readonly entries = new Map<string, RegistryEntry>();
  private frozen = false;

  register<C extends OperationContract>(
    _contract: C,
    _handler: CommandHandler<C>,
  ): void {
    throw new Error('register() not yet implemented — see Task 2');
  }

  freeze(): void {
    this.frozen = true;
  }

  resolve(_name: string, _version: number): RegistryEntry | undefined {
    return undefined;
  }

  describe() {
    return [];
  }
}

export const OperationRegistry = new _OperationRegistry();
