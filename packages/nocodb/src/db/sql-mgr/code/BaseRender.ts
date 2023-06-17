import Debug from '../../util/Debug';
import Emit from '../../util/emit';

class BaseRender {
  protected dir: any;
  protected filename: any;
  protected ctx: any;
  protected evt: any;
  protected log: any;
  protected ejsContent: any;

  /**
   * Class responsible for rendering code
   *
   * @param {string} - dir - dir where file will be rendered
   * @param {string} - filename - filename of file to be rendered
   * @param {Object} - ctx - context to render this file
   */
  constructor({ dir = '', filename = '', ctx }) {
    this.dir = dir;
    this.filename = filename;
    this.ctx = ctx;
    this.evt = new Emit();
    this.log = new Debug('BaseRender');
  }

  emit(data) {
    this.log.api(data);
    this.evt.evt.emit('UI', {
      status: 0,
      data: `File : ${data}`,
    });
  }

  emitW(data) {
    this.log.warn(data);
    this.evt.evt.emit('UI', {
      status: 1,
      data: `File : ${data}`,
    });
  }

  emitE(data) {
    this.log.error(data);
    this.evt.evt.emit('UI', {
      status: -1,
      data: `File : ${data}`,
    });
  }

  /**
   * Function that prepares data to be used in template
   * This should be strictly overridden by deriving class
   *
   * @returns {Promise<void>}
   */
  async prepare() {
    console.log('BaseRender::prepare -> Should be overriden');
  }

  /**
   * Renders the ejs code template using the data sent
   * @param {String} - ejsPath - path to ejs file template
   * @param {Object} - ejsData - data to be rendered
   * @param {Boolean} - force - on true overwrites the file
   * @returns {Promise<void>}
   */
  /*
  async render(obj) {
    const {ejsPath, ejsData, force = false, writeFile = true} = obj;
    const {ejsContent} = this;
    try {

      const fileExists = await promisify(fs.exists)(path.join(this.dir, this.filename));

      /!* file exists and *!/
      if (writeFile && fileExists && !force)
        return;

      /!* ejs render the file *!/
      let generatedCode = null;
      generatedCode = ejs.render(ejsContent, {data: ejsData});

      if (!process.env.TS_ENABLED) {
        /!* prettify the received file *!/
        generatedCode = beautify(generatedCode, {indent_size: 2, space_in_empty_paren: true});
      } else {
        generatedCode = beautify(generatedCode, {indent_size: 2, space_in_empty_paren: true});
      }

      if (writeFile) {
        /!* create dir if not exists *!/

        await promisify(mkdirp)(this.dir);
        /!* Take a backup of the file *!/
        if (force && fileExists) {
          /!* newFileName = oldFileName + Date + extension *!/
          let newFileName = this.filename.split('.')
          const extension = newFileName.pop();
          newFileName.push(dayjs().format('YYMMDD_HHmmss'));
          newFileName.push(extension);
          newFileName = newFileName.join('.');
          if (md5(generatedCode) === md5(fs.readFileSync(path.join(this.dir, this.filename)))) return;
          await fsExtra.copy(path.join(this.dir, this.filename), path.join(this.dir, newFileName));
        }

        /!* create file *!/
        fs.writeFileSync(path.join(this.dir, this.filename), generatedCode, 'utf8');
      } else {
        return generatedCode;
      }
    } catch (e) {
      console.log(`Error rendering template ${ejsPath} in ${this.dir}/${this.filename}\n\n`, e);
      throw e;
    }

  }
*/
}

export default BaseRender;
