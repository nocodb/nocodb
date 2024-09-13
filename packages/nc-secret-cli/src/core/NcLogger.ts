// a class to log messages to the console with colors and styles
export class NcLogger {
  static log(message: string) {
    console.log(message);
  }

  static error(message: string) {
    console.error('\x1b[31m%s\x1b[0m', 'Error: ' + message);
  }

  static warn(message: string) {
    console.warn('\x1b[33m%s\x1b[0m', 'Warning: ' + message);
  }

  static info(message: string) {
    console.info('\x1b[32m%s\x1b[0m', 'Info: ' + message);
  }

  static success(message: string) {
    console.log('\x1b[32m%s\x1b[0m', 'Success: ' + message);
  }

  static debug(message: string) {
    console.debug('\x1b[34m%s\x1b[0m', 'Debug: ' + message);
  }   
  
}