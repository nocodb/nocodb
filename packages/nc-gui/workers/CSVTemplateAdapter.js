import { parse } from 'papaparse';
import { UITypes } from 'nocodb-sdk';

export class CSVTemplateAdapter {
  constructor(source, parserConfig = {}, progressCallback) {
    this.config = parserConfig;
    this.source = source;
    this.project = {
      tables: [],
    };
    this.detectedColumnTypes = {};
    this.distinctValues = {};
    this.headers = {};
    this.columnValues = {};
    this.tables = {};
    this.progressCallback = progressCallback;
    this.data = {};
  }

  async init() {
  }

  initTemplate(tableIdx, tn, columnNames) {
    const columnNameRowExist = columnNames.every((v) => v === null || typeof v === 'string');
    const columnNamePrefixRef = {id: 0};

    const tableObj = {
      table_name: tn,
      ref_table_name: tn,
      columns: [],
    };

    this.headers[tableIdx] = [];
    this.tables[tableIdx] = [];

    for (const [columnIdx, columnName] of columnNames.entries()) {
      let cn = ((columnNameRowExist && columnName.toString().trim()) || `field_${columnIdx + 1}`)
        .replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '_')
        .trim();
      while (cn in columnNamePrefixRef) {
        cn = `${cn}${++columnNamePrefixRef[cn]}`;
      }
      columnNamePrefixRef[cn] = 0;

      this.detectedColumnTypes[columnIdx] = {};
      this.distinctValues[columnIdx] = new Set();
      this.columnValues[columnIdx] = [];
      tableObj.columns.push({
        column_name: cn,
        ref_column_name: cn,
        meta: {},
        uidt: UITypes.SingleLineText,
        key: columnIdx,
      });

      this.headers[tableIdx].push(cn);
      this.tables[tableIdx] = tableObj;
    }
  }

  detectInitialUidt(v) {
    if (!isNaN(Number(v)) && !isNaN(parseFloat(v))) return UITypes.Number;
    if (validateDateWithUnknownFormat(v)) return UITypes.DateTime;
    if (['true', 'True', 'false', 'False', '1', '0', 'T', 'F', 'Y', 'N'].includes(v)) return UITypes.Checkbox;
    return UITypes.SingleLineText;
  }

  detectColumnType(tableIdx, data) {
    for (let columnIdx = 0; columnIdx < data.length; columnIdx++) {
      if (!data[columnIdx]) continue;
      const colData = [data[columnIdx]];
      const colProps = {uidt: this.detectInitialUidt(data[columnIdx])};

      if (isMultiLineTextType(colData)) {
        colProps.uidt = UITypes.LongText;
      } else if (colProps.uidt === UITypes.SingleLineText) {
        if (isEmailType(colData)) {
          colProps.uidt = UITypes.Email;
        }
        if (isUrlType(colData)) {
          colProps.uidt = UITypes.URL;
        } else {
          const checkboxType = isCheckboxType(colData);
          if (checkboxType.length === 1) {
            colProps.uidt = UITypes.Checkbox;
          } else {
            if (data[columnIdx] && columnIdx < this.config.maxRowsToParse) {
              this.columnValues[columnIdx].push(data[columnIdx]);
              colProps.uidt = UITypes.SingleSelect;
            }
          }
        }
      } else if (colProps.uidt === UITypes.Number) {
        if (isDecimalType(colData)) {
          colProps.uidt = UITypes.Decimal;
        }
      } else if (colProps.uidt === UITypes.DateTime) {
        if (data[columnIdx] && columnIdx < this.config.maxRowsToParse) {
          this.columnValues[columnIdx].push(data[columnIdx]);
        }
      }

      if (!(colProps.uidt in this.detectedColumnTypes[columnIdx])) {
        this.detectedColumnTypes[columnIdx] = {
          ...this.detectedColumnTypes[columnIdx],
          [colProps.uidt]: 0,
        };
      }

      this.detectedColumnTypes[columnIdx][colProps.uidt] += 1;

      if (data[columnIdx]) {
        this.distinctValues[columnIdx].add(data[columnIdx]);
      }
    }
  }

  getPossibleUidt(columnIdx) {
    const detectedColTypes = this.detectedColumnTypes[columnIdx];
    const len = Object.keys(detectedColTypes).length;

    if (len === 0) {
      return UITypes.SingleLineText;
    }

    if (len === 2 && UITypes.Number in detectedColTypes && UITypes.Decimal in detectedColTypes) {
      return UITypes.Decimal;
    }

    if (len > 1) {
      if (UITypes.LongText in detectedColTypes) {
        return UITypes.LongText;
      }
      return UITypes.SingleLineText;
    }

    return Object.keys(detectedColTypes)[0];
  }

  updateTemplate(tableIdx) {
    for (let columnIdx = 0; columnIdx < this.headers[tableIdx].length; columnIdx++) {
      const uidt = this.getPossibleUidt(columnIdx);

      if (this.columnValues[columnIdx].length > 0) {
        if (uidt === UITypes.DateTime) {
          const dateFormat = {};

          if (
            this.columnValues[columnIdx].slice(1, this.config.maxRowsToParse).every((v) => {
              const isDate = v.split(' ').length === 1;
              if (isDate) {
                dateFormat[getDateFormat(v)] = (dateFormat[getDateFormat(v)] || 0) + 1;
              }
              return isDate;
            })
          ) {
            this.tables[tableIdx].columns[columnIdx].uidt = UITypes.Date;
            const objKeys = Object.keys(dateFormat);
            this.tables[tableIdx].columns[columnIdx].meta.date_format = objKeys.length
              ? objKeys.reduce((x, y) => (dateFormat[x] > dateFormat[y] ? x : y))
              : 'YYYY/MM/DD';
          } else {
            this.tables[tableIdx].columns[columnIdx].uidt = uidt;
          }
        } else if (uidt === UITypes.SingleSelect || uidt === UITypes.MultiSelect) {
          this.tables[tableIdx].columns[columnIdx].uidt = UITypes.SingleLineText;
          Object.assign(this.tables[tableIdx].columns[columnIdx], extractMultiOrSingleSelectProps(this.columnValues[columnIdx]));
        } else {
          this.tables[tableIdx].columns[columnIdx].uidt = uidt;
        }

        delete this.columnValues[columnIdx];
      } else {
        this.tables[tableIdx].columns[columnIdx].uidt = uidt;
      }
    }
  }

  async _parseTableData(tableIdx, source, tn) {
    return new Promise((resolve, reject) => {
      const that = this;
      let steppers = 0;

      if (that.config.shouldImportData) {
        that.progress(`Processing ${tn} data`);
        steppers = 0;
        const parseSource = this.config.importFromURL ? source : source.originFileObj;

        parse(parseSource, {
          download: that.config.importFromURL,
          skipEmptyLines: 'greedy',
          step(row) {
            steppers += 1;
            if (row && steppers >= +that.config.firstRowAsHeaders + 1) {
              const rowData = {};
              for (let columnIdx = 0; columnIdx < that.headers[tableIdx].length; columnIdx++) {
                const column = that.tables[tableIdx].columns[columnIdx];
                const data = (row.data[columnIdx] === '' ? null : row.data[columnIdx]);

                if (column.uidt === UITypes.Checkbox) {
                  rowData[column.column_name] = getCheckboxValue(data);
                  rowData[column.column_name] = data;
                } else if (column.uidt === UITypes.SingleSelect || column.uidt === UITypes.MultiSelect) {
                  rowData[column.column_name] = (data || '').toString().trim() || null;
                } else {
                  rowData[column.column_name] = data;
                }
              }

              that.data[tn].push(rowData);

              if (steppers % 1000 === 0) {
                that.progress(`Processed ${steppers} rows of ${tn}`);
              }
            }
          },
          complete() {
            that.progress(`Processed ${tn} data`);
            resolve(true);
          },
          error(e) {
            reject(e);
          },
        });
      } else {
        resolve(true);
      }
    });
  }

  async _parseTableMeta(tableIdx, source) {
    return new Promise((resolve, reject) => {
      const that = this;
      let steppers = 0;
      const tn = (this.config.importFromURL ? source.split('/').pop() : source.name)
        .replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '_')
        .trim();
      this.data[tn] = [];
      const parseSource = this.config.importFromURL ? source : source.originFileObj;

      parse(parseSource, {
        download: that.config.importFromURL,
        skipEmptyLines: 'greedy',
        step(row) {
          steppers += 1;
          if (row) {
            if (steppers === 1) {
              if (that.config.firstRowAsHeaders) {
                that.initTemplate(tableIdx, tn, row.data);
              } else {
                that.initTemplate(
                  tableIdx,
                  tn,
                  [...Array(row.data.length)].map((_, i) => `field_${i + 1}`),
                );
                if (that.config.autoSelectFieldTypes) {
                  that.detectColumnType(tableIdx, row.data);
                }
              }
            } else {
              if (that.config.autoSelectFieldTypes) {
                that.detectColumnType(tableIdx, row.data);
              }
            }
          }
        },
        async complete() {
          that.updateTemplate(tableIdx);
          that.project.tables.push(that.tables[tableIdx]);
          that.progress(`Processed ${tn} metadata`);
          await that._parseTableData(tableIdx, source, tn);
          resolve(true);
        },
        error(e) {
          reject(e);
        },
      });
    });
  }

  async parse() {
    if (this.config.importFromURL) {
      await this._parseTableMeta(0, this.source);
    } else {
      await Promise.all(
        this.source.map(async (file, tableIdx) => {
          this.progress(`Parsing ${file.name}`);
          await this._parseTableMeta(tableIdx, file);
        }),
      );
    }
  }

  getColumns() {
    return this.project.tables.map((t) => t.columns);
  }

  getData() {
    return this.data;
  }

  getTemplate() {
    return this.project;
  }

  progress(msg) {
    this.progressCallback?.(msg);
  }
}
