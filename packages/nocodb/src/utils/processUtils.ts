export function handleUncaughtErrors(process: NodeJS.Process) {
  process.on('uncaughtException', (err) => {
    let handled = false;
    if ((err as any).code) {
      switch ((err as any).code) {
        // ERR_STRING_TOO_LONG from pg-protocol cannot be caught, possibly because it has been
        // detached from process by setTimeout or setImmediate without promise
        case 'ERR_STRING_TOO_LONG':
          handled = true;
          break;
      }
    }
    if (!handled) {
      process.exit(1);
    }
  });
}
