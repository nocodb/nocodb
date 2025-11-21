import jsep from 'nc-jsep';
import template from 'nc-jsep-plugin-template';
import object from 'nc-jsep-plugin-object';
import ternary from 'nc-jsep-plugin-ternary';
import { jsepCurlyHook, jsepIndexHook } from './hooks';

// Formula jsep instance - with curly hook only
export const formulaJsep = jsep.instance();
formulaJsep.defaultConfig();
formulaJsep.plugins.register(jsepCurlyHook);

// Formula jsep instance with position tracking - with curly hook and index hook
export const formulaJsepWithIndex = jsep.instance();
formulaJsepWithIndex.defaultConfig();
formulaJsepWithIndex.plugins.register(jsepCurlyHook, jsepIndexHook);

// Workflow jsep instance - with template, object, ternary plugins
export const workflowJsep = jsep.instance();
workflowJsep.defaultConfig();
workflowJsep.plugins.register(template, object, ternary);
