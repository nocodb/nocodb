const chalk = require('chalk');

export function log(message: string) {
  console.log(chalk.white(message));
}

export function error(message: string) {
  console.error(chalk.red('Error: ' + message));
}

export function warn(message: string) {
  console.warn(chalk.yellow('Warning: ' + message));
}

export function info(message: string) {
  console.info(chalk.green('Info: ' + message));
}

export function success(message: string) {
  console.log(chalk.green('Success: ' + message));
}

export function debug(message: string) {
  console.debug(chalk.blue('Debug: ' + message));
}
