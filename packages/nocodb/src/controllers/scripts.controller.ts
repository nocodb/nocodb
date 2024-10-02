import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CodeInterpreter } from '@e2b/code-interpreter';
import Sandbox from 'v8-sandbox';
import { Response } from 'express';
import request from 'supertest';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ScriptsController {
  constructor() {}

  @Post(['/api/v2/scripts/exec'])
  async scriptExec(
    @TenantContext() context: NcContext,
    @Body() body,
    @Req() req: NcRequest,
  ) {
    console.log(body);

    const sandbox = new Sandbox();

    const { error, output, value } = await sandbox.execute({
      code: body.code,
      timeout: 1000,
    });

    console.log(value, output, error);

    //  return output;

    const sandboxE2b = await CodeInterpreter.create({
      apiKey: 'e2b_28eedec39c0398d545f5cfa3e2b2332a13d3c4e2',
    });
    const x = await sandboxE2b.notebook.execCell(body.code);

    console.log(x);

    return { x, output };
  }

  @Get(['/api/v2/scripts'])
  async scriptHTML(@Res() res: Response, @Req() req: NcRequest) {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), midi=(), encrypted-media=()',
    );
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    );

    const cspDirectives = [
      "default-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
      `connect-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net http://localhost:8080`,
      "font-src 'self' https://cdnjs.cloudflare.com",
      "worker-src 'self' blob:",
      'child-src blob:',
      "base-uri 'none'",
      "form-action 'none'",
    ];

    // res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

    res.send(
      generateHTML({
        token: req.headers['Xc-Auth'] as string,
        url: 'http://localhost:8080',
      }),
    );
  }
}

const generateHTML = (config: { token: string; url: string }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Secure Script Executor</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.30.1/min/vs/loader.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <style>
      body {
          display: flex;
          flex-direction: column;
          height: 100vh;
          font-family: 'Arial', sans-serif;
      }
      #editor, #output {
          height: calc(100vh - 7rem);
      }
      .console-line {
          padding: 2px 5px;
          border-bottom: 1px solid #e2e8f0;
      }
      .log { color: #2d3748; }
      .error { color: #e53e3e; }
      .warn { color: #d69e2e; }
  </style>
</head>
<body class="bg-gray-100">
<nav class="bg-blue-600 text-white p-4 flex justify-between items-center">
  <h1 class="text-xl font-bold">Secure Script Executor</h1>
  <button onclick="runScript()" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-300 ease-in-out transform hover:scale-105">
    Run Script
  </button>
</nav>
<div class="flex flex-1 overflow-hidden">
  <div id="editor" class="w-1/2 border-r border-gray-300"></div>
  <div class="w-1/2 flex flex-col">
    <div class="bg-gray-200 p-2 font-bold">Console Output</div>
    <div id="output" class="flex-1 overflow-auto bg-white p-2"></div>
  </div>
</div>
<footer class="bg-gray-200 p-2 text-center text-sm text-gray-600">
  Secure Script Executor &copy; 2023
</footer>

<script>
    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.30.1/min/vs' } })
    require(['vs/editor/editor.main'], function () {
      window.editor = monaco.editor.create(document.getElementById('editor'), {
        value: 'console.log("Hello World");',
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
      })
    })

    let scriptWorker;

    function createWorker() {
      const workerCode = \`
        'use strict';
        // Security restrictions
        const restrictedGlobals = ['window', 'document', 'location', 'top', 'parent', 'frames', 'opener'];
        restrictedGlobals.forEach(name => {
          Object.defineProperty(self, name, {
            get: () => {
              throw new ReferenceError(name + ' is not defined');
            },
            configurable: false
          });
        });

        // Restricted access to APIs
        self.XMLHttpRequest = undefined;
        self.fetch = undefined;
        self.WebSocket = undefined;
        self.localStorage = undefined;
        self.sessionStorage = undefined;

        self.console = {
          log: (...args) => self.postMessage({type: 'log', message: args.join(' ')}),
          error: (...args) => self.postMessage({type: 'error', message: args.join(' ')}),
          warn: (...args) => self.postMessage({type: 'warn', message: args.join(' ')})
        };

        // Importing NocoDB SDK in the worker
        import { Api } from 'https://cdn.jsdelivr.net/npm/nocodb-sdk@0.255.2/+esm';

        // Initialize NocoDB SDK in the worker
        const api = new Api({
          baseURL: '${config.url}',
          axiosConfig: {
            headers: {
              'xc-auth': '${config.token}',
            },
          },
        });

        self.onmessage = function(event) {
          const script = event.data.script;
          try {
            eval(script);
          } catch (error) {
            self.console.error(error.toString());
          }
          self.postMessage({type: 'done'});
        };
      \`;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      return new Worker(URL.createObjectURL(blob), { type: 'module' });
    }

    function runScript() {
      const script = window.editor.getValue();
      const output = document.getElementById('output');
      output.innerHTML = '';

      if (scriptWorker) {
        scriptWorker.terminate();
      }

      scriptWorker = createWorker();

      scriptWorker.onmessage = function (event) {
        const { type, message } = event.data;
        if (type === 'done') {
          scriptWorker.terminate();
          scriptWorker = null;
        } else {
          const line = document.createElement('div');
          line.textContent = message;
          line.className = 'console-line ' + type;
          output.appendChild(line);
        }
      };

      scriptWorker.onerror = function (error) {
        const line = document.createElement('div');
        line.textContent = 'Worker error: ' + error.message;
        line.className = 'console-line error';
        output.appendChild(line);
        scriptWorker.terminate();
        scriptWorker = null;
      };

      scriptWorker.postMessage({ script });
    }
  </script>
</body>
</html>
`;
};
