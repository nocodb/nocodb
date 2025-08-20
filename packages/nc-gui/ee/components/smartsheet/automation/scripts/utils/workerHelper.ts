import { ScriptActionType, ScriptInputType } from '~/lib/enum'

export function generateIntegrationsCode(integrations: any[]): string {
  let code = 'const integrations = {'
  for (const integration of integrations) {
    const integrationMeta = allIntegrations.find(
      (item: any) => item.type === integration.type && item.subType === integration.sub_type,
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

function generateV3ToV2Converter() {
  return `
    /**
     * Convert a single V3 record to V2 format
     * @param {Object} recordV3 - V3 format: {id, fields}
     * @param {Table} table - Table instance
     * @returns {Object} V2 format: {primaryKey: value, field1: val1, ...}
     */
    const convertRecordV3ToV2 = (recordV3, table) => {
      if (!recordV3 || !recordV3.id || !recordV3.fields) {
        return recordV3; // Not V3 format, return as-is
      }

      const primaryKeyFields = table.fields.filter(f => f.primary_key);
      const recordV2 = {};

      // Handle primary key(s)
      if (primaryKeyFields.length === 1) {
        // Single primary key
        recordV2[primaryKeyFields[0].name] = recordV3.id;
      } else {
        // Composite primary key - split by '___'
        const idParts = String(recordV3.id).split('___');
        primaryKeyFields.forEach((pk, index) => {
          if (index < idParts.length) {
            // Unescape underscores: '\\_' -> '_'
            recordV2[pk.name] = idParts[index]?.replaceAll('\\\\_', '_');
          }
        });
      }

      for (const [fieldName, fieldValue] of Object.entries(recordV3.fields)) {
        const field = table.fields.find(f => f.name === fieldName);
        
        if (field && (field.type === 'LinkToAnotherRecord' || field.type === 'Links')) {
          recordV2[fieldName] = convertLTARField(fieldValue, field);
        } else {
          recordV2[fieldName] = fieldValue;
        }
      }

      return recordV2;
    };

    /**
     * Convert LTAR field from V3 to V2 format
     * @param {*} fieldValue - LTAR field value
     * @param {Object} field - Field definition
     * @returns {*} Converted field value
     */
    const convertLTARField = (fieldValue, field) => {
      if (fieldValue === null || fieldValue === undefined) {
        return fieldValue;
      }

      const relatedTable = base.getTable(field.options?.related_table_id);
      if (!relatedTable) {
        return fieldValue; // Can't convert without related table info
      }

      const relatedPkFields = relatedTable.fields.filter(f => f.primary_key);

      // Handle array of linked records (hm, mm relations)
      if (Array.isArray(fieldValue)) {
        return fieldValue.map(linkedRecord => {
          if (isV3Format(linkedRecord)) {
            // Convert nested V3 record to V2
            return convertRecordV3ToV2(linkedRecord, relatedTable);
          } else if (typeof linkedRecord === 'string') {
            // Just an ID string - convert to primary key object
            return parsePrimaryKey(linkedRecord, relatedPkFields);
          }
          return linkedRecord; // Already V2 format or unknown
        });
      }

      // Handle single linked record (bt, oo relations)
      if (isV3Format(fieldValue)) {
        // Convert nested V3 record to V2
        return convertRecordV3ToV2(fieldValue, relatedTable);
      } else if (typeof fieldValue === 'string') {
        // Just an ID string - convert to primary key object
        return parsePrimaryKey(fieldValue, relatedPkFields);
      }

      return fieldValue; // Already V2 format or unknown
    };

    /**
     * Parse primary key ID into object format
     * @param {string} id - Primary key ID
     * @param {Array} primaryKeyFields - Primary key field definitions
     * @returns {Object} Primary key object
     */
    const parsePrimaryKey = (id, primaryKeyFields) => {
      const pkObject = {};
      
      if (primaryKeyFields.length === 1) {
        // Single primary key
        pkObject[primaryKeyFields[0].name] = id;
      } else {
        // Composite primary key
        const idParts = String(id).split('___');
        primaryKeyFields.forEach((pk, index) => {
          if (index < idParts.length) {
            pkObject[pk.name] = idParts[index]?.replaceAll('\\\\_', '_');
          }
        });
      }
      
      return pkObject;
    };

    /**
     * Convert multiple V3 records to V2 format
     * @param {Array} recordsV3 - Array of V3 records
     * @param {Table} table - Table instance
     * @returns {Array} Array of V2 records
     */
    const convertRecordsV3ToV2 = (recordsV3, table) => {
      if (!Array.isArray(recordsV3)) {
        return convertRecordV3ToV2(recordsV3, table);
      }
      return recordsV3.map(record => convertRecordV3ToV2(record, table));
    };

    /**
     * Check if data is in V3 format
     * @param {*} data - Data to check
     * @returns {boolean} True if V3 format
     */
    const isV3Format = (data) => {
      return data && typeof data === 'object' && 
             data.id !== undefined && 
             data.fields !== undefined;
    };
  `
}

function generateStepAPI() {
  return `
  let __nc_currentStepId = null;
  
  // Export colors and icons as objects for easy access 
  const colors = {
    red: 'red',
    blue: 'blue', 
    green: 'green',
    yellow: 'yellow',
    purple: 'purple',
    orange: 'orange',
    gray: 'gray'
  };
  
  const icons = {
  // Layout & Structure
  columns: 'ncColumns',
  grid: 'ncGrid',
  layout: 'ncLayout',
  sidebar: 'ncSidebar',
  
  // Navigation & Arrows
  arrowUp: 'ncArrowUp',
  arrowDown: 'ncArrowDown2',
  arrowLeft: 'ncArrowLeft',
  arrowRight: 'ncArrowRight',
  arrowUpLeft: 'ncArrowUpLeft',
  arrowUpRight: 'ncArrowUpRight',
  arrowDownLeft: 'ncArrowDownLeft',
  arrowDownRight: 'ncArrowDownRight',
  chevronUp: 'ncChevronUp',
  chevronDown: 'ncChevronDown',
  chevronLeft: 'ncChevronLeft',
  chevronRight: 'ncChevronRight',
  chevronsUp: 'ncChevronsUp',
  chevronsDown: 'ncChevronsDown',
  chevronsLeft: 'ncChevronsLeft',
  chevronsRight: 'ncChevronsRight',
  cornerUpLeft: 'ncCornerUpLeft',
  cornerUpRight: 'ncCornerUpRight',
  cornerDownLeft: 'ncCornerDownLeft',
  cornerDownRight: 'ncCornerDownRight',
  cornerLeftUp: 'ncCornerLeftUp',
  cornerLeftDown: 'ncCornerLeftDown',
  cornerRightUp: 'ncCornerRightUp',
  cornerRightDown: 'ncCornerRightDown',
  
  // Actions & Controls
  play: 'ncPlay',
  pause: 'ncPause',
  stop: 'ncStopCircle',
  skipForward: 'ncSkipForward',
  skipBack: 'ncSkipBack',
  fastForward: 'ncFastForward',
  rewind: 'ncRewind',
  shuffle: 'ncShuffle',
  repeat: 'ncRepeat',
  
  // Media Controls (Circle variants)
  playCircle: 'ncPlayCircle',
  pauseCircle: 'ncPauseCircle',
  arrowUpCircle: 'ncArrowUpCircle',
  arrowDownCircle: 'ncArrowDownCircle',
  arrowLeftCircle: 'ncArrowLeftCircle',
  arrowRightCircle: 'ncArrowRightCircle',
  
  // Basic Actions
  add: 'ncPlus',
  remove: 'ncMinus',
  close: 'ncX',
  check: 'ncCheck',
  edit: 'ncEdit',
  edit2: 'ncEdit2',
  edit3: 'ncEdit3',
  delete: 'ncDelete',
  trash: 'ncTrash',
  trash2: 'ncTrash2',
  copy: 'ncCopy',
  cut: 'ncScissors',
  save: 'ncSave2',
  
  // Circle Actions
  addCircle: 'ncPlusCircle',
  removeCircle: 'ncMinusCircle',
  closeCircle: 'ncXCircle',
  checkCircle: 'ncCheckCircle',
  
  // Square Actions
  addSquare: 'ncPlusSquare',
  removeSquare: 'ncMinusSquare',
  closeSquare: 'ncXSquare',
  checkSquare: 'ncCheckSquare',
  
  // Files & Documents
  file: 'ncFile',
  fileText: 'ncFileText',
  filePlus: 'ncFilePlus',
  fileMinus: 'ncFileMinus',
  fileSearch: 'ncFileSearch',
  folder: 'ncFolder',
  folderPlus: 'ncFolderPlus',
  folderMinus: 'ncFolderMinus',
  document: 'ncFileText',
  
  // Communication
  mail: 'ncMail',
  message: 'ncMessageCircle',
  messageSquare: 'ncMessageSquare',
  phone: 'ncPhone',
  phoneCall: 'ncPhoneCall',
  phoneIncoming: 'ncPhoneIncoming',
  phoneOutgoing: 'ncPhoneOutgoing',
  phoneMissed: 'ncPhoneMissed',
  phoneForwarded: 'ncPhoneForwarded',
  phoneOff: 'ncPhoneOff',
  
  // Users & People
  user: 'ncUser',
  users: 'ncUsers',
  userPlus: 'ncUserPlus',
  userMinus: 'ncUserMinus',
  userCheck: 'ncUserCheck',
  userX: 'ncUserX',
  
  // Technology & Devices
  smartphone: 'ncSmartphone',
  tablet: 'ncTablet',
  monitor: 'ncMonitor',
  tv: 'ncTv',
  camera: 'ncCamera',
  cameraOff: 'ncCameraOff',
  video: 'ncVideo',
  videoOff: 'ncVideoOff',
  mic: 'ncMic',
  micOff: 'ncMicOff',
  
  // Audio & Volume
  volume: 'ncVolume',
  volume1: 'ncVolume1',
  volume2: 'ncVolume2',
  volumeX: 'ncVolumeX',
  speaker: 'ncVolume2',
  mute: 'ncVolumeX',
  headphone: 'ncHeadphone',
  
  // Network & Connectivity
  wifi: 'ncWifi',
  wifiOff: 'ncWifiOff',
  bluetooth: 'ncBluetooth',
  cast: 'ncCast',
  airplay: 'ncAirplay',
  
  // Cloud & Storage
  cloud: 'ncCloud',
  cloudOff: 'ncCloudOff',
  cloudSnow: 'ncCloudSnow',
  uploadCloud: 'ncUploadCloud',
  downloadCloud: 'ncDownloadCloud',
  upload: 'ncUpload',
  download: 'ncDownload',
  
  // Data & Analytics
  database: 'ncDatabase',
  server: 'ncServer',
  hardDrive: 'ncHardDrive',
  barChart: 'ncBarChart',
  barChart2: 'ncBarChart2',
  pieChart: 'ncPieChart',
  trendingUp: 'ncTrendingUp',
  trendingDown: 'ncTrendingDown',
  activity: 'ncActivity',
  
  // Text & Formatting
  type: 'ncType',
  bold: 'ncBold',
  italic: 'ncItalic',
  underline: 'ncUnderline',
  alignLeft: 'ncAlignLeft',
  alignCenter: 'ncAlignCenter',
  alignRight: 'ncAlignRight',
  alignJustify: 'ncAlignJustify',
  heading1: 'ncHeading1',
  heading2: 'ncHeading2',
  heading3: 'ncHeading3',
  quote: 'ncQuote',
  
  // Lists & Organization
  list: 'ncList',
  numberList: 'ncNumberList',
  checkList: 'ncCheckList',
  menu: 'ncMenu',
  
  // Navigation & Interface
  home: 'ncHome',
  search: 'ncSearch',
  searchDuo: 'ncSearchDuo',
  filter: 'ncFilter',
  settings: 'ncSettings',
  settingsDuo: 'ncSettingsDuo',
  sliders: 'sliders',
  more: 'ncMoreHorizontal',
  moreVertical: 'ncMoreVertical',
  
  // Status & Notifications
  bell: 'ncBell',
  bellOff: 'ncBellOff',
  notification: 'ncNotificationDuo',
  alert: 'ncAlertCircle',
  alertFilled: 'ncAlertCircleFilled',
  alertTriangle: 'ncAlertTriangle',
  alertOctagon: 'ncAlertOctagon',
  info: 'ncInfo',
  
  // Security & Privacy
  lock: 'ncLock',
  unlock: 'ncUnlock',
  key: 'ncKey',
  shield: 'ncShield',
  shieldOff: 'ncShieldOff',
  eye: 'ncEye',
  eyeOff: 'ncEyeOff',
  
  // Authentication
  logIn: 'ncLogIn',
  logOut: 'ncLogOut',
  
  // Shapes & Symbols
  circle: 'ncCircle',
  square: 'ncSquare',
  triangle: 'ncTriangle',
  hexagon: 'ncHexagon',
  octagon: 'ncOctagon',
  star: 'ncStar',
  heart: 'ncHeart',
  target: 'ncTarget',
  crosshair: 'ncCrosshair',
  
  // Tools & Utilities
  tool: 'ncTool',
  wrench: 'ncTool',
  paintRoller: 'ncPaintRoller',
  penTool: 'ncPenTool',
  crop: 'ncCrop',
  move: 'ncMove',
  
  // Size & View Controls
  maximize: 'ncMaximize',
  maximize2: 'ncMaximize2',
  minimize: 'ncMinimize',
  minimize2: 'ncMinimize2',
  zoomIn: 'ncZoomIn',
  zoomOut: 'ncZoomOut',
  
  // Rotation & Transform
  rotateCw: 'ncRotateCw',
  rotateCcw: 'ncRotateCcw',
  refreshCw: 'ncRefreshCw',
  refreshCcw: 'ncRefreshCcw',
  refresh: 'ncRefreshCw',
  
  // Toggle & Switch
  toggleLeft: 'ncToggleLeft',
  toggleRight: 'ncToggleRight',
  
  // Links & Sharing
  link: 'ncLink',
  link2: 'ncLink2',
  externalLink: 'ncExternalLink',
  share: 'ncShare',
  share2: 'ncShare2',
  send: 'ncSend',
  
  // Business & Finance
  briefcase: 'ncBriefcase',
  dollarSign: 'ncDollarSign',
  creditCard: 'ncCreditCard',
  package: 'ncPackage',
  box: 'ncBox',
  
  // Office & Productivity
  clipboard: 'ncClipboard',
  calendar: 'ncCalendar',
  clock: 'ncClock',
  bookmark: 'ncBookmark',
  printer: 'ncPrinter',
  inbox: 'ncInbox',
  
  // Development & Code
  code: 'ncCode',
  codeBlock: 'ncCodeBlock',
  terminal: 'ncTerminal',
  command: 'ncCommand',
  gitBranch: 'ncGitBranch',
  gitCommit: 'ncGitCommit',
  gitPullRequest: 'ncGitPullRequest',
  
  // Geography & Location
  globe: 'ncGlobe',
  mapPin: 'ncMapPin',
  navigation: 'ncNavigation',
  navigation2: 'ncNavigation2',
  compass: 'ncCompass',
  
  // Emotions & Reactions
  smile: 'ncSmile',
  frown: 'ncFrown',
  thumbsUp: 'ncThumbsUp',
  thumbsDown: 'ncThumbsDown',
  
  // Energy & Power
  power: 'ncPower',
  battery: 'ncBattery',
  batteryCharging: 'ncBatteryCharging',
  zap: 'ncZap',
  zapOff: 'ncZapOff',
  
  // Nature & Elements
  droplet: 'ncDroplet',
  moon: 'ncMoon',
  
  // Entertainment & Media
  disc: 'ncDisc',
  film: 'ncFilm',
  radio: 'ncRadio',
  
  // Learning & Knowledge
  book: 'ncBook',
  bookOpen: 'ncBookOpen',
  
  // Symbols & Characters
  hash: 'ncHash',
  atSign: 'ncAtSign',
  percent: 'ncPercent',
  slash: 'ncSlash',
  
  // Organization & Structure
  layers: 'ncLayers',
  flag: 'ncFlag',
  award: 'ncAward',
  
  // Interface Elements
  loader: 'ncLoader',
  mousePointer: 'ncMousePointer',
  image: 'ncImage',
  paperclip: 'ncPaperclip',
  pocket: 'ncPocket',
  
  // Special/Unique
  autoAwesome: 'ncAutoAwesome',
  magic: 'ncAutoAwesome',
  ai: 'ncAutoAwesome',
  rss: 'ncRss',
  webhook: 'ncWebhook',
  megaphone: 'ncMegaPhoneDuo',
  conditions: 'ncConditions',
  integration: 'ncIntegrationDuo',
  base: 'ncBaseOutline',
  baseDuo: 'ncBaseOutlineDuo',
  
  // Social Media & Platforms
  github: 'ncGithub',
  gitlab: 'ncGitlab',
  instagram: 'ncInstagram',
  linkedin: 'ncLinkedin',
  youtube: 'ncYoutube',
  chrome: 'ncChrome',
  
  // Logo Icons - AI & Tools
  openai: 'ncLogoOpenAi',
  claude: 'ncLogoClaudeAi',
  gemini: 'ncLogoGeminiAi',
  groq: 'ncLogoGroqAi',
  ollama: 'ncLogoOllama',
  
  // Logo Icons - Communication
  slack: 'ncLogoSlack',
  discord: 'ncLogoDiscord',
  teams: 'ncLogoTeams',
  telegram: 'ncLogoTelegram',
  whatsapp: 'ncLogoWhatsapp',
  twitter: 'ncLogoTwitter',
  facebook: 'ncLogoFacebook',
  
  // Logo Icons - Productivity
  gmail: 'ncLogoGmail',
  outlook: 'ncLogoOutlook',
  googleDrive: 'ncLogoGoogleDrive',
  dropbox: 'ncLogoDropbox',
  box: 'ncLogoBoxLogo',
  
  // Logo Icons - Project Management
  asana: 'ncLogoAsana',
  jira: 'ncLogoJira',
  trello: 'ncLogoTrello',
  miro: 'ncLogoMiro',
  
  // Logo Icons - Design & Development
  figma: 'ncLogoFigma',
  framer: 'ncLogoFramer',
  bitbucket: 'ncLogoBitbucket',
  
  // Logo Icons - Business & CRM
  salesforce: 'ncLogoSalesforce',
  hubspot: 'ncLogoHubspot',
  pipedrive: 'ncLogoPipedrive',
  zoho: 'ncLogoZoho',
  dynamics: 'ncLogoMsDynamics',
  
  // Logo Icons - HR & Recruiting
  greenhouse: 'ncLogoGreenhouse',
  lever: 'ncLogoLever',
  workday: 'ncLogoWorkday',
  
  // Logo Icons - Support & Service
  zendesk: 'ncLogoZendesk',
  freshdesk: 'ncLogoFreshdesk',
  intercom: 'ncLogoIntercom',
  
  // Logo Icons - Marketing & Analytics
  mailchimp: 'ncLogoMailchimp',
  surveymonkey: 'ncLogoSurveyMonkey',
  typeform: 'ncLogoTypeform',
  
  // Logo Icons - Finance & Payments
  stripe: 'ncLogoStripe',
  quickbooks: 'ncLogoQuickbooks',
  
  // Logo Icons - Communication & APIs
  twilio: 'ncLogoTwilio',
  
  // Logo Icons - Entertainment
  twitch: 'ncLogoTwitch',
};

  const _____nc_mail = (config) => {
    output.text('Send Email is not supported in this environment.');
    return;
  }
  
  const step = (config) => {
    // End previous step if running
    if (__nc_currentStepId) {
      self.postMessage({
        type: '${ScriptActionType.WORKFLOW_STEP_END}',
        payload: { stepId: __nc_currentStepId }
      });
    }
    
    // Generate new step ID
    const stepId = Math.random().toString(36).substr(2, 9);
    __nc_currentStepId = stepId;
    
    // Prepare payload - handle both string and object input
    let payload;
    if (typeof config === 'string') {
      payload = { stepId, title: config };
    } else {
      payload = {
        stepId,
        title: config.title,
        description: config.description,
        icon: config.icon,
        color: config.color
      };
    }
    
    // Clean undefined values
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) delete payload[key];
    });
    
    // Send step start message
    self.postMessage({
      type: '${ScriptActionType.WORKFLOW_STEP_START}',
      payload
    });
    
    return stepId;
  };
  
  const clear = () => {
    if (__nc_currentStepId) {
      self.postMessage({
        type: '${ScriptActionType.WORKFLOW_STEP_END}',
        payload: { stepId: __nc_currentStepId }
      });
      __nc_currentStepId = null;
    }
  };
  
  const script = { step, clear, colors, icons, email: _____nc_mail };
  `
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
    
    const getMonthName = (monthIndex) => {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return monthNames[monthIndex];
    };
    
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
      'DD MMM YYYY',
      'DD MMM YY',
    ];
    
    const parseDateString = (dateStr, format) => {
      const patterns = {
        YYYY: "(\\\\d{4})",
        YY: "(\\\\d{2})",
        MMM: "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)",
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
      const formatParts = format.match(/(YYYY|YY|MMM|MM|DD|HH|mm|ss|SSS)/g);
      formatParts?.forEach((part) => {
        const value = parseInt(match[matchIndex++]);
        switch (part) {
          case "YYYY":
            parts.year = value
            break;
          case "YY":
            parts.year = 2000 + value
            break;
          case "MMM":
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            parts.month = monthNames.indexOf(value);
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
      const monthName = getMonthName(date.getMonth());
      const day = padZero(date.getDate());
      const hours24 = date.getHours();
      const hours12 = hours24 % 12 || 12;
      const minutes = padZero(date.getMinutes());
      const seconds = padZero(date.getSeconds());
      const milliseconds = padMilliseconds(date.getMilliseconds());
      const ampm = hours24 >= 12 ? 'PM' : 'AM';
      
      const is12Hr = format.includes('a') || format.includes('A');
      let result = format;
      
      result = result.replace(/A/g, ampm);
      result = result.replace(/a/g, ampm.toLowerCase());
      result = result.replace(/YYYY/g, year.toString());
      result = result.replace(/YY/g, year.toString().slice(-2));
      result = result.replace(/MMM/g, monthName);
      result = result.replace(/MM/g, month);
      result = result.replace(/DD/g, day);
      result = result.replace(/HH/g, padZero(is12Hr ? hours12 : hours24));
      result = result.replace(/hh/g, padZero(is12Hr ? hours12 : hours24));
      result = result.replace(/mm/g, minutes);
      result = result.replace(/ss/g, seconds);
      result = result.replace(/SSS/g, milliseconds);

      return result;
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
  const UITypes = {
  ID: 'ID',
  LinkToAnotherRecord: 'LinkToAnotherRecord',
  ForeignKey: 'ForeignKey',
  Lookup: 'Lookup',
  SingleLineText: 'SingleLineText',
  LongText: 'LongText',
  Attachment: 'Attachment',
  Checkbox: 'Checkbox',
  MultiSelect: 'MultiSelect',
  SingleSelect: 'SingleSelect',
  Date: 'Date',
  Year: 'Year',
  Time: 'Time',
  PhoneNumber: 'PhoneNumber',
  GeoData: 'GeoData',
  Email: 'Email',
  URL: 'URL',
  Number: 'Number',
  Decimal: 'Decimal',
  Currency: 'Currency',
  Percent: 'Percent',
  Duration: 'Duration',
  Rating: 'Rating',
  Formula: 'Formula',
  Rollup: 'Rollup',
  DateTime: 'DateTime',
  CreatedTime: 'CreatedTime',
  LastModifiedTime: 'LastModifiedTime',
  Geometry: 'Geometry',
  JSON: 'JSON',
  SpecificDBType: 'SpecificDBType',
  Barcode: 'Barcode',
  QrCode: 'QrCode',
  Button: 'Button',
  Links: 'Links',
  User: 'User',
  CreatedBy: 'CreatedBy',
  LastModifiedBy: 'LastModifiedBy',
  Order: 'Order',
};

// To make it immutable (optional)
Object.freeze(UITypes);
  
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
  
  const extractObjFromPk = (id, fields) => {
    const where = {};
    const pkCols = fields.filter(f => f.primary_key)
    
    let ids;
    if(pkCols.length > 1) {
      ids = id.split('___').map((val) => val.replaceAll('\\\\_', '_'));
    } else {
      ids = [id];
    }
    
    for (let i = 0; i < pkCols.length; i++) {
      where[pkCols[i].name] = ids[i];
    }
    return where
  }
  
  const extractPk = (row, fields) => {
    if(!row || !fields?.length) return null
    
    const pkCols = fields.filter(f => f.primary_key)
       
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
    #nextToken;
    #prevToken;
    
    #linkFieldId; // For LTAR-specific pagination
    #parentRecordId; // For LTAR-specific pagination
    
    constructor(data, table, view, options, linkFieldId = null, parentRecordId = null) {
      this.#table = table;
      this.#view = view;
      this.#options = options;
      
      this.#linkFieldId = linkFieldId;
      this.#parentRecordId = parentRecordId;
      
      this.#pageInfo = {
        hasNext: !!data.next,
        hasPrev: !!data.prev,
        isLastPage: !data.next,
      };
      this.#nextToken = data.next || null;
      this.#prevToken = data.prev || null;

      const records = []
      
      this.#rawData = data.records || [];
      
      this.recordIds = Object.freeze(data.records.map(row => {
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
      if (!this.#nextToken) {
        return null;
      }
      
      let response;
      
      if (this.#linkFieldId && this.#parentRecordId) {
        // For LTAR fields, use the nested list API
        const url = new URL(this.#nextToken);
        const page = parseInt(url.searchParams.get('page') || '1');
        
        try {
          response = await api.dbDataTableRowNestedList(
            this.#table.id,
            this.#linkFieldId,
            this.#parentRecordId,
            this.#table.base.id,
            {
              ...this.#options,
              page,
            }
          );
        } catch (e) {
          throw new Error(e);
        }
      } else {
        // For regular table queries
        const url = new URL(this.#nextToken);
        const page = parseInt(url.searchParams.get('page') || '1');
        
        try {
          response = await api.dbDataTableRowList(
            this.#table.base.id,
            this.#table.id,
            {
              ...this.#options,
              page,
              ...(this.#view ? { viewId: this.#view.id } : {})
            }
          );
        } catch (e) {
          throw new Error(e);
        }
      }
      
      this.#rawData = [...this.#rawData, ...(response.records || [])];
      const records = [...this.records];
      
      const newRecordIds = (response.records || []).map(row => {
        const record = new NocoDBRecord(row, this.#table);
        records.push(record);
        this.#recordsById.set(record.id, record);
        return record.id;
      });
      
      this.recordIds = Object.freeze([...this.recordIds, ...newRecordIds]);
      this.records = Object.freeze(records);
      
      this.#nextToken = response.next || null;
      this.#prevToken = response.prev || null;
    
      this.#pageInfo = {
        hasNext: !!response.next,
        hasPrev: !!response.prev,
        isLastPage: !response.next,
      };
      
      return this;
    }
    
    get hasMoreRecords() {
      return !!this.#nextToken;
    }
    
    get nextToken() {
      return this.#nextToken;
    }
    
    get rawData() {
      return this.#rawData;
    }
  
    get prevToken() {
      return this.#prevToken;
    }
  }
  
  class LazyRecordQueryResult extends RecordQueryResult {
    #parentTable;
    #linkField;
    #parentRecordId;
    #isFullyLoaded = false;
    
    constructor(initialData, relatedTable, parentTable, linkField, parentRecordId) {
      // Initialize with embedded data (first 1000 records or whatever was included)
      super({ 
        records: initialData, 
        next: initialData.length >= 1000 ? 'has_more' : null, // Assume more if we got 1000
        prev: null 
      }, relatedTable, null, {});
      
      this.#parentTable = parentTable;
      this.#linkField = linkField;
      this.#parentRecordId = parentRecordId;
      this.#isFullyLoaded = initialData.length < 1000;
    }
    
    async loadMoreRecords() {
      if (this.#isFullyLoaded || !this.hasMoreRecords) {
        return null;
      }
      
      // Calculate next page based on current record count
      const currentPage = Math.floor(this.records.length / 1000) + 1;
      
      let response;
      
      try {
        response = await api.dbDataTableRowNestedList(
          this.#parentTable.id,
          this.#linkField.id,
          this.#parentRecordId,
          this.#parentTable.base.id,
          {
            page: currentPage,
            pageSize: 1000
          }
        );
      } catch (e) {
        throw new Error(e);
      }
      
      if (!response.records || response.records.length === 0) {
        this.#isFullyLoaded = true;
        return this;
      }
      // Append new records
      this._appendRecords(response.records);
      
      // Check if we're done
      if (response.records.length < 1000) {
        this.#isFullyLoaded = true;
      }
      
      return this;
    }
    
    _appendRecords(newRecords) {
      const records = [...this.records];
      const recordsById = this._getRecordsById();
      const newRecordIds = newRecords.map(row => {
        const record = new NocoDBRecord(row, this.table);
        records.push(record);
        recordsById.set(record.id, record);
        return record.id;
      });
      
      this.recordIds = Object.freeze([...this.recordIds, ...newRecordIds]);
      this.records = Object.freeze(records);
    }
    
    get hasMoreRecords() {
      return !this.#isFullyLoaded;
    }
  }
  
  class NocoDBRecord {
    #table
    #recordData
  
    constructor(recordData, table) {
      this.#table = table;
      this.#recordData = recordData;
      this.id = recordData.id;
      const displayField = this.#table.fields.find(f => f.primary_value)
      this.name = displayField ? recordData.fields?.[displayField.name] ?? this.id : this.id;
    }
    
    get rawData() {
      return this.#recordData;
    }
    
    getCellValue(fieldOrFieldIdOrName) {
      let field = typeof fieldOrFieldIdOrName === 'string' ? this.#table.getField(fieldOrFieldIdOrName) : fieldOrFieldIdOrName;
      
      if(!field) {
        throw new Error(\`Field \${fieldOrFieldIdOrName?.name ?? fieldOrFieldIdOrName} not found\`)
      }
      
      if (field.name in this.#recordData.fields) {
        const data = this.#recordData.fields?.[field.name];
        
        switch(field.type) {
          case 'MultiSelect':
            return data || [];
          case 'User':
          case 'CreatedBy':
          case 'LastModifiedBy': {
            if (!field.options?.allow_multiple_users) {
              const userData = data?.length ? data[0] : data;
               return userData ? new Collaborator({ id: userData.id, email: userData.email, name: userData.display_name ?? '' }) : null;
            } else return (data?.map(d => new Collaborator({ id: d.id, email: d.email, name: d.display_name ?? '' })) ?? []);
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
              return new LazyRecordQueryResult(data || [], relatedTable, this.#table, field, this.id)
            }
            if (['bt', 'oo'].includes(field?.options?.relation_type)) {
              if(!data) return null;
              
              return (new NocoDBRecord(data, relatedTable))
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
          if (field?.options?.locale_string) {
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
            if (value instanceof LazyRecordQueryResult || value instanceof RecordQueryResult) {
              const count = value.records.length;
              const hasMore = value.hasMoreRecords ? '+' : '';
              return \`\${count}\${hasMore} linked record\${count !== 1 ? 's' : ''}\`;
            }
            return value?.map?.((v) => v.name || v.id).join(', ') || '';
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
          const relationField = this.#table.getField(field?.options?.related_field_id)
          const relatedTable = base.getTable(relationField?.options?.related_table_id)
          
          const relatedField = relatedTable.getField(field?.options?.related_table_lookup_field_id)
          
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
    #primary_key;
    #primary_value;
    #is_system_field
    constructor(data, table) {
      this.id = data.id;
      this.name = data.name;
      this.type = data.type;
      this.description = data.description;
      this.options = Object.keys(data.options ?? {}).length ? data.options : null;
      this.isComputed = ['LinkToAnotherRecord', 'Formula', 'QrCode', 'Barcode', 'Rollup', 'Links', 'CreatedTime', 'LastModifiedTime', 'CreatedBy', 'LastModifiedBy', 'Button'].includes(data.type);
      
      this.#primary_key = data.primary_key
      this.#is_system_field = data.is_system_field
      this.#primary_value = data.primary_value
      this.#table = table;
    }
    
    get primary_key() {
      return this.#primary_key;
    }
    
    get primary_value() {
      return this.#primary_value;
    }
    
    get is_system_field() {
      return this.#is_system_field;
    }
    
    async updateOptionsAsync(options) {
      try {
        await api.fieldUpdate(this.#table.base.id, this.id, { id: this.id, type: this.type, title: this.name, options: options });
        return this
      } catch (e) {
        throw new Error(\`Failed to update field options: \${e.message}\`);
      }
    }
    
    async updateDescriptionAsync(description) {
      try {
        await api.fieldUpdate(this.#table.base.id, this.id, {  id: this.id, type: this.type, title: this.name, description });
        this.description = description;
        return this;
      } catch (e) {
        throw new Error(\`Failed to update field description: \${e.message}\`);
      } 
    }
    
    async updateNameAsync(name) {
      try {
        await api.fieldUpdate(this.#table.base.id, this.id, {  id: this.id, type: this.type, title: name });
        this.name = name;
        return this;
      } catch (e) {
        throw new Error(\`Failed to update field name: \${e.message}\`);
      }
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
      
      const pvAndPk = this.#table.fields.filter(f => f.primary_value || f.primary_key).map(f => f.name)
      
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
      
      
      try {
        const data = await api.dbDataTableRowRead(this.#table.base.id, this.#table.id, recordId, {
          viewId: this.id,
          ...(fields?.length && { fields: fieldsToSelect })
        })
        
        return new NocoDBRecord(data, this.#table);
      } catch (e) {
        return null
      }   
    }
    
    async selectRecordsAsync(options = {}) {
      const { sorts = [], fields = [], recordIds = [], pageSize = 50, page = 1, where = '' } = options
           
      const pvAndPk = this.#table.fields.filter(f => f.primary_value || f.primary_key).map(f => f.name)
      
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
      
      const sortArray = sorts.map(sort => {
        if (typeof sort.field === 'string') {
          const field = this.#table.getField(sort.field)
          
          if (!field) {
            throw new Error(\`Field \${sort.field} not found in table \${this.#table.name}\`)
          }
          
          return { direction: sort.direction, field: field.name };          
        }
      }).filter(Boolean)
      
      const requestOptions = {
        viewId: this.id,
        page,
        where,
        pageSize,
        ...(recordIds?.length && { pks: recordIds.join(',') }),
        ...(fieldsToSelect && { fields: fieldsToSelect }),
        ...(sortArray.length && { sort: sortArray }),
      };
      try {
        const data = await api.dbDataTableRowList(this.#table.base.id, this.#table.id, requestOptions)
        
        return new RecordQueryResult(data, this.#table, this, requestOptions);
      } catch (e) {
        return null
      }       
    }
  }
  
  class Table {
    #base;
    #all_fields
    constructor(data, base) {
      this.id = data.id;
      this.name = data.name;
      this.description = data.description;
      this.#all_fields = data.fields.map((f) => new Field({id: f.id, name: f.name, type: f.type, description: f.description, options: f.options, primary_key: f.primary_key, primary_value: f.primary_value, is_system_field: f.is_system_field}, this));
      this.views = data.views.map(v => new View({id: v.id, name: v.name, description: v.description, type: v.type}, this));
      this.#base = base;
      
      this.fields = this.#all_fields.filter(f => !f.is_system_field);
    }
    
    getField(idOrName) {
      return this.#all_fields.find((field) => field.id === idOrName || field.name === idOrName)
    }
    
    get base () {
      return this.#base;
    }
    
    getView(idOrName) {
      return this.views.find((view) => view.id === idOrName || view.name === idOrName)
    }
    
    async createFieldAsync(field) {
      if (this.getField(field.name)) throw new Error(\`Field \${field.name} already exists in table \${this.name}\`)
      
      if (field.type === 'Button') {
        throw new Error('Button field creation is not supported at the moment')
      }
      
      if (!field.name || !field.type) {
        throw new Error('Field name and type are required')
      }
      
      field.title = field.name
      delete field.name
      try {
        const data = await api.fieldCreate(this.id, this.#base.id, field);
        const newField = new Field({id: data.id, name: data.title, type: data.type, description: data.description, options: data.options, primary_key: false, primary_value: false, is_system_field: false}, this);
        this.#all_fields.push(newField);
        this.fields = this.#all_fields.filter(f => !f.is_system_field);
        return newField;
      } catch (e) {
        throw new Error(\`Failed to create field \${field.title} in table \${this.name}\`)
      }
    }
    
    async selectRecordAsync(recordId, options = {}) {
      const { fields = [] } = options;
      
      const pvAndPk = this.fields.filter(f => f.primary_value || f.primary_key).map(f => f.name)
           
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
      
      if (!recordId) {
        throw new Error('Record ID is required')
      }
      
      try {
        const data = await api.dbDataTableRowRead(this.base.id, this.id, recordId, {
          ...(fields?.length && { fields: fieldsToSelect })
        })
        
        return new NocoDBRecord(data, this);
      } catch (e) {
        throw new Error(\`Failed to read record \${recordId} in table \${this.name}\`)
      }
    }
    
    async selectRecordsAsync(options = {}) {
      const { sorts = [], fields = [], recordIds = [], pageSize = 50, page = 1, where = '' } = options
           
      const pvAndPk = this.fields.filter(f => f.primary_value || f.primary_key).map(f => f.name)
      
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
      
      const sortArray = sorts.map(sort => {
        if (typeof sort.field === 'string') {
          const field = this.getField(sort.field)
          
          if (!field) {
            throw new Error(\`Field \${sort.field} not found in table \${this.name}\`)
          }
          
          return { direction: sort.direction, field: field.name };
        }
      }).filter(Boolean)
      
      const requestOptions = {
        page,
        where,
        pageSize,
        ...(fieldsToSelect && { fields: fieldsToSelect }),
        ...(sortArray.length && { sort: sortArray }),
      };
      
      try {
        const data = await api.dbDataTableRowList(this.#base.id, this.id, requestOptions)
        
        return new RecordQueryResult(data, this, null, requestOptions);
      } catch (e) {
        throw new Error(\`Failed to read records in table \${this.name}\`)
      }
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
      
      try {
        const data = await api.dbDataTableRowCreate(this.base.id, this.id, { fields: recordData });
        return new NocoDBRecord(data?.records?.[0], this).id;
      } catch (e) {
        throw new Error(\`Failed to create record in table \${this.name}\`)
      }
    }
    
    async createRecordsAsync(data) {
      const insertObjs = []
      
      if (!Array.isArray(data)) {
        throw new Error('Data must be an array');
      }
      
      if (data.length === 0) {
        throw new Error('Data must not be empty');
      }
      
      if (data.length > 10) {
        throw new Error('Data must not be greater than 10');
      }
      
      for(const record of data) {
        const recordData = {
          fields: {}
        };
        for (const field of this.fields) {
          if (record.fields[field.name]) {
            recordData.fields[field.name] = record.fields[field.name];
          } else if (record.fields[field.id]) {
            recordData.fields[field.name] = record.fields[field.id];
          }
        }
        insertObjs.push(recordData);
      }
      
      try {
        const response = await api.dbDataTableRowCreate(this.base.id, this.id, insertObjs);
        return (response.records || []).map(r => new NocoDBRecord(r, this).id);
      } catch (e) {
        throw new Error(\`Failed to create records in table \${this.name}\`)
      }
    }
    
    async updateRecordAsync(recordId, data) { 
      const recordID = (recordId instanceof NocoDBRecord) ? recordId.id: recordId
      const recordData = {};
      const updatedFields = [];
      
      for (const field of this.fields) {
        if (data[field.name]) {
          recordData[field.name] = data[field.name];
          updatedFields.push({ id: field.id, name: field.name });
        } else if (data[field.id]) {
          recordData[field.name] = data[field.id];
          updatedFields.push({ id: field.id, name: field.name });
        }
      }
      
      // Notify that record update is starting
      self.postMessage({
        type: '${ScriptActionType.RECORD_UPDATE_START}',
        payload: {
          recordId: recordID,
          tableId: this.id,
          tableName: this.name,
          fields: updatedFields
        }
      });
      
      try {
        await api.dbDataTableRowUpdate(this.base.id, this.id, { fields: recordData, id: recordID });
        
        // Notify that record update is complete
        self.postMessage({
          type: '${ScriptActionType.RECORD_UPDATE_COMPLETE}',
          payload: {
            recordId: recordID,
            tableId: this.id,
            tableName: this.name,
            fields: updatedFields,
            success: true
          }
        });
      } catch (e) {
        // Notify that record update failed
        self.postMessage({
          type: '${ScriptActionType.RECORD_UPDATE_COMPLETE}',
          payload: {
            recordId: recordID,
            tableId: this.id,
            tableName: this.name,
            fields: updatedFields,
            success: false,
            error: e.message
          }
        });
        throw new Error('Failed to update record ' + recordId + ' in table ' + this.name)
      }
    }
    
    async updateRecordsAsync(records) {
      const updateObjs = []
      const allUpdatedFields = []
      
      if (!Array.isArray(records)) {
        throw new Error('Data must be an array');
      }
      
      if (records.length === 0) {
        throw new Error('Data must not be empty');
      }
      
      if (records.length > 10) {
        throw new Error('Data must not be greater than 10');
      }
      
      for (const record of records) {
        const recordID = (record.id instanceof NocoDBRecord) ? record.id.id : record.id;
        const recordData = {};
        const updatedFields = [];
        
        for (const field of this.fields) {
          const fieldData = record.fields;
          if (fieldData[field.name]) {
            recordData[field.name] = fieldData[field.name];
            updatedFields.push({ id: field.id, name: field.name });
          } else if (fieldData[field.id]) {
            recordData[field.name] = fieldData[field.id];
            updatedFields.push({ id: field.id, name: field.name });
          }
        }
        updateObjs.push({ fields: recordData, id: recordID });
        allUpdatedFields.push({ recordId: recordID, fields: updatedFields });
        
        // Notify that record update is starting for this record
        self.postMessage({
          type: '${ScriptActionType.RECORD_UPDATE_START}',
          payload: {
            recordId: recordID,
            tableId: this.id,
            tableName: this.name,
            fields: updatedFields
          }
        });
      }
      
      try {
        await api.dbDataTableRowUpdate(this.base.id, this.id, updateObjs);
        
        // Notify that all record updates are complete
        for (const { recordId, fields } of allUpdatedFields) {
          self.postMessage({
            type: '${ScriptActionType.RECORD_UPDATE_COMPLETE}',
            payload: {
              recordId: recordId,
              tableId: this.id,
              tableName: this.name,
              fields: fields,
              success: true
            }
          });
        }
      } catch (e) {
        // Notify that all record updates failed
        for (const { recordId, fields } of allUpdatedFields) {
          self.postMessage({
            type: '${ScriptActionType.RECORD_UPDATE_COMPLETE}',
            payload: {
              recordId: recordId,
              tableId: this.id,
              tableName: this.name,
              fields: fields,
              success: false,
              error: e.message
            }
          });
        }
        throw new Error('Failed to update records in table ' + this.name)
      }
    }
    
    async deleteRecordAsync(recordIdOrRecord) {
      const recordID = (recordIdOrRecord instanceof NocoDBRecord) ? recordIdOrRecord.id: recordIdOrRecord
      if (!recordID) {
        throw new Error('Record ID is required');
      }
      try {
        await api.dbDataTableRowDelete(this.base.id, this.id, { id: recordID });
        return true
      } catch (e) {
        throw new Error(\`Failed to delete record \${recordID} in table \${this.name}\`)
      }
    }
    
    async deleteRecordsAsync(recordIds) {
      const deleteObjs = []
      for (const recordId of recordIds) {
        deleteObjs.push({ id: recordId });
      }
      if (deleteObjs.length === 0) {
        throw new Error('Record IDs are required');
      }
      
      if (deleteObjs.length > 10) {
        throw new Error('You can only delete up to 10 records at a time');
      }
      
      try {
        await api.dbDataTableRowDelete(this.base.id, this.id, deleteObjs);
        return true
      } catch (e) {
        throw new Error(\`Failed to delete records in table \${this.name}\`)
      }
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
      return this.activeCollaborators.find((collaborator) => 
        collaborator.id === idOrNameOrEmail || 
        collaborator.name === idOrNameOrEmail || 
        (collaborator.email && idOrNameOrEmail && collaborator.email.toLowerCase() === idOrNameOrEmail.toLowerCase())
      )
    }
    
    getTable(idOrName) {
      if(idOrName instanceof Table) {
        idOrName = idOrName.id
      }
      return this.tables.find((table) => table.id === idOrName || table.name === idOrName)
    }
    
    async createTableAsync(name, fields) {
      fields = fields.map((f) => {
         f.title = f.name
         delete f.name
         return f
      })
      
      if(!name) {
        throw new Error('Table name is required');
      }
      
      try {
        const res = await api.tableCreate(this.id, {
          title: name,
          fields: fields
        })
        
        const newT = new Table({id: res.id, name: res.title, description: res.description, views: res.views, fields: res.fields }, this);
        
        this.tables.push(newT);
        
        return newT
      } catch (e) {
        throw new Error(\`Failed to create table \${name}\`)
      }
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
      target[prop] = function(...args) {
        const id = Math.random().toString(36).substring(2);
        const message = {
          type: '${ScriptActionType.CALL_API}',
          payload: { id, method: prop.toString(), args },
        };
        self.postMessage(message);
        return new Promise((resolve, reject) => {
          function handleMessage(e) {
            const responseMessage = e.data;
            if (responseMessage.type === '${ScriptActionType.RESPONSE}' && responseMessage.payload.id === id) {
              self.removeEventListener('message', handleMessage);
              
              const response = responseMessage.payload.payload;
              
              // Error handling
              if (response && typeof response === 'object' && response.error) {
                const error = response.error;
                
                const apiError = new Error(error.message || 'API request failed');
                apiError.name = error.name || 'APIError';
                
                if (error.method) apiError.method = error.method;
                if (error.status) apiError.status = error.status;
                if (error.statusText) apiError.statusText = error.statusText;
                if (error.code) apiError.code = error.code;
                if (error.responseStatus) apiError.responseStatus = error.responseStatus;
                if (error.responseData) apiError.responseData = error.responseData;
                if (error.stack) apiError.stack = error.stack;
                
                reject(apiError);
                return;
              }
              // Success case
              resolve(response);
            }
          }
          self.addEventListener('message', handleMessage);
        });
      };
    }
    return target[prop];
  }
});`
}

function generateRemoteFetch(): string {
  return `
    const remoteFetchAsync = async (url, options) => {
      return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substr(2, 9);
        self.postMessage({ 
          type: '${ScriptActionType.REMOTE_FETCH}', 
          payload: { url, options, id } 
        });
        self.addEventListener('message', function handler(event) {
          if (event.data.type === '${ScriptActionType.REMOTE_FETCH}' && event.data.payload.id === id) {
            self.removeEventListener('message', handler);
            
            const response = event.data.payload.value;
            const isError = event.data.payload.error;
            
            if (isError) {
              // Create an error object that mimics axios error structure
              const error = new Error(response.error?.message || 'Request failed');
              error.response = {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                config: response.config
              };
              error.config = response.config;
              error.code = response.error?.code;
              error.name = response.error?.name || 'AxiosError';
              
              reject(error);
              return;
            }
            resolve(response);
          }
        });
      })
    };
  `
}

function generateProgressAPIs(): string {
  return `
    const updateProgress = (type, { rowId, cellId, progress, message, icon } = {}) => {
      const progressMessage = {
        type: '${ScriptActionType.UPDATE_PROGRESS}',
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
        type: '${ScriptActionType.RESET_PROGRESS}',
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
            type: '${ScriptActionType.INPUT}', 
            payload: { type: '${ScriptInputType.TEXT}', label, id, stepId: __nc_currentStepId } 
          });
          function handler(event) {
            if (event.data.type === '${ScriptActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
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
            type: '${ScriptActionType.INPUT}', 
            payload: { type: '${ScriptInputType.SELECT}', label, options: processedOptions, id, stepId: __nc_currentStepId } 
          });
          function handler(event) {
            if (event.data.type === '${ScriptActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
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
              return { label: option, value: option, variant: 'default', stepId: __nc_currentStepId };
            }
            return option;
          });
          
          self.postMessage({ 
            type: '${ScriptActionType.INPUT}', 
            payload: { type: '${ScriptInputType.BUTTONS}', label, options: processedOptions, id } 
          });
          function handler(event) {
            if (event.data.type === '${ScriptActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
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
            type: '${ScriptActionType.INPUT}', 
            payload: { 
              label,
              id,
              type: '${ScriptInputType.FILE}', 
              accept: options.allowedFileTypes?.join(',') || '', 
              hasHeaderRow: options.hasHeaderRow,
              useRawValues: options.useRawValues
            },
            stepId: __nc_currentStepId
          });
          function handler(event) {
            if (event.data.type === '${ScriptActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
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
            type: '${ScriptActionType.INPUT}',
            payload: { type: '${ScriptInputType.TABLE}', label, id },
            stepId: __nc_currentStepId
          })
          function handler(event) {
            if (event.data.type === '${ScriptActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
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
          
          if (!tableIdOrTableNameOrTable) {
            throw new Error('Table is required');
          }
          
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
            type: '${ScriptActionType.INPUT}',
            payload: { type: '${ScriptInputType.VIEW}', tableId, label, id },
            stepId: __nc_currentStepId
          })
          function handler(event) {
            if (event.data.type === '${ScriptActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
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
          
          if (!tableIdOrTableNameOrTable) {
            throw new Error('Table is required');
          }
          
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
            type: '${ScriptActionType.INPUT}',
            payload: { type: '${ScriptInputType.FIELD}', tableId, label, id },
            stepId: __nc_currentStepId
          })
          function handler(event) {
            if (event.data.type === '${ScriptActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
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
            records = convertRecordsV3ToV2(source.rawData, source.table);
            tableId = source.table.id;
          } else if (Array.isArray(source) && source.length && source[0] instanceof NocoDBRecord) {
            records = source.map(r => r.raw_data);
            tableId = source[0].table.id;
          }
          
          const fields = []
          
          const table = base.getTable(tableId)

          const pvAndPk = table.fields.filter(f => f.primary_value || f.primary_key).map(f => f.name)
          
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
            type: '${ScriptActionType.INPUT}',
            payload: { type: '${ScriptInputType.RECORD}', tableId, viewId, records, label, id, options: { fields: options?.fields ? fieldsToSelect : [] } },
            stepId: __nc_currentStepId
          });
          
          function handler(event) {
            if (event.data.type === '${ScriptActionType.INPUT_RESOLVED}' && event.data.payload.id === id) {
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
        set: () => {
          throw new Error(\`Cannot modify '${name}' in this environment\`);
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
        self.postMessage({ type: '${ScriptActionType.LOG}', payload: { args, stepId: __nc_currentStepId } });
      },
      error: (...args) => {
        self.postMessage({ type: '${ScriptActionType.ERROR}', payload: { args, stepId: __nc_currentStepId } });
      },
      warn: (...args) => {
        self.postMessage({ type: '${ScriptActionType.WARN}', payload: { args, stepId: __nc_currentStepId } });
      },
    };
  `
}

function generateOutput(): string {
  return `
    const output = {
      text: (message, type) => {
        self.postMessage({ 
          type: '${ScriptActionType.OUTPUT}', 
          payload: { message: JSON.stringify({ action: 'text', args: [message, type] }), stepId: __nc_currentStepId } 
        });
      },
      markdown: (content) => {
        self.postMessage({ 
          type: '${ScriptActionType.OUTPUT}', 
          payload: { message: JSON.stringify({ action: 'markdown', args: [content] }), stepId: __nc_currentStepId } 
        });
      },
      table: (data) => {
        self.postMessage({ 
          type: '${ScriptActionType.OUTPUT}', 
          payload: { message: JSON.stringify({ action: 'table', args: [data] }), stepId: __nc_currentStepId } 
        });
      },
      clear: () => {
        self.postMessage({ 
          type: '${ScriptActionType.OUTPUT}', 
          payload: { message: JSON.stringify({ action: 'clear', args: [] }) } 
        });
      },
      inspect: (data) => {
        self.postMessage({ 
          type: '${ScriptActionType.OUTPUT}', 
          payload: { message: JSON.stringify({ action: 'inspect', args: [data] }), stepId: __nc_currentStepId } 
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
          output.text(\`\${e}\`, 'error');
        } finally {
          const doneMessage = { type: '${ScriptActionType.DONE}', payload: undefined };
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
            type: "${ScriptActionType.ACTION}",
            payload: { 
              id,
              action: 'reloadView'
            },
          });
          function handler(event) {
            if (
              event.data.type === "${ScriptActionType.ACTION_COMPLETE}" &&
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
            type: "${ScriptActionType.ACTION}",
            payload: { 
              id,
              action: 'reloadRow',
              rowId 
            },
          });
          function handler(event) {
            if (
              event.data.type === "${ScriptActionType.ACTION_COMPLETE}" &&
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
    ${generateStepAPI()}
    ${generateV3ToV2Converter()}
    ${generateInputMethods()}
    ${generateApiProxy()}
    ${generateViewActions()}
    ${generateRemoteFetch()}
    ${generalHelpers()}
    ${generateBaseModels()}
    ${generateBaseObject()}
    ${custom || ''}
    ${generateSessionApi()}
    ${generateMessageHandler(userCode)}
  `
}
