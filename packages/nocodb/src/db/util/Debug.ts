import boxen from 'boxen';
import debug from 'debug';

import colors from 'colors/safe';
import DebugMgr from './DebugMgr';

const yellowBold = (str: string) => colors.yellow(colors.bold(str));
const redBold = (str: string) => colors.red(colors.bold(str));

export default class Debug {
  public namespace: any;
  public api: any;
  public warn: any;
  public info: any;
  public error: any;
  public debug: any;

  constructor(namespace) {
    this.namespace = namespace;

    this.api = debug(`${namespace}_A`);
    this.warn = debug(`${namespace}_W`);
    this.info = debug(`${namespace}_I`);
    this.error = debug(`${namespace}_E`);
    this.debug = debug(`${namespace}_D`);
    DebugMgr.createNamespace(namespace);
  }

  ppException(e, func = null) {
    let log = '';
    log += `                                              EXCEPTION OCCURED!! in ${redBold(
      this.namespace,
    )} @ ${func}`;
    log += redBold(
      '\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n',
    );
    log += yellowBold(`MESSAGE:\n`);
    log += yellowBold(`${e.message}\n`);
    log += redBold(
      '\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n',
    );
    log += yellowBold(`CODE:\n`);
    log += yellowBold(`${e.code}\n`);
    log += redBold(
      '\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n',
    );
    log += yellowBold(`STACK:\n`);
    log += yellowBold(`${e.stack}\n`);
    log += redBold(
      '\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n',
    );
    console.log(boxen(log, { padding: 1, borderStyle: 'double' }));
    console.log(e);
    return log;
  }

  ppe(e, func?) {
    return this.ppException(e, func);
  }
}
