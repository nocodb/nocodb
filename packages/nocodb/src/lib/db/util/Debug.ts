import boxen from 'boxen';
import debug from 'debug';

import('colors');
import DebugMgr from './DebugMgr';

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
    log += `                                              EXCEPTION OCCURED!! in ${this.namespace.red.bold} @ ${func}`;
    log +=
      '\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
        .red.bold;
    log += `MESSAGE:\n`.yellow.bold;
    log += `${e.message}\n`.yellow.bold;
    log +=
      '\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
        .red.bold;
    log += `CODE:\n`.yellow.bold;
    log += `${e.code}\n`.yellow.bold;
    log +=
      '\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
        .red.bold;
    log += `STACK:\n`.yellow.bold;
    log += `${e.stack}\n`.yellow.bold;
    log +=
      '\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
        .red.bold;
    console.log(boxen(log, { padding: 1, borderStyle: 'double' }));
    console.log(e);
    return log;
  }

  ppe(e, func?) {
    return this.ppException(e, func);
  }
}
