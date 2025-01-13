import { ActionType, InputType } from '../types'
import { useWorkspace } from '#imports'

export function generateIntegrationsCode(integrations: any[]): string {
  let code = 'const integrations = {'
  for (const integration of integrations) {
    const integrationMeta = allIntegrations.find(
      (item) => item.type === integration.type && item.subType === integration.sub_type,
    )!
    let propsCode = ''
    if (integrationMeta?.meta?.configSchema) {
      for (const [k, _v] of Object.entries(integrationMeta.meta.configSchema)) {
        propsCode += `${k}: '{{${integration.id}.${k}}}',`
      }
    }
    code += `
      ${integration.type}: {
        ${integration.title}: {
          ${propsCode}
        }
      },
    `
  }
  code += '}'
  return code
}

function generalHelpers() {
  return `
    const padZero = (val, isSSS = false) => {
      return \`\${val}\`.padStart(isSSS ? 3 : 2, '0')
    }
    
    const convertMS2Duration = (val, duration_format) => {
      const milliseconds = Math.round((val % 1) * 1000)
      const centiseconds = Math.round(milliseconds / 10)
      const deciseconds = Math.round(centiseconds / 10)
      const hours = Math.floor(parseInt(val, 10) / (60 * 60))
      const minutes = Math.floor((parseInt(val, 10) - hours * 60 * 60) / 60)
      const seconds = parseInt(val, 10) - hours * 60 * 60 - minutes * 60
      
      if (duration_format === 'h:mm') {
        return \`\${padZero(hours)}:\${padZero(minutes + (seconds >= 30 ? 1 : 0))}\`
      } else if (duration_format === 'h:mm:ss') {
        return \`\${padZero(hours)}:\${padZero(minutes)}:\${padZero(seconds)}\`
      } else if (duration_format === 'h:mm:ss.s') {
        return \`\${padZero(hours)}:\${padZero(minutes)}:\${padZero(seconds)}.\${deciseconds}\`
      } else if (duration_format === 'h:mm:ss.ss') {
        return \`\${padZero(hours)}:\${padZero(minutes)}:\${padZero(seconds)}.\${padZero(centiseconds)}\`
      } else if (duration_format === 'h:mm:ss.sss') {
        return \`\${padZero(hours)}:\${padZero(minutes)}:\${padZero(seconds)}.\${padZero(milliseconds, true)}\`
      }
      return val
    }
    
    const roundUpToPrecision = (number, precision = 0) => {
      precision =
        precision == null
          ? 0
          : precision >= 0
          ? Math.min(precision, 292)
          : Math.max(precision, -292);
      if (precision) {
        let pair = \`\${number}e\`.split('e');
        const value = Math.round(Number(\`\${pair[0]}e\${+pair[1] + precision}\`));
        pair = \`\${value}e\`.split('e');
        return (+\`\${pair[0]}e\${+pair[1] - precision}\`).toFixed(precision);
      }
      return Math.round(number).toFixed(precision);
    }
    
    const padZero2 = (num) => num.toString().padStart(2, "0");
    const padMilliseconds = (num) => num.toString().padStart(3, "0");
    
    const timeFormats = ['HH:mm', 'HH:mm:ss', 'HH:mm:ss.SSS'];
    
    const dateFormats = [
      'YYYY-MM-DD',
      'YYYY/MM/DD',
      'DD-MM-YYYY',
      'MM-DD-YYYY',
      'DD/MM/YYYY',
      'MM/DD/YYYY',
      'DD MM YYYY',
      'MM DD YYYY',
      'YYYY MM DD',
    ];
    
    const parseDateString = (dateStr, format) => {
      const patterns = {
        YYYY: "(\\\\d{4})",
        MM: "(\\\\d{2})",
        DD: "(\\\\d{2})",
        HH: "(\\\\d{2})",
        mm: "(\\\\d{2})",
        ss: "(\\\\d{2})",
        SSS: "(\\\\d{3})",
      };

      // Convert format to regex pattern
      let pattern = format;
      Object.keys(patterns).forEach((key) => {
        pattern = pattern.replace(key, patterns[key]);
      });
      pattern = \`^\${pattern}$\`;

      const regex = new RegExp(pattern);
      const match = dateStr.match(regex);
      if (!match) return null;
      
      // Extract parts based on format
      const parts = {
        year: 0,
        month: 0,
        day: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
      };

      let matchIndex = 1;
      const formatParts = format.match(/(YYYY|MM|DD|HH|mm|ss|SSS)/g);
      formatParts?.forEach((part) => {
        const value = parseInt(match[matchIndex++]);
        switch (part) {
          case "YYYY":
            parts.year = value;
            break;
          case "MM":
            parts.month = value - 1; // JS months are 0-based
            break;
          case "DD":
            parts.day = value;
            break;
          case "HH":
            parts.hours = value;
            break;
          case "mm":
            parts.minutes = value;
            break;
          case "ss":
            parts.seconds = value;
            break;
          case "SSS":
            parts.milliseconds = value;
          break;
        }
      });

      const date = new Date(
        parts.year,
        parts.month,
        parts.day,
        parts.hours || 0,
        parts.minutes || 0,
        parts.seconds || 0,
        parts.milliseconds || 0
      );

      return isValidDate(date) ? date : null;
    };
    
    const formatDate = (date, format) => {
      const year = date.getFullYear();
      const month = padZero(date.getMonth() + 1);
      const day = padZero(date.getDate());
      const hours24 = date.getHours();
      const hours12 = hours24 % 12 || 12;
      const minutes = padZero(date.getMinutes());
      const seconds = padZero(date.getSeconds());
      const milliseconds = padMilliseconds(date.getMilliseconds());
      const ampm = hours24 >= 12 ? 'PM' : 'AM';
      
      const is12Hr = format.includes('a') || format.includes('A');

      return format
        .replace('YYYY', year.toString())
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', padZero(is12Hr ? hours12 : hours24))
        .replace('hh', padZero(is12Hr ?  hours12 : hours24))
        .replace('mm', minutes)
        .replace('ss', seconds)
        .replace('SSS', milliseconds)
        .replace('A', ampm)
        .replace('a', ampm.toLowerCase());
    };
    
    const isValidDate = (date) => {
      return date instanceof Date && !isNaN(date.getTime());
    };
    
    const parseDate = (value, format) => {
      if (!value) return null;

      // Handle timestamp
      if (typeof value === "number" || /^\\d+$/.test(String(value))) {
        const timestamp = typeof value === "number" ? value : parseInt(String(value));
        return new Date(timestamp);
      }

      // If format is provided, try parsing with format first
      if (format) {
        const parsedDate = parseDateString(value.toString(), format);
        if (parsedDate) return parsedDate;
      }

      // Try all supported formats
      if (typeof value === "string") {
        // Try standard ISO format first
        const isoDate = new Date(value);
        if (isValidDate(isoDate)) return isoDate;

        // Try all date formats
        for (const dateFormat of dateFormats) {
          const date = parseDateString(value, dateFormat);
          if (date) return date;
        }
      }

      return null;
    };

  `
}

function generateBaseModels() {
  return `
  class Collaborator {
    constructor(data) {
      this.id = undefined;
      this.email = undefined;
      this.name = undefined;

      Object.defineProperty(this, 'id', {
        value: data.id,
        writable: false,
        configurable: true, // Need this true first time
        enumerable: true
      });
      Object.defineProperty(this, 'email', {
        value: data.email,
        writable: false,
        configurable: true,
        enumerable: true
      });
      Object.defineProperty(this, 'name', {
        value: data.name ?? null,
        writable: false,
        configurable: true,
        enumerable: true
      });
    }
  }
  
  const extractPk = (row, fields) => {
    if(!row || !fields?.length) return null
    
    const pkCols = fields.filter(f => f.pk)
       
    if(pkCols.length > 1) {
      return pkCols.map(pk => row[pk.name]?.toString?.().replaceAll('_', '\\\\_') ?? null).join('___')
    } else if(pkCols.length) {
      const id = row?.[pkCols[0].name] ?? null
      return id === null ? null : \`\${id}\`
    }
    return null
  }
  
  class RecordQueryResult {
    #table;
    #recordsById = new Map();
    #options;
    #view;
    #pageInfo;
    #rawData;
    
    constructor(data, table, view, options) {
      this.#table = table;
      this.#view = view;
      this.#options = options;
      this.#pageInfo = data.pageInfo;
      const records = []
      
      this.#rawData = data.list;
      
      this.recordIds = Object.freeze(data.list.map(row => {
        const record = new NocoDBRecord(row, table);
        records.push(record);
        this.#recordsById.set(record.id, record);
        return record.id;
      }));
      
      this.records = Object.freeze(records);
    }
    
    get raw_data() {
      return this.#rawData;
    }
    
    get table() {
      return this.#table;
    }
    
    getRecord(recordId) {
      const record = this.#recordsById.get(recordId);
      if (!record) {
        throw new Error(\`No record matching "\${recordId}" found in query\`);
      }
      return record;
    }
    
    async loadMoreRecords() {
      if (this.#pageInfo.isLastPage) {
        return null;
      }
      
      const nextOffset = this.#pageInfo.page * this.#pageInfo.pageSize;

   
      const response = await api.dbDataTableRow.list(this.#table.id, {
        ...this.#options,
        offset: nextOffset,
        ...(this.#view ? { viewId: this.#view.id } : {})
      });
      
      this.#rawData = [...this.#rawData, ...response.list];
      
      const records = [...this.records];
      
      this.recordIds = Object.freeze([...this.recordIds, ...response.list.map(row => {
        const record = new NocoDBRecord(row, this.#table);
        records.push(record);
        this.#recordsById.set(record.id, record);
        return record.id;
      })]);
      
      this.records = Object.freeze(records);
      
      this.#pageInfo = response.pageInfo;
      return this;
    }
    
    get hasMoreRecords() {
      return !this.#pageInfo.isLastPage;
    }

    get totalRecords() {
      return this.#pageInfo.totalRows;
    }

    get currentPage() {
      return this.#pageInfo.page;
    }

    get pageSize() {
      return this.#pageInfo.pageSize;
    }
  }
  
  class NocoDBRecord {
    #table
    #data
  
    constructor(data, table) {
      this.#table = table;
      this.#data = data;
      this.id = extractPk(data, table.fields);
      const displayField = this.#table.fields.find(f => f.pv)
      this.name  = this.#data[displayField.name] ?? this.id
    }
    
    get raw_data() {
      return this.#data;
    }
    
    get table() {
      return this.#table;
    }
    
    getCellValue(fieldOrFieldIdOrName) {
      let field = typeof fieldOrFieldIdOrName === 'string' ? this.#table.getField(fieldOrFieldIdOrName) : fieldOrFieldIdOrName;
      
      if(!field) {
        throw new Error(\`Field \${fieldOrFieldIdOrName?.name ?? fieldOrFieldIdOrName} not found\`)
      }
      
      if (field.name in this.#data) {
        const data = this.#data[field.name];
        
        switch(field.type) {
          case 'MultiSelect':
            return data?.split(',').map(d => d.trim()) || [];
          case 'User':
          case 'CreatedBy':
          case 'LastModifiedBy': {
            if (!field.options?.allow_multiple_users) {
              const userData = data?.length ? data[0] : data;
               return userData ? new Collaborator({ id: userData.id, email: userData.email, name: userData.display_name }) : null;
            } else return (data?.map(d => new Collaborator({ id: d.id, email: d.email, name: d.display_name })) ?? []);
          }
          case 'Links': {
            if (['hm', 'mm'].includes(field?.options?.relation_type)) return data
            if (['bt', 'oo'].includes(field?.options?.relation_type)) {
              if(!data) return null;
              const relatedTable = base.getTable(field?.options?.related_table_id)
              return( new NocoDBRecord(data, relatedTable))
            }
          }
          case 'LinkToAnotherRecord': {
            const relatedTable = base.getTable(field?.options?.related_table_id)
            
            if (['hm', 'mm'].includes(field?.options?.relation_type)) {
              return (data ?? []).map(v => new NocoDBRecord(v, relatedTable))
            }
            if (['bt', 'oo'].includes(field?.options?.relation_type)) {
              if(!data) return null;
              
              return( new NocoDBRecord(data, relatedTable))
            }
          }
          default:
            return data;
        }
        
      }
      throw new Error(\`Field \${field.name} not found in record!. Make sure it was included in the query result this record comes from\`)
    }
    
    getCellValueAsString(fieldOrFieldIdOrName, options = {
      customField: null,
      customValue: null
    }) {
      let field = typeof fieldOrFieldIdOrName === 'string' ? this.#table.getField(fieldOrFieldIdOrName) : fieldOrFieldIdOrName;
      const value = options.customValue ?? this.getCellValue(fieldOrFieldIdOrName);
      if(value === null || value === undefined) return '';
      
      if (options.customField) {
        field = options.customField
      }
      
      switch (field.type) {
        case 'CreatedBy':
        case 'LastModifiedBy':
        case 'User': {
          if (!field.options?.allow_multiple_users) {
            return value?.name || value?.email;
          } else {
            return value.map(v => v.name || v.email).join(', ');
          }
        }
        case 'Attachment': 
          return value.map(a => a.title).join(', ');
        case 'Checkbox': 
          return value ? 'Checked' : 'Unchecked';
        case 'MultiSelect': 
          return value?.join(', ') || '';
        case 'Percent': 
          return (value?.toString() + '%');
        case 'JSON': 
          return JSON.stringify(value);
        case 'Button': {
          if (field?.options?.type === 'url') return value?.url
          if (field?.options?.type === 'webhook') return value?.fk_webhook_id
          if (field?.options?.type === 'script') return value?.fk_script_id
          else return value?.toString();
        }
        case 'Currency': {
          return new Intl.NumberFormat(field?.options?.locale || 'en-US', {
            style: 'currency',
            currency: field?.options?.code || 'USD',
          }).format(value);
        }
        case 'Duration': {
          return convertMS2Duration(value, field?.options?.duration_format || 'h:mm:ss');
        }
        case 'Number':
        case 'Rollup':
        case 'Decimal': {
          if (field?.options?.thousands_separator) {
            return Number(roundUpToPrecision(Number(value), field?.options?.precision ?? 1)).toLocaleString(undefined, {
              minimumFractionDigits: field?.options?.precision ?? 1,
              maximumFractionDigits: field?.options?.precision ?? 1,
            });
          }
          return roundUpToPrecision(Number(value), field?.options?.precision ?? 1);
        }
        case 'Links': {
          if (['hm', 'mm'].includes(field?.options?.relation_type)) {
            return value === 1 ? \`\${value} \${field?.options?.singular}\` : \`\${value} \${field?.options?.plural}\`
          } else if (['bt', 'oo'].includes(field?.options?.relation_type)) {
            return value?.name || value?.id
          }
        }
        case 'LinkToAnotherRecord': {
          if (['hm', 'mm'].includes(field?.options?.relation_type)) {
            return value?.map((v) => v.name || v.id).join(', ')
          } else if (['bt', 'oo'].includes(field?.options?.relation_type)) {
            return value?.name || value?.id
          }
        }
        case 'Date': {
          const format = field?.options?.date_format || 'YYYY-MM-DD';
          const date = parseDate(value);
          if (!date) return "";
          return formatDate(date, format);
        }
        case 'Time': {
          let date = parseDate(value);
          if (!date) {
            for (const timeFormat of timeFormats) {
              date = parseDateString(\`1970-01-01 \${value}\`,\`YYYY-MM-DD \${timeFormat}\`);
              if (date) break;
            }
          }
          
          if (!date) return "";
          const format = field?.options?.time_format || 'HH:mm';
          const is12hr = field?.options?.['12hr_format'];
          return formatDate(date, format + (is12hr ? ' A' : ''));
        }
        
        case 'DateTime':
        case 'CreatedTime':
        case 'LastModifiedTime': {
          const dateFormat = field?.options?.date_format || dateFormats[0];
          const timeFormat = field?.options?.time_format || timeFormats[0];
          const is12hr = field?.options?.['12hr_format'];
          const dateTimeFormat = \`\${dateFormat} \${timeFormat}\` + (is12hr ? ' A' : '');
          
          let date = parseDate(value, dateTimeFormat) || parseDate(value)
          
          if (!isValidDate(date)) {
            const utcDate = new Date(
              date.getTime() + date.getTimezoneOffset() * 60000
            );
            return formatDate(utcDate, dateTimeFormat);
          }
          if (!date) return "";
          return formatDate(date, dateTimeFormat);
        }
        case 'Formula': {
          if (!field?.options?.result) return value?.toString();
          return this.getCellValueAsString(field, { customField: field?.options?.result });
        }
        case 'Lookup': {
          const relationField = this.#table.getField(field?.options?.relation_field_id)
          const relatedTable = base.getTable(relationField?.options?.related_table_id)
          
          const relatedField = relatedTable.getField(field?.options?.lookup_field_id)
          
          if ([ 'hm', 'mm'].includes(relationField?.options?.relation_type)) {
            return value?.map((v) => this.getCellValueAsString(field, { customField: relatedField, customValue: v })).join(', ')
          } else if (['bt', 'oo'].includes(relationField?.options?.relation_type)) {
            return this.getCellValueAsString(field, { customField: relatedField, customValue: value })
          }
          return value
        }
        default: 
          return value.toString();
      }
    }
  }
  
  class Field {
    #table;
    #pk;
    #pv;
    #system
    constructor(data, table) {
      this.id = data.id;
      this.name = data.name;
      this.type = data.type;
      this.description = data.description;
      this.options = Object.keys(data.options ?? {}).length ? data.options : null;
      this.isComputed = ['LinkToAnotherRecord', 'Formula', 'QrCode', 'Barcode', 'Rollup', 'Links', 'CreatedTime', 'LastModifiedTime', 'CreatedBy', 'LastModifiedBy', 'Button'].includes(data.type);
      
      this.#pk = data.pk
      this.#system = data.system
      this.#pv = data.pv
      this.#table = table;
    }
    
    get pk() {
      return this.#pk;
    }
    
    get pv() {
      return this.#pv;
    }
    
    get system() {
      return this.#system;
    }
    
    async updateDescriptionAsync(description) {
      this.description = description;
      await api.dbTableColumn.update(this.id, { description, id: this.id, title: this.name });
      return this;
    }
    
    async updateNameAsync(name) {
      this.name = name;
      await api.dbTableColumn.update(this.id, { description: this.description, id: this.id, title: name, column_name: name });
      return this
    }
  }
  
  class View {
    #table;
    constructor(data, table) {
      this.id = data.id;
      this.name = data.name;
      this.description = data.description;
      this.type = data.type;
      this.#table = table;
    }
    
    get table() {
      return this.#table;
    }
    
    async selectRecordAsync(recordId, options = {}) {
      const { fields = [] } = options;
      
      const pvAndPk = this.#table.fields.filter(f => f.pv || f.pk).map(f => f.name)
      
      const _fieldsToSelect = fields.map((field) => {
        if (typeof field === 'string') {
          const f = this.#table.getField(field)
          if (!f) throw new Error(\`Field \${field} not found in table \${this.#table.name}\`)
          return f.name;
        } if (field instanceof Field) {
          return field.name;
        }
        return null;
      }).filter(Boolean);
      
      const fieldsToSelect = Array.from(new Set([..._fieldsToSelect, ...pvAndPk]))
      
      const data = await api.dbDataTableRow.read(this.#table.id, recordId, {
        viewId: this.id,
        ...(fields?.length && { fields: fieldsToSelect })
      })
      
      if(data?.error?.name === 'AxiosError' && data?.error?.status) return null;

      return new NocoDBRecord(data, this.#table);    
    }
    
    async selectRecordsAsync(options = {}) {
      const { sorts = [], fields = [], recordIds = [], limit = 500, offset = 0 } = options
           
      const pvAndPk = this.#table.fields.filter(f => f.pv || f.pk).map(f => f.name)
      
      const _fieldsToSelect = fields.map((field) => {
        if (typeof field === 'string') {
          const f = this.#table.getField(field)
          if (!f) throw new Error(\`Field \${field} not found in table \${this.#table.name}\`)
          return f.name;
        } if (field instanceof Field) {
          return field.name;
        }
        return null;
      }).filter(Boolean)
            
      const fieldsToSelect = fields.length ? Array.from(new Set([..._fieldsToSelect, ...pvAndPk])) : null
      
      const sortStr = sorts.map(sort => {
        if (typeof sort.field === 'string') {
          const field = this.#table.getField(sort.field)
          
          if (!field) {
            throw new Error(\`Field \${sort.field} not found in table \${this.#table.name}\`)
          }
          
          return sort.direction === 'desc' ? \`-\${field.name}\` : field.name; 
        }
      }).join(',');
      
      const requestOptions = {
        viewId: this.id,
        limit,
        offset,
        ...(recordIds?.length && { pks: recordIds.join(',') }),
        ...(fieldsToSelect && { fields: fieldsToSelect }),
        ...(sortStr && { sort: sortStr }),
      };
      const data = await api.dbDataTableRow.list(this.#table.id, requestOptions)
      
      return new RecordQueryResult(data, this.#table, this, requestOptions);
    }
  }
  
  class Table {
    #base;
    #all_fields
    constructor(data, base) {
      this.id = data.id;
      this.name = data.name;
      this.description = data.description;
      this.#all_fields = data.fields.map((f) => new Field({id: f.id, name: f.name, type: f.type, description: f.description, options: f.options, pk: f.pk, pv: f.pv, system: f.system}, this));
      this.views = data.views.map(v => new View({id: v.id, name: v.name, description: v.description, type: v.type}, this));
      this.#base = base;
      
      this.fields = this.#all_fields.filter(f => !f.system);
    }
    
    getField(idOrName) {
      return this.fields.find((field) => field.id === idOrName || field.name === idOrName)
    }
    
    getView(idOrName) {
      return this.views.find((view) => view.id === idOrName || view.name === idOrName)
    }
    
    async selectRecordAsync(recordId, options = {}) {
      const { fields = [] } = options;
      
      const pvAndPk = this.fields.filter(f => f.pv || f.pk).map(f => f.name)
           
      const _fieldsToSelect = fields.map((field) => {
        if (typeof field === 'string') {
          const f = this.getField(field)
          if (!f) throw new Error(\`Field \${field} not found in table \${this.name}\`)
          return f.name;
        } if (field instanceof Field) {
          return field.name;
        }
        return null;
      }).filter(Boolean);
      
      const fieldsToSelect = Array.from(new Set([..._fieldsToSelect, ...pvAndPk]))
 
      const data = await api.dbDataTableRow.read(this.id, recordId, {
        ...(fields?.length && { fields: fieldsToSelect })
      })
                 
      if(data?.error?.name === 'AxiosError' && data?.error?.status) return null;
      
      return new NocoDBRecord(data, this);    
    }
    
    async selectRecordsAsync(options = {}) {
      const { sorts = [], fields = [], recordIds = [], limit = 500, offset = 0 } = options
           
      const pvAndPk = this.fields.filter(f => f.pv || f.pk).map(f => f.name)
      
      const _fieldsToSelect = fields.map((field) => {
        if (typeof field === 'string') {
          const f = this.getField(field)
          if (!f) throw new Error(\`Field \${field} not found in table \${this.name}\`)
          return f.name;
        } if (field instanceof Field) {
          return field.name;
        }
        return null;
      }).filter(Boolean)
            
      const fieldsToSelect = fields.length ? Array.from(new Set([..._fieldsToSelect, ...pvAndPk])) : null
      
      const sortStr = sorts.map(sort => {
        if (typeof sort.field === 'string') {
          const field = this.getField(sort.field)
          
          if (!field) {
            throw new Error(\`Field \${sort.field} not found in table \${this.name}\`)
          }
          
          return sort.direction === 'desc' ? \`-\${field.name}\` : field.name; 
        }
      }).join(',');
      
      const requestOptions = {
        limit,
        offset,
        ...(recordIds?.length && { pks: recordIds.join(',') }),
        ...(fieldsToSelect && { fields: fieldsToSelect }),
        ...(sortStr && { sort: sortStr }),
      };
      
      const data = await api.dbDataTableRow.list(this.id, requestOptions)
     
      return new RecordQueryResult(data, this, null, requestOptions);
    }
    
    async createRecordAsync(data) {
      const recordData = {};
      for (const field of this.fields) {
        if (data[field.name]) {
          recordData[field.name] = data[field.name];
        } else if (data[field.id]) {
          recordData[field.name] = data[field.id];
        }
      }
      
      const response = await api.dbDataTableRow.create(this.id, recordData);
      return new NocoDBRecord(response, this).id;
    }
    
    async createRecordsAsync(data) {
      const insertObjs = []
      
      for(const record of data) {
        const recordData = {};
        for (const field of this.fields) {
          if (record[field.name]) {
            recordData[field.name] = record[field.name];
          } else if (record[field.id]) {
            recordData[field.name] = record[field.id];
          }
        }
        insertObjs.push(recordData)
      }
      
      const response = await api.dbDataTableRow.create(this.id, insertObjs);
      
      return response.map(r => new NocoDBRecord(r, this).id);
    }
    
    async updateRecordAsync(recordId, data) { 
      const recordID = (recordId instanceof NocoDBRecord) ? recordId.id: recordId
      const recordData = {};
      for (const field of this.fields) {
        if (data[field.name]) {
          recordData[field.name] = data[field.name];
        } else if (data[field.id]) {
          recordData[field.name] = data[field.id];
        }
      }
      
      await api.dbTableRow.update('NOCO', this.#base.id, this.id, recordID, recordData);
    }
    
    async updateRecordsAsync(data) {
      const updateObjs = []
      
      for(const record of data) {
        const recordData = {};
        for (const field of this.fields) {
          if (record[field.name]) {
            recordData[field.name] = record[field.name];
          } else if (record[field.id]) {
            recordData[field.name] = record[field.id];
          }
        }
        updateObjs.push(recordData)
      }
      
      await api.dbDataTableRow.update(this.id, updateObjs);
    }
    
    async deleteRecordAsync(recordIdOrRecord) {
      const recordID = (recordIdOrRecord instanceof NocoDBRecord) ? recordIdOrRecord.id: recordIdOrRecord
      
      await api.dbTableRow.delete('NOCO', this.#base.id, this.id, recordID);
      
      return true
    }
    
  }
  
  class Base {
    constructor(data) {
      this.id = data.id;
      this.name = data.name;
      
      this.activeCollaborators = data.collaborators.map((c) => {
        return new Collaborator({id: c.id, email: c.email, name: c.name});
      });
      
      this.tables = data.tables.map((t) => {
        return new Table({id: t.id, name: t.name, description: t.description, views: t.views, fields: t.fields }, this);
      })
    }
    
    getCollaborator(idOrNameOrEmail) {
      if(!idOrNameOrEmail) return null;
      return this.activeCollaborators.find((collaborator) => collaborator.id === idOrNameOrEmail || collaborator.name === idOrNameOrEmail || collaborator.email === idOrNameOrEmail)
    }
    
    getTable(idOrName) {
      return this.tables.find((table) => table.id === idOrName || table.name === idOrName)
    }
  }
  `
}

function generateBaseObject(): string {
  const automationStore = useAutomationStore()
  const { activeBaseSchema } = storeToRefs(automationStore)

  return `
  var base = new Base({
    id: '${activeBaseSchema.value!.id}',
    name: '${activeBaseSchema.value!.name ?? ''}',
    collaborators: ${JSON.stringify(activeBaseSchema.value!.collaborators)},
    tables: ${JSON.stringify(activeBaseSchema.value!.tables)},
  })
    `
}

function generateSessionApi(): string {
  const { user } = useGlobal()

  return `
  const session = {
    currentUser: new Collaborator({
      id: '${user.value?.id}',
      email: '${user.value?.email}',
      name: '${user.value?.display_name ?? ''}'
    })
  }
  `
}

function generateApiProxy(): string {
  return `
    const api = new Proxy({}, {
      get(target, prop) {
        if (!target[prop]) {
          target[prop] = new Proxy({}, {
            get(targetLevel2, propLevel2) {
              if (!targetLevel2[propLevel2]) {
                targetLevel2[propLevel2] = function(...args) {
                  const id = Math.random().toString(36).substring(2);
                  const message = {
                    type: '${ActionType.CALL_API}',
                    payload: { id, level1: prop.toString(), level2: propLevel2.toString(), args },
                  };
                  self.postMessage(message);
                  return new Promise((resolve) => {
                    function handleMessage(e) {
                      const responseMessage = e.data;
                      if (responseMessage.type === '${ActionType.RESPONSE}' && responseMessage.payload.id === id) {
                        if (typeof responseMessage.payload.payload?.error === 'string') {
                          try {
                            responseMessage.payload.payload.error = JSON.parse(responseMessage.payload.payload.error);
                          } catch (e) {
                            // Do nothing
                          }
                        }
                        resolve(responseMessage.payload.payload);
                        self.removeEventListener('message', handleMessage);
                      }
                    }
                    self.addEventListener('message', handleMessage);
                  });
                };
              }
              return targetLevel2[propLevel2];
            }
          });
        }
        return target[prop];
      }
    });
  `
}

function generateRemoteFetch(): string {
  const workspaceStore = useWorkspace()

  return `
    const remoteFetch = async (url, options) => {
      return api.workspace.remoteFetch('${workspaceStore.activeWorkspaceId}', {
        method: options?.method || 'GET',
        headers: options?.headers || {},
        body: options?.body || null,
        url,
      });
    };
  `
}

function generateProgressAPIs(): string {
  return `
    const updateProgress = (type, { rowId, cellId, progress, message, icon } = {}) => {
      const progressMessage = {
        type: '${ActionType.UPDATE_PROGRESS}',
        payload: {
          type,
          data: {
            ...(rowId && { rowId }),
            ...(cellId && { cellId }),
            ...(progress !== undefined && { progress }),
            ...(message && { message }),
            ...(icon && { icon })
          }
        }
      };
      self.postMessage(progressMessage);
    };

    const resetProgress = (type, { rowId, cellId } = {}) => {
      const resetMessage = {
        type: '${ActionType.RESET_PROGRESS}',
        payload: {
          type,
          data: {
            ...(rowId && { rowId }),
            ...(cellId && { cellId })
          }
        }
      };
      self.postMessage(resetMessage);
    };

    self.updateProgress = updateProgress;
    self.resetProgress = resetProgress;
  `
}

function generateInputMethods(): string {
  return `
    const input = {
      textAsync: async (label) => {
        return new Promise((resolve) => {
          const id = Math.random().toString(36).substr(2, 9);
          self.postMessage({ 
            type: '${ActionType.INPUT}', 
            payload: { type: '${InputType.TEXT}', label, id } 
          });
          function handler(event) {
            if (event.data.type === '${ActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
              self.removeEventListener('message', handler);
              resolve(event.data.payload.value);
            }
          }
          self.addEventListener('message', handler);
        });
      },
      selectAsync: async (label, options) => {
        return new Promise((resolve) => {
          const id = Math.random().toString(36).substr(2, 9);
          
          const processedOptions = options.map(option => {
            if (typeof option === 'string') {
              return { label: option, value: option };
            }
            return option;
          });
          
          self.postMessage({ 
            type: '${ActionType.INPUT}', 
            payload: { type: '${InputType.SELECT}', label, options: processedOptions, id } 
          });
          function handler(event) {
            if (event.data.type === '${ActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
              self.removeEventListener('message', handler);
              resolve(event.data.payload.value);
            }
          }
          self.addEventListener('message', handler);
        });
      },
      buttonsAsync: async (label, options) => {
        return new Promise((resolve) => {
          const id = Math.random().toString(36).substr(2, 9);
          
          const processedOptions = options.map(option => {
            if (typeof option === 'string') {
              return { label: option, value: option, variant: 'default' };
            }
            return option;
          });
          
          self.postMessage({ 
            type: '${ActionType.INPUT}', 
            payload: { type: '${InputType.BUTTONS}', label, options: processedOptions, id } 
          });
          function handler(event) {
            if (event.data.type === '${ActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
              self.removeEventListener('message', handler);
              resolve(event.data.payload.value);
            }
          }
          self.addEventListener('message', handler);
        });
      },
      fileAsync: async (label = ' --Select a file-- ', options = {}) => {
        return new Promise((resolve) => {
          const id = Math.random().toString(36).substr(2, 9);
          self.postMessage({ 
            type: '${ActionType.INPUT}', 
            payload: { 
              label,
              id,
              type: '${InputType.FILE}', 
              accept: options.allowedFileTypes?.join(',') || '', 
              hasHeaderRow: options.hasHeaderRow,
              useRawValues: options.useRawValues
            } 
          });
          function handler(event) {
            if (event.data.type === '${ActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
              self.removeEventListener('message', handler);
              let data = event.data.payload.value
              
              try {
                data = JSON.parse(data);
              } catch (e) {
                data = data
                // Do nothing
              }
              resolve(data);
            }
          }
          self.addEventListener('message', handler);
        });
      },
      tableAsync: async (label) => {
        return new Promise((resolve) => {
          const id = Math.random().toString(36).substr(2, 9);
          self.postMessage({
            type: '${ActionType.INPUT}',
            payload: { type: '${InputType.TABLE}', label, id }
          })
          function handler(event) {
            if (event.data.type === '${ActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
              self.removeEventListener('message', handler);
              resolve(base.getTable(event.data.payload.value));
            }
          }
          self.addEventListener('message', handler);
        })
      },
      viewAsync: async (label, tableIdOrTableNameOrTable) => {
        return new Promise((resolve) => {
          const id = Math.random().toString(36).substr(2, 9);
          
          let tableId;
          let table
          
          if (typeof tableIdOrTableNameOrTable === 'string') {
            table = base.getTable(tableIdOrTableNameOrTable);
            tableId = table.id;
          } else if (tableIdOrTableNameOrTable instanceof Table) {
            table = tableIdOrTableNameOrTable
            tableId = tableIdOrTableNameOrTable.id;
          } else {
            tableId = tableIdOrTableNameOrTable;
          }
          
          self.postMessage({
            type: '${ActionType.INPUT}',
            payload: { type: '${InputType.VIEW}', tableId, label, id }
          })
          function handler(event) {
            if (event.data.type === '${ActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
              self.removeEventListener('message', handler);
              resolve(table.getView(event.data.payload.value));
            }
          }
          self.addEventListener('message', handler);
        })
      },
      fieldAsync: async (label, tableIdOrTableNameOrTable) => {
        return new Promise((resolve) => {
          const id = Math.random().toString(36).substr(2, 9);
          
          let tableId;
          let table
          
          if (typeof tableIdOrTableNameOrTable === 'string') {
            table = base.getTable(tableIdOrTableNameOrTable);
            tableId = table.id;
          } else if (tableIdOrTableNameOrTable instanceof Table) {
            table = tableIdOrTableNameOrTable
            tableId = tableIdOrTableNameOrTable.id;
          } else {
            tableId = tableIdOrTableNameOrTable;
          }
          
          self.postMessage({
            type: '${ActionType.INPUT}',
            payload: { type: '${InputType.FIELD}', tableId, label, id }
          })
          function handler(event) {
            if (event.data.type === '${ActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
              self.removeEventListener('message', handler);
              resolve(table.getField(event.data.payload.value));
            }
          }
          self.addEventListener('message', handler);
        })
      },
      recordAsync: async (label, source, options = {}) => {
        return new Promise((resolve) => {
          const id = Math.random().toString(36).substr(2, 9);
          let tableId, viewId, records;
          if (source instanceof Table) {
            tableId = source.id;
          } else if (source instanceof View) {
            tableId = source.table.id;
            viewId = source.id;
          } else if (source instanceof RecordQueryResult) {
            records = source.raw_data;
            tableId = source.table.id;
          } else if (Array.isArray(source) && source.length && source[0] instanceof NocoDBRecord) {
            records = source.map(r => r.raw_data);
            tableId = source[0].table.id;
          }
          
          const fields = []
          
          const table = base.getTable(tableId)

          const pvAndPk = table.fields.filter(f => f.pv || f.pk).map(f => f.name)
          
          for (const field of options.fields || []) {
            if (typeof field === 'string') {
              const fieldObj = table.getField(field)
              if (!fieldObj) throw new Error(\`Field \${field} not found in table \${table.name}\`)
              fields.push(fieldObj.name)
            } else if (field instanceof Field) {
              fields.push(field.name)
            }
          }
          
          const fieldsToSelect = Array.from(new Set([...fields, ...pvAndPk]))
          
          self.postMessage({
            type: '${ActionType.INPUT}',
            payload: { type: '${InputType.RECORD}', tableId, viewId, records, label, id, options: { fields: options?.fields ? fieldsToSelect : [] } }
          });
          
          function handler(event) {
            if (event.data.type === '${ActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
              let data = event.data.payload.value;
              
              try {
                data = JSON.parse(data);
                data = new NocoDBRecord(data, table);
              } catch (e) {
                data = null;
              }
              self.removeEventListener('message', handler);
              resolve(data);
            }
          }
          self.addEventListener('message', handler);
        })
      }
    };
  `
}

function generateRestrictGlobals(): string {
  return `
    const restrictedGlobals = [
      "window",
      "document",
      "location",
      "top",
      "parent",
      "frames",
      "opener",
      "navigator",
      "eval",
    ];
    
    restrictedGlobals.forEach((name) => {
      Object.defineProperty(self, name, {
        get: () => {
          throw new ReferenceError(name + " is not defined");
        },
        configurable: false,
      });
    });
  `
}

function generateConsoleOverride(): string {
  return `
    self.console = {
      log: (...args) => {
        self.postMessage({ type: '${ActionType.LOG}', payload: { args } });
      },
      error: (...args) => {
        self.postMessage({ type: '${ActionType.ERROR}', payload: { args } });
      },
      warn: (...args) => {
        self.postMessage({ type: '${ActionType.WARN}', payload: { args } });
      },
    };
  `
}

function generateOutput(): string {
  return `
    const output = {
      text: (message, type = 'log') => {
        self.postMessage({ 
          type: '${ActionType.OUTPUT}', 
          payload: { message: JSON.stringify({ action: 'text', args: [message, type] }) } 
        });
      },
      markdown: (content) => {
        self.postMessage({ 
          type: '${ActionType.OUTPUT}', 
          payload: { message: JSON.stringify({ action: 'markdown', args: [content] }) } 
        });
      },
      table: (data) => {
        self.postMessage({ 
          type: '${ActionType.OUTPUT}', 
          payload: { message: JSON.stringify({ action: 'table', args: [data] }) } 
        });
      },
      clear: () => {
        self.postMessage({ 
          type: '${ActionType.OUTPUT}', 
          payload: { message: JSON.stringify({ action: 'clear', args: [] }) } 
        });
      },
      inspect: (data) => {
        self.postMessage({ 
          type: '${ActionType.OUTPUT}', 
          payload: { message: JSON.stringify({ action: 'inspect', args: [data] }) } 
        });
      }
    };
  `
}

function generateMessageHandler(userCode: string): string {
  return `
    self.onmessage = async function(event) {
      if (event.data.type === 'run') {
        try {
          await (async () => {
            ${userCode}
          })();
        } catch (e) {
          output.text(\`Error: \${e}\`, 'error');
        } finally {
          const doneMessage = { type: '${ActionType.DONE}', payload: undefined };
          self.postMessage(doneMessage);
        }
      }
    };
  `
}

function generateViewActions(): string {
  return `
    const viewActions = {
      reloadView: async () => {
        return new Promise((resolve) => {
          const id = Math.random().toString(36).substr(2, 9);
          self.postMessage({
            type: "${ActionType.ACTION}",
            payload: { 
              id,
              action: 'reloadView'
            },
          });
          function handler(event) {
            if (
              event.data.type === "${ActionType.ACTION_COMPLETE}" &&
              event.data.payload.id === id
            ) {
              self.removeEventListener("message", handler);
              resolve(event.data.payload.value);
            }
          }
          self.addEventListener("message", handler);
        });
      },

      reloadRow: async (rowId) => {
        return new Promise((resolve) => {
          const id = Math.random().toString(36).substr(2, 9);
          self.postMessage({
            type: "${ActionType.ACTION}",
            payload: { 
              id,
              action: 'reloadRow',
              rowId 
            },
          });
          function handler(event) {
            if (
              event.data.type === "${ActionType.ACTION_COMPLETE}" &&
              event.data.payload.id === id
            ) {
              self.removeEventListener("message", handler);
              resolve(event.data.payload.value);
            }
          }
          self.addEventListener("message", handler);
        });
      }
    };
  `
}

export function createWorkerCode(userCode: string, custom?: string): string {
  return `
  
    ${generateRestrictGlobals()}
    ${generateConsoleOverride()}
    ${generateOutput()}
    ${generateProgressAPIs()}
    ${generateInputMethods()}
    ${generateApiProxy()}
    ${generateViewActions()}
    ${generateRemoteFetch()}
    ${generalHelpers()}
    ${custom || ''}
    ${generateBaseModels()}
    ${generateBaseObject()}
    ${generateSessionApi()}
    ${generateMessageHandler(userCode)}
  `
}
