(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["libs"] = factory();
	else
		root["libs"] = factory();
})(typeof self !== 'undefined' ? self : this, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 302:
/***/ ((module) => {

module.exports = require("xlsx");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/create fake namespace object */
/******/ 	(() => {
/******/ 		var getProto = Object.getPrototypeOf ? (obj) => (Object.getPrototypeOf(obj)) : (obj) => (obj.__proto__);
/******/ 		var leafPrototypes;
/******/ 		// create a fake namespace object
/******/ 		// mode & 1: value is a module id, require it
/******/ 		// mode & 2: merge all properties of value into the ns
/******/ 		// mode & 4: return value when already ns object
/******/ 		// mode & 16: return value when it's Promise-like
/******/ 		// mode & 8|1: behave like require
/******/ 		__webpack_require__.t = function(value, mode) {
/******/ 			if(mode & 1) value = this(value);
/******/ 			if(mode & 8) return value;
/******/ 			if(typeof value === 'object' && value) {
/******/ 				if((mode & 4) && value.__esModule) return value;
/******/ 				if((mode & 16) && typeof value.then === 'function') return value;
/******/ 			}
/******/ 			var ns = Object.create(null);
/******/ 			__webpack_require__.r(ns);
/******/ 			var def = {};
/******/ 			leafPrototypes = leafPrototypes || [null, getProto({}), getProto([]), getProto(getProto)];
/******/ 			for(var current = mode & 2 && value; typeof current == 'object' && !~leafPrototypes.indexOf(current); current = getProto(current)) {
/******/ 				Object.getOwnPropertyNames(current).forEach((key) => (def[key] = () => (value[key])));
/******/ 			}
/******/ 			def['default'] = () => (value);
/******/ 			__webpack_require__.d(ns, def);
/******/ 			return ns;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "CSVTemplateAdapter": () => (/* reexport */ CSVTemplateAdapter),
  "ExcelTemplateAdapter": () => (/* reexport */ ExcelTemplateAdapter),
  "ExcelUrlTemplateAdapter": () => (/* reexport */ ExcelUrlTemplateAdapter),
  "JSONTemplateAdapter": () => (/* reexport */ JSONTemplateAdapter),
  "JSONUrlTemplateAdapter": () => (/* reexport */ JSONUrlTemplateAdapter)
});

;// CONCATENATED MODULE: external "nocodb-sdk"
const external_nocodb_sdk_namespaceObject = require("nocodb-sdk");
;// CONCATENATED MODULE: external "validator/lib/isURL"
const isURL_namespaceObject = require("validator/lib/isURL");
var isURL_default = /*#__PURE__*/__webpack_require__.n(isURL_namespaceObject);
;// CONCATENATED MODULE: ./utils/parsers/parserHelpers.ts


const validateEmail = (v) => /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i.test(v);
const booleanOptions = [
    { checked: true, unchecked: false },
    { 'x': true, '': false },
    { yes: true, no: false },
    { y: true, n: false },
    { 1: true, 0: false },
    { '[x]': true, '[]': false, '[ ]': false },
    { '☑': true, '': false },
    { '✅': true, '': false },
    { '✓': true, '': false },
    { '✔': true, '': false },
    { enabled: true, disabled: false },
    { on: true, off: false },
    { 'done': true, '': false },
    { true: true, false: false },
];
const aggBooleanOptions = booleanOptions.reduce((obj, o) => ({ ...obj, ...o }), {});
const getColVal = (row, col) => {
    return row && col !== undefined ? row[col] : row;
};
const parserHelpers_isCheckboxType = (values, col) => {
    let options = booleanOptions;
    for (let i = 0; i < values.length; i++) {
        const val = getColVal(values[i], col);
        if (val === null || val === undefined || val.toString().trim() === '') {
            continue;
        }
        options = options.filter((v) => val in v);
        if (!options.length) {
            return false;
        }
    }
    return options;
};
const parserHelpers_getCheckboxValue = (value) => {
    return value && aggBooleanOptions[value];
};
const parserHelpers_isMultiLineTextType = (values, col) => {
    return values.some((r) => (getColVal(r, col) || '').toString().match(/[\r\n]/) || (getColVal(r, col) || '').toString().length > 255);
};
const parserHelpers_extractMultiOrSingleSelectProps = (colData) => {
    const maxSelectOptionsAllowed = 64;
    const colProps = {};
    if (colData.some((v) => v && (v || '').toString().includes(','))) {
        const flattenedVals = colData.flatMap((v) => v
            ? v
                .toString()
                .trim()
                .split(/\s*,\s*/)
            : []);
        const uniqueVals = [...new Set(flattenedVals.filter(v => v !== null && v !== undefined).map((v) => v.toString().trim()))];
        if (uniqueVals.length > maxSelectOptionsAllowed) {
            // too many options are detected, convert the column to SingleLineText instead
            colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.SingleLineText;
            // _disableSelect is used to disable the <a-select-option/> in TemplateEditor
            colProps._disableSelect = true;
        }
        else {
            // assume the column type is multiple select if there are repeated values
            if (flattenedVals.length > uniqueVals.length && uniqueVals.length <= Math.ceil(flattenedVals.length / 2)) {
                colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.MultiSelect;
            }
            // set dtxp here so that users can have the options even they switch the type from other types to MultiSelect
            // once it's set, dtxp needs to be reset if the final column type is not MultiSelect
            colProps.dtxp = `${uniqueVals.map((v) => `'${v.replace(/'/gi, "''")}'`).join(',')}`;
        }
    }
    else {
        const uniqueVals = [...new Set(colData.filter(v => v !== null && v !== undefined).map((v) => v.toString().trim()))];
        if (uniqueVals.length > maxSelectOptionsAllowed) {
            // too many options are detected, convert the column to SingleLineText instead
            colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.SingleLineText;
            // _disableSelect is used to disable the <a-select-option/> in TemplateEditor
            colProps._disableSelect = true;
        }
        else {
            // assume the column type is single select if there are repeated values
            // once it's set, dtxp needs to be reset if the final column type is not Single Select
            if (colData.length > uniqueVals.length && uniqueVals.length <= Math.ceil(colData.length / 2)) {
                colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.SingleSelect;
            }
            // set dtxp here so that users can have the options even they switch the type from other types to SingleSelect
            // once it's set, dtxp needs to be reset if the final column type is not SingleSelect
            colProps.dtxp = `${uniqueVals.map((v) => `'${v.replace(/'/gi, "''")}'`).join(',')}`;
        }
        return colProps;
    }
};
const extractSelectOptions = (colData, type) => {
    const colProps = {};
    if (type === UITypes.MultiSelect) {
        const flattenedVals = colData.flatMap((v) => v
            ? v
                .toString()
                .trim()
                .split(/\s*,\s*/)
            : []);
        const uniqueVals = [...new Set(flattenedVals.map((v) => v.toString().trim()))];
        colProps.uidt = UITypes.MultiSelect;
        colProps.dtxp = `${uniqueVals.map((v) => `'${v.replace(/'/gi, "''")}'`).join(',')}`;
    }
    else {
        const uniqueVals = [...new Set(colData.map((v) => v.toString().trim()))];
        colProps.uidt = UITypes.SingleSelect;
        colProps.dtxp = `${uniqueVals.map((v) => `'${v.replace(/'/gi, "''")}'`).join(',')}`;
    }
    return colProps;
};
const parserHelpers_isDecimalType = (colData) => colData.some((v) => {
    return v && parseInt(v) !== +v;
});
const parserHelpers_isEmailType = (colData, col) => colData.some((r) => {
    const v = getColVal(r, col);
    return v && validateEmail(v);
});
const parserHelpers_isUrlType = (colData, col) => colData.some((r) => {
    const v = getColVal(r, col);
    return v && isURL_default()(v);
});
const getColumnUIDTAndMetas = (colData, defaultType) => {
    const colProps = { uidt: defaultType };
    if (colProps.uidt === external_nocodb_sdk_namespaceObject.UITypes.SingleLineText) {
        // check for long text
        if (parserHelpers_isMultiLineTextType(colData)) {
            colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.LongText;
        }
        if (parserHelpers_isEmailType(colData)) {
            colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.Email;
        }
        if (parserHelpers_isUrlType(colData)) {
            colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.URL;
        }
        else {
            const checkboxType = parserHelpers_isCheckboxType(colData);
            if (checkboxType.length === 1) {
                colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.Checkbox;
            }
            else {
                Object.assign(colProps, parserHelpers_extractMultiOrSingleSelectProps(colData));
            }
        }
    }
    else if (colProps.uidt === external_nocodb_sdk_namespaceObject.UITypes.Number) {
        if (parserHelpers_isDecimalType(colData)) {
            colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.Decimal;
        }
    }
    // TODO(import): currency
    // TODO(import): date / datetime
    return colProps;
};

;// CONCATENATED MODULE: ./utils/parsers/TemplateGenerator.ts
class TemplateGenerator {
    progressCallback;
    constructor(progressCallback) {
        this.progressCallback = progressCallback;
    }
    progress(msg) {
        this.progressCallback?.(msg);
    }
    init() { }
    parse() {
        throw new Error("'parse' method is not implemented");
    }
    parseData() {
        throw new Error("'parseData' method is not implemented");
    }
    parseTemplate() {
        throw new Error("'parseTemplate' method is not implemented");
    }
    getColumns() {
        throw new Error("'getColumns' method is not implemented");
    }
    getTemplate() {
        throw new Error("'getTemplate' method is not implemented");
    }
    getData() {
        throw new Error("'getData' method is not implemented");
    }
}

;// CONCATENATED MODULE: ./utils/parsers/JSONTemplateAdapter.ts



const jsonTypeToUidt = {
    number: external_nocodb_sdk_namespaceObject.UITypes.Number,
    string: external_nocodb_sdk_namespaceObject.UITypes.SingleLineText,
    date: external_nocodb_sdk_namespaceObject.UITypes.DateTime,
    boolean: external_nocodb_sdk_namespaceObject.UITypes.Checkbox,
    object: external_nocodb_sdk_namespaceObject.UITypes.JSON,
};
const extractNestedData = (obj, path) => path.reduce((val, key) => val && val[key], obj);
class JSONTemplateAdapter extends TemplateGenerator {
    config;
    data;
    _jsonData;
    jsonData;
    project;
    columns;
    constructor(data, parserConfig = {}, progressCallback) {
        super(progressCallback);
        this.config = parserConfig;
        this._jsonData = data;
        this.project = {
            tables: [],
        };
        this.jsonData = [];
        this.data = [];
        this.columns = {};
    }
    async init() {
        this.progress('Initializing json parser');
        const parsedJsonData = typeof this._jsonData === 'string'
            ? // for json editor
                JSON.parse(this._jsonData)
            : // for file upload
                JSON.parse(new TextDecoder().decode(this._jsonData));
        this.jsonData = Array.isArray(parsedJsonData) ? parsedJsonData : [parsedJsonData];
    }
    getColumns() {
        return this.columns;
    }
    getData() {
        return this.data;
    }
    parse() {
        this.progress('Parsing json data');
        const jsonData = this.jsonData;
        const tn = 'table';
        const table = { table_name: tn, ref_table_name: tn, columns: [] };
        this.data[tn] = [];
        for (const col of Object.keys(jsonData[0])) {
            const columns = this._parseColumn([col], jsonData);
            table.columns.push(...columns);
        }
        if (this.config.shouldImportData) {
            this._parseTableData(table);
        }
        this.project.tables.push(table);
    }
    getTemplate() {
        return this.project;
    }
    _parseColumn(path = [], jsonData = this.jsonData, firstRowVal = path.reduce((val, k) => val && val[k], this.jsonData[0])) {
        const columns = [];
        // parse nested
        if (firstRowVal && typeof firstRowVal === 'object' && !Array.isArray(firstRowVal) && this.config.normalizeNested) {
            for (const key of Object.keys(firstRowVal)) {
                const normalizedNestedColumns = this._parseColumn([...path, key], this.jsonData, firstRowVal[key]);
                columns.push(...normalizedNestedColumns);
            }
        }
        else {
            const cn = path.join('_').replace(/\W/g, '_').trim();
            const column = {
                column_name: cn,
                ref_column_name: cn,
                uidt: external_nocodb_sdk_namespaceObject.UITypes.SingleLineText,
                path,
            };
            if (this.config.autoSelectFieldTypes) {
                column.uidt = jsonTypeToUidt[typeof firstRowVal] || external_nocodb_sdk_namespaceObject.UITypes.SingleLineText;
                const colData = jsonData.map((r) => extractNestedData(r, path));
                Object.assign(column, getColumnUIDTAndMetas(colData, column.uidt));
            }
            columns.push(column);
        }
        return columns;
    }
    _parseTableData(tableMeta) {
        for (const row of this.jsonData) {
            const rowData = {};
            for (let i = 0; i < tableMeta.columns.length; i++) {
                const value = extractNestedData(row, tableMeta.columns[i].path || []);
                if (tableMeta.columns[i].uidt === external_nocodb_sdk_namespaceObject.UITypes.Checkbox) {
                    rowData[tableMeta.columns[i].ref_column_name] = parserHelpers_getCheckboxValue(value);
                }
                else if (tableMeta.columns[i].uidt === external_nocodb_sdk_namespaceObject.UITypes.SingleSelect || tableMeta.columns[i].uidt === external_nocodb_sdk_namespaceObject.UITypes.MultiSelect) {
                    rowData[tableMeta.columns[i].ref_column_name] = (value || '').toString().trim() || null;
                }
                else if (tableMeta.columns[i].uidt === external_nocodb_sdk_namespaceObject.UITypes.JSON) {
                    rowData[tableMeta.columns[i].ref_column_name] = JSON.stringify(value);
                }
                else {
                    // toto: do parsing if necessary based on type
                    rowData[tableMeta.columns[i].column_name] = value;
                }
            }
            this.data[tableMeta.ref_table_name].push(rowData);
        }
    }
}

;// CONCATENATED MODULE: ./utils/parsers/JSONUrlTemplateAdapter.ts

// import { useNuxtApp } from '#app'
class JSONUrlTemplateAdapter extends JSONTemplateAdapter {
    url;
    $api;
    constructor(url, parserConfig, progressCallback) {
        // const { $api } = useNuxtApp()
        super({}, parserConfig, progressCallback);
        this.url = url;
        // this.$api = $api
    }
    async init() {
        this.progress('Downloading json file');
        const data = await this.$api.utils.axiosRequestMake({
            apiMeta: {
                url: this.url,
            },
        });
        this._jsonData = data;
        await super.init();
    }
}

;// CONCATENATED MODULE: external "papaparse"
const external_papaparse_namespaceObject = require("papaparse");
;// CONCATENATED MODULE: ./utils/parsers/CSVTemplateAdapter.ts

// import type { UploadFile } from 'ant-design-vue'

// import {
//   extractMultiOrSingleSelectProps,
//   getCheckboxValue,
//   getDateFormat,
//   isCheckboxType,
//   isDecimalType,
//   isEmailType,
//   isMultiLineTextType,
//   isUrlType,
//   validateDateWithUnknownFormat,
// } from '#imports'
class CSVTemplateAdapter {
    config;
    source;
    detectedColumnTypes;
    distinctValues;
    headers;
    tables;
    project;
    data = {};
    columnValues;
    progressCallback;
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
    }
    async init() { }
    initTemplate(tableIdx, tn, columnNames) {
        const columnNameRowExist = +columnNames.every((v) => v === null || typeof v === 'string');
        const columnNamePrefixRef = { id: 0 };
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
                uidt: external_nocodb_sdk_namespaceObject.UITypes.SingleLineText,
                key: columnIdx,
            });
            this.headers[tableIdx].push(cn);
            this.tables[tableIdx] = tableObj;
        }
    }
    detectInitialUidt(v) {
        if (!isNaN(Number(v)) && !isNaN(parseFloat(v)))
            return external_nocodb_sdk_namespaceObject.UITypes.Number;
        if (validateDateWithUnknownFormat(v))
            return external_nocodb_sdk_namespaceObject.UITypes.DateTime;
        if (['true', 'True', 'false', 'False', '1', '0', 'T', 'F', 'Y', 'N'].includes(v))
            return external_nocodb_sdk_namespaceObject.UITypes.Checkbox;
        return external_nocodb_sdk_namespaceObject.UITypes.SingleLineText;
    }
    detectColumnType(tableIdx, data) {
        for (let columnIdx = 0; columnIdx < data.length; columnIdx++) {
            // skip null data
            if (!data[columnIdx])
                continue;
            const colData = [data[columnIdx]];
            const colProps = { uidt: this.detectInitialUidt(data[columnIdx]) };
            // TODO(import): centralise
            if (isMultiLineTextType(colData)) {
                colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.LongText;
            }
            else if (colProps.uidt === external_nocodb_sdk_namespaceObject.UITypes.SingleLineText) {
                if (isEmailType(colData)) {
                    colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.Email;
                }
                if (isUrlType(colData)) {
                    colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.URL;
                }
                else {
                    const checkboxType = isCheckboxType(colData);
                    if (checkboxType.length === 1) {
                        colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.Checkbox;
                    }
                    else {
                        if (data[columnIdx] && columnIdx < this.config.maxRowsToParse) {
                            this.columnValues[columnIdx].push(data[columnIdx]);
                            colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.SingleSelect;
                        }
                    }
                }
            }
            else if (colProps.uidt === external_nocodb_sdk_namespaceObject.UITypes.Number) {
                if (isDecimalType(colData)) {
                    colProps.uidt = external_nocodb_sdk_namespaceObject.UITypes.Decimal;
                }
            }
            else if (colProps.uidt === external_nocodb_sdk_namespaceObject.UITypes.DateTime) {
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
        // all records are null
        if (len === 0) {
            return external_nocodb_sdk_namespaceObject.UITypes.SingleLineText;
        }
        // handle numeric case
        if (len === 2 && external_nocodb_sdk_namespaceObject.UITypes.Number in detectedColTypes && external_nocodb_sdk_namespaceObject.UITypes.Decimal in detectedColTypes) {
            return external_nocodb_sdk_namespaceObject.UITypes.Decimal;
        }
        // if there are multiple detected column types
        // then return either LongText or SingleLineText
        if (len > 1) {
            if (external_nocodb_sdk_namespaceObject.UITypes.LongText in detectedColTypes) {
                return external_nocodb_sdk_namespaceObject.UITypes.LongText;
            }
            return external_nocodb_sdk_namespaceObject.UITypes.SingleLineText;
        }
        // otherwise, all records have the same column type
        return Object.keys(detectedColTypes)[0];
    }
    updateTemplate(tableIdx) {
        for (let columnIdx = 0; columnIdx < this.headers[tableIdx].length; columnIdx++) {
            const uidt = this.getPossibleUidt(columnIdx);
            if (this.columnValues[columnIdx].length > 0) {
                if (uidt === external_nocodb_sdk_namespaceObject.UITypes.DateTime) {
                    const dateFormat = {};
                    if (this.columnValues[columnIdx].slice(1, this.config.maxRowsToParse).every((v) => {
                        const isDate = v.split(' ').length === 1;
                        if (isDate) {
                            dateFormat[getDateFormat(v)] = (dateFormat[getDateFormat(v)] || 0) + 1;
                        }
                        return isDate;
                    })) {
                        this.tables[tableIdx].columns[columnIdx].uidt = external_nocodb_sdk_namespaceObject.UITypes.Date;
                        // take the date format with the max occurrence
                        const objKeys = Object.keys(dateFormat);
                        this.tables[tableIdx].columns[columnIdx].meta.date_format = objKeys.length
                            ? objKeys.reduce((x, y) => (dateFormat[x] > dateFormat[y] ? x : y))
                            : 'YYYY/MM/DD';
                    }
                    else {
                        // Datetime
                        this.tables[tableIdx].columns[columnIdx].uidt = uidt;
                    }
                }
                else if (uidt === external_nocodb_sdk_namespaceObject.UITypes.SingleSelect || uidt === external_nocodb_sdk_namespaceObject.UITypes.MultiSelect) {
                    // assume it is a SingleLineText first
                    this.tables[tableIdx].columns[columnIdx].uidt = external_nocodb_sdk_namespaceObject.UITypes.SingleLineText;
                    // override with UITypes.SingleSelect or UITypes.MultiSelect if applicable
                    Object.assign(this.tables[tableIdx].columns[columnIdx], extractMultiOrSingleSelectProps(this.columnValues[columnIdx]));
                }
                else {
                    this.tables[tableIdx].columns[columnIdx].uidt = uidt;
                }
                delete this.columnValues[columnIdx];
            }
            else {
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
                const parseSource = (this.config.importFromURL ? source : source.originFileObj);
                (0,external_papaparse_namespaceObject.parse)(parseSource, {
                    download: that.config.importFromURL,
                    // worker: true,
                    skipEmptyLines: 'greedy',
                    step(row) {
                        steppers += 1;
                        if (row && steppers >= +that.config.firstRowAsHeaders + 1) {
                            const rowData = {};
                            for (let columnIdx = 0; columnIdx < that.headers[tableIdx].length; columnIdx++) {
                                const column = that.tables[tableIdx].columns[columnIdx];
                                const data = row.data[columnIdx] === '' ? null : row.data[columnIdx];
                                if (column.uidt === external_nocodb_sdk_namespaceObject.UITypes.Checkbox) {
                                    rowData[column.column_name] = getCheckboxValue(data);
                                    rowData[column.column_name] = data;
                                }
                                else if (column.uidt === external_nocodb_sdk_namespaceObject.UITypes.SingleSelect || column.uidt === external_nocodb_sdk_namespaceObject.UITypes.MultiSelect) {
                                    rowData[column.column_name] = (data || '').toString().trim() || null;
                                }
                                else {
                                    // TODO(import): do parsing if necessary based on type
                                    rowData[column.column_name] = data;
                                }
                            }
                            that.data[tn].push(rowData);
                        }
                        if (steppers % 1000 === 0) {
                            that.progress(`Processed ${steppers} rows of ${tn}`);
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
            }
            else {
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
            const parseSource = (this.config.importFromURL ? source : source.originFileObj);
            (0,external_papaparse_namespaceObject.parse)(parseSource, {
                download: that.config.importFromURL,
                skipEmptyLines: 'greedy',
                step(row) {
                    steppers += 1;
                    if (row) {
                        if (steppers === 1) {
                            if (that.config.firstRowAsHeaders) {
                                // row.data is header
                                that.initTemplate(tableIdx, tn, row.data);
                            }
                            else {
                                // use dummy column names as header
                                that.initTemplate(tableIdx, tn, [...Array(row.data.length)].map((_, i) => `field_${i + 1}`));
                                if (that.config.autoSelectFieldTypes) {
                                    // row.data is data
                                    that.detectColumnType(tableIdx, row.data);
                                }
                            }
                        }
                        else {
                            if (that.config.autoSelectFieldTypes) {
                                // row.data is data
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
        }
        else {
            await Promise.all(this.source.map((file, tableIdx) => (async (f, idx) => {
                this.progress(`Parsing ${f.name}`);
                await this._parseTableMeta(idx, f);
            })(file, tableIdx)));
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

;// CONCATENATED MODULE: ./utils/parsers/ExcelTemplateAdapter.ts


// import {
//   extractMultiOrSingleSelectProps,
//   getCheckboxValue,
//   getDateFormat,
//   isCheckboxType,
//   isEmailType,
//   isMultiLineTextType,
//   isUrlType,
// } from '#imports'
const excelTypeToUidt = {
    d: external_nocodb_sdk_namespaceObject.UITypes.DateTime,
    b: external_nocodb_sdk_namespaceObject.UITypes.Checkbox,
    n: external_nocodb_sdk_namespaceObject.UITypes.Number,
    s: external_nocodb_sdk_namespaceObject.UITypes.SingleLineText,
};
class ExcelTemplateAdapter extends TemplateGenerator {
    config;
    excelData;
    project;
    data = {};
    wb;
    xlsx;
    constructor(data = {}, parserConfig = {}, progressCallback) {
        super(progressCallback);
        this.config = parserConfig;
        this.excelData = data;
        this.project = {
            tables: [],
        };
        this.xlsx = {};
    }
    async init() {
        this.progress('Initializing excel parser');
        this.xlsx = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(__webpack_require__, 302, 23));
        const options = {
            cellText: true,
            cellDates: true,
        };
        this.wb = this.xlsx.read(new Uint8Array(this.excelData), {
            type: 'array',
            ...options,
        });
    }
    async parse() {
        this.progress('Parsing excel data');
        const tableNamePrefixRef = {};
        await Promise.all(this.wb.SheetNames.map((sheetName) => (async (sheet) => {
            this.progress(`Parsing sheet ${sheetName}`);
            await new Promise((resolve) => {
                const columnNamePrefixRef = { id: 0 };
                let tn = (sheet || 'table').replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '_').trim();
                while (tn in tableNamePrefixRef) {
                    tn = `${tn}${++tableNamePrefixRef[tn]}`;
                }
                tableNamePrefixRef[tn] = 0;
                const table = { table_name: tn, ref_table_name: tn, columns: [] };
                const ws = this.wb.Sheets[sheet];
                // if sheet is empty, skip it
                if (!ws || !ws['!ref']) {
                    return resolve(true);
                }
                const range = this.xlsx.utils.decode_range(ws['!ref']);
                let rows = this.xlsx.utils.sheet_to_json(ws, {
                    // header has to be 1 disregarding this.config.firstRowAsHeaders
                    // so that it generates an array of arrays
                    header: 1,
                    blankrows: false,
                    defval: null,
                });
                // fix precision bug & timezone offset issues introduced by xlsx
                const basedate = new Date(1899, 11, 30, 0, 0, 0);
                // number of milliseconds since base date
                const dnthresh = basedate.getTime() + (new Date().getTimezoneOffset() - basedate.getTimezoneOffset()) * 60000;
                // number of milliseconds in a day
                const day_ms = 24 * 60 * 60 * 1000;
                // handle date1904 property
                const fixImportedDate = (date) => {
                    const parsed = this.xlsx.SSF.parse_date_code((date.getTime() - dnthresh) / day_ms, {
                        date1904: this.wb.Workbook.WBProps.date1904,
                    });
                    return new Date(parsed.y, parsed.m, parsed.d, parsed.H, parsed.M, parsed.S);
                };
                // fix imported date
                rows = rows.map((r) => r.map((v) => {
                    return v instanceof Date ? fixImportedDate(v) : v;
                }));
                for (let col = 0; col < rows[0].length; col++) {
                    let cn = ((this.config.firstRowAsHeaders && rows[0] && rows[0][col] && rows[0][col].toString().trim()) ||
                        `field_${col + 1}`)
                        .replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '_')
                        .trim();
                    while (cn in columnNamePrefixRef) {
                        cn = `${cn}${++columnNamePrefixRef[cn]}`;
                    }
                    columnNamePrefixRef[cn] = 0;
                    const column = {
                        column_name: cn,
                        ref_column_name: cn,
                        meta: {},
                        uidt: external_nocodb_sdk_namespaceObject.UITypes.SingleLineText,
                    };
                    if (this.config.autoSelectFieldTypes) {
                        const cellId = this.xlsx.utils.encode_cell({
                            c: range.s.c + col,
                            r: +this.config.firstRowAsHeaders,
                        });
                        const cellProps = ws[cellId] || {};
                        column.uidt = excelTypeToUidt[cellProps.t] || external_nocodb_sdk_namespaceObject.UITypes.SingleLineText;
                        if (column.uidt === external_nocodb_sdk_namespaceObject.UITypes.SingleLineText) {
                            // check for long text
                            if (isMultiLineTextType(rows, col)) {
                                column.uidt = external_nocodb_sdk_namespaceObject.UITypes.LongText;
                            }
                            if (isEmailType(rows, col)) {
                                column.uidt = external_nocodb_sdk_namespaceObject.UITypes.Email;
                            }
                            if (isUrlType(rows, col)) {
                                column.uidt = external_nocodb_sdk_namespaceObject.UITypes.URL;
                            }
                            else {
                                const vals = rows
                                    .slice(+this.config.firstRowAsHeaders)
                                    .map((r) => r[col])
                                    .filter((v) => v !== null && v !== undefined && v.toString().trim() !== '');
                                const checkboxType = isCheckboxType(vals, col);
                                if (checkboxType.length === 1) {
                                    column.uidt = external_nocodb_sdk_namespaceObject.UITypes.Checkbox;
                                }
                                else {
                                    // Single Select / Multi Select
                                    Object.assign(column, extractMultiOrSingleSelectProps(vals));
                                }
                            }
                        }
                        else if (column.uidt === external_nocodb_sdk_namespaceObject.UITypes.Number) {
                            if (rows.slice(1, this.config.maxRowsToParse).some((v) => {
                                return v && v[col] && parseInt(v[col]) !== +v[col];
                            })) {
                                column.uidt = external_nocodb_sdk_namespaceObject.UITypes.Decimal;
                            }
                            if (rows.slice(1, this.config.maxRowsToParse).every((v, i) => {
                                const cellId = this.xlsx.utils.encode_cell({
                                    c: range.s.c + col,
                                    r: i + +this.config.firstRowAsHeaders,
                                });
                                const cellObj = ws[cellId];
                                return !cellObj || (cellObj.w && cellObj.w.startsWith('$'));
                            })) {
                                column.uidt = external_nocodb_sdk_namespaceObject.UITypes.Currency;
                            }
                            if (rows.slice(1, this.config.maxRowsToParse).some((v, i) => {
                                const cellId = this.xlsx.utils.encode_cell({
                                    c: range.s.c + col,
                                    r: i + +this.config.firstRowAsHeaders,
                                });
                                const cellObj = ws[cellId];
                                return !cellObj || (cellObj.w && !(!isNaN(Number(cellObj.w)) && !isNaN(parseFloat(cellObj.w))));
                            })) {
                                // fallback to SingleLineText
                                column.uidt = external_nocodb_sdk_namespaceObject.UITypes.SingleLineText;
                            }
                        }
                        else if (column.uidt === external_nocodb_sdk_namespaceObject.UITypes.DateTime) {
                            // TODO(import): centralise
                            // hold the possible date format found in the date
                            const dateFormat = {};
                            if (rows.slice(1, this.config.maxRowsToParse).every((v, i) => {
                                const cellId = this.xlsx.utils.encode_cell({
                                    c: range.s.c + col,
                                    r: i + +this.config.firstRowAsHeaders,
                                });
                                const cellObj = ws[cellId];
                                const isDate = !cellObj || (cellObj.w && cellObj.w.split(' ').length === 1);
                                if (isDate && cellObj) {
                                    dateFormat[getDateFormat(cellObj.w)] = (dateFormat[getDateFormat(cellObj.w)] || 0) + 1;
                                }
                                return isDate;
                            })) {
                                column.uidt = external_nocodb_sdk_namespaceObject.UITypes.Date;
                                // take the date format with the max occurrence
                                column.meta.date_format =
                                    Object.keys(dateFormat).reduce((x, y) => (dateFormat[x] > dateFormat[y] ? x : y)) || 'YYYY/MM/DD';
                            }
                        }
                    }
                    table.columns.push(column);
                }
                this.project.tables.push(table);
                this.data[tn] = [];
                if (this.config.shouldImportData) {
                    this.progress(`Importing data for ${tn}`);
                    let rowIndex = 0;
                    for (const row of rows.slice(1)) {
                        const rowData = {};
                        for (let i = 0; i < table.columns.length; i++) {
                            if (!this.config.autoSelectFieldTypes) {
                                // take raw data instead of data parsed by xlsx
                                const cellId = this.xlsx.utils.encode_cell({
                                    c: range.s.c + i,
                                    r: rowIndex + +this.config.firstRowAsHeaders,
                                });
                                const cellObj = ws[cellId];
                                rowData[table.columns[i].column_name] = (cellObj && cellObj.w) || row[i];
                            }
                            else {
                                if (table.columns[i].uidt === external_nocodb_sdk_namespaceObject.UITypes.Checkbox) {
                                    rowData[table.columns[i].column_name] = getCheckboxValue(row[i]);
                                }
                                else if (table.columns[i].uidt === external_nocodb_sdk_namespaceObject.UITypes.Currency) {
                                    const cellId = this.xlsx.utils.encode_cell({
                                        c: range.s.c + i,
                                        r: rowIndex + +this.config.firstRowAsHeaders,
                                    });
                                    const cellObj = ws[cellId];
                                    rowData[table.columns[i].column_name] =
                                        (cellObj && cellObj.w && cellObj.w.replace(/[^\d.]+/g, '')) || row[i];
                                }
                                else if (table.columns[i].uidt === external_nocodb_sdk_namespaceObject.UITypes.SingleSelect || table.columns[i].uidt === external_nocodb_sdk_namespaceObject.UITypes.MultiSelect) {
                                    rowData[table.columns[i].column_name] = (row[i] || '').toString().trim() || null;
                                }
                                else if (table.columns[i].uidt === external_nocodb_sdk_namespaceObject.UITypes.Date) {
                                    const cellId = this.xlsx.utils.encode_cell({
                                        c: range.s.c + i,
                                        r: rowIndex + +this.config.firstRowAsHeaders,
                                    });
                                    const cellObj = ws[cellId];
                                    rowData[table.columns[i].column_name] = (cellObj && cellObj.w) || row[i];
                                }
                                else if (table.columns[i].uidt === external_nocodb_sdk_namespaceObject.UITypes.SingleLineText || table.columns[i].uidt === external_nocodb_sdk_namespaceObject.UITypes.LongText) {
                                    rowData[table.columns[i].column_name] = row[i] === null || row[i] === undefined ? null : `${row[i]}`;
                                }
                                else {
                                    // TODO: do parsing if necessary based on type
                                    rowData[table.columns[i].column_name] = row[i];
                                }
                            }
                        }
                        this.data[tn].push(rowData);
                        rowIndex++;
                    }
                }
                resolve(true);
            });
        })(sheetName)));
    }
    getTemplate() {
        return this.project;
    }
    getData() {
        return this.data;
    }
    getColumns() {
        return this.project.tables.map((t) => t.columns);
    }
}

;// CONCATENATED MODULE: ./utils/parsers/ExcelUrlTemplateAdapter.ts

// import { useNuxtApp } from '#imports'
class ExcelUrlTemplateAdapter extends ExcelTemplateAdapter {
    url;
    excelData;
    $api;
    constructor(url, parserConfig, progressCallback) {
        // const { $api } = useNuxtApp()
        super({}, parserConfig, progressCallback);
        this.url = url;
        this.excelData = null;
        // this.$api = $api
    }
    async init() {
        this.progress('Downloading excel file');
        const data = await this.$api.utils.axiosRequestMake({
            apiMeta: {
                url: this.url,
            },
        });
        this.excelData = data.data;
        await super.init();
    }
}

;// CONCATENATED MODULE: ./utils/parsers/index.ts







})();

/******/ 	return __webpack_exports__;
/******/ })()
;
});