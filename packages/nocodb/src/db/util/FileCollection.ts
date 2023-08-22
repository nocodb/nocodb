import fs from 'fs';
import { promisify } from 'util';
import jsonfile from 'jsonfile';

export default class FileCollection {
  public args;
  public path;
  constructor(args) {
    this.args = args;
    this.path = args.path;
  }

  async init() {
    /**
     *  if args.path doesn't exists
     *    create an empty json file with an array
     */
    const exists = await promisify(fs.exists)(this.args.path);

    if (!exists) {
      await promisify(jsonfile.writeFile)(this.args.path, [], {
        spaces: 2,
      });
    }
  }

  async read() {
    return await promisify(jsonfile.readFile)(this.args.path);
  }

  async write(args) {
    await promisify(jsonfile.writeFile)(this.args.path, args.data, {
      spaces: 2,
    });
  }
}
