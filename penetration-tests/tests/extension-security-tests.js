/**
 * Extension security penetration tests (static analysis).
 * Scans the Chrome extension source for secrets, dangerous patterns, and misconfigurations.
 * Safe: read-only file system, no execution of extension code.
 */

import fs from 'fs';
import path from 'path';

const EXTENSION_DIR = path.resolve(process.cwd(), process.env.EXTENSION_PATH || path.join('..', 'extension'));

export class ExtensionSecurityTests {
  constructor() {
    this.results = [];
    this.extensionPath = EXTENSION_DIR;
  }

  async runAllTests() {
    console.log('🔒 Starting Extension Security Penetration Tests...\n');
    console.log(`Extension path: ${this.extensionPath}\n`);

    if (!fs.existsSync(this.extensionPath)) {
      this.results.push({
        name: 'Extension directory exists',
        severity: 'HIGH',
        passed: false,
        details: { error: `Extension path not found: ${this.extensionPath}`, note: 'Set EXTENSION_PATH env var if needed' }
      });
      return this.results;
    }

    await this.testNoHardcodedSecrets();
    await this.testNoDangerousDynamicCode();
    await this.testPostMessageOriginCheck();
    await this.testNoUnsafeDOM();
    await this.testManifestPermissions();
    await this.testStorageUsage();
    await this.testScriptInjection();
    await this.testMultiScanUrlValidation();
    await this.testContentScriptMessageValidation();
    await this.testNoSensitiveDataInExtension();

    return this.results;
  }

  readExtensionFiles(ext, opts = {}) {
    const exclude = opts.exclude || []; // e.g. ['axe.min.js'] for third-party
    const files = [];
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) {
          walk(full);
        } else if (e.isFile() && ext.some((s) => e.name.endsWith(s))) {
          if (exclude.some((x) => e.name === x || e.name.endsWith(x))) continue;
          files.push(full);
        }
      }
    };
    walk(this.extensionPath);
    return files;
  }

  readFileContent(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return '';
    }
  }

  addResult(name, passed, severity, details = {}) {
    this.results.push({ name, passed, severity, details });
  }

  async testNoHardcodedSecrets() {
    console.log('📋 Checking for hardcoded secrets...');
    const files = this.readExtensionFiles(['.js', '.html', '.json']);
    const secretPatterns = [
      { pattern: /sk-[a-zA-Z0-9]{20,}/, name: 'OpenAI-style API key' },
      { pattern: /Bearer\s+[a-zA-Z0-9_-]{20,}/, name: 'Bearer token' },
      { pattern: /ANTHROPIC_API_KEY\s*=\s*['"][^'"]+['"]/, name: 'Anthropic API key' },
      { pattern: /OPENAI_API_KEY\s*=\s*['"][^'"]+['"]/, name: 'OpenAI API key' },
      { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]{20,}['"]/i, name: 'API key assignment' },
      { pattern: /secret\s*[:=]\s*['"][^'"]{10,}['"]/i, name: 'Secret assignment' },
      { pattern: /password\s*[:=]\s*['"][^'"]+['"]/i, name: 'Password in code' },
      { pattern: /xox[baprs]-[a-zA-Z0-9-]{10,}/, name: 'Slack token' }
    ];
    let found = [];
    for (const filePath of files) {
      const content = this.readFileContent(filePath);
      const rel = path.relative(this.extensionPath, filePath);
      for (const { pattern, name } of secretPatterns) {
        if (pattern.test(content)) {
          found.push({ file: rel, pattern: name });
        }
      }
    }
    this.addResult(
      'No hardcoded API keys or secrets in extension',
      found.length === 0,
      found.length > 0 ? 'CRITICAL' : 'INFO',
      { found: found.length, details: found }
    );
  }

  async testNoDangerousDynamicCode() {
    console.log('📋 Checking for eval / dynamic code execution...');
    const files = this.readExtensionFiles(['.js'], { exclude: ['axe.min.js'] });
    const dangerous = [
      { pattern: /\beval\s*\(/, name: 'eval()' },
      { pattern: /new\s+Function\s*\(/, name: 'new Function()' },
      { pattern: /setTimeout\s*\(\s*['"`]/, name: 'setTimeout with string' },
      { pattern: /setInterval\s*\(\s*['"`]/, name: 'setInterval with string' }
    ];
    let found = [];
    for (const filePath of files) {
      const content = this.readFileContent(filePath);
      const rel = path.relative(this.extensionPath, filePath);
      for (const { pattern, name } of dangerous) {
        if (pattern.test(content)) {
          found.push({ file: rel, pattern: name });
        }
      }
    }
    this.addResult(
      'No eval or dangerous dynamic code in extension',
      found.length === 0,
      found.length > 0 ? 'HIGH' : 'INFO',
      { found: found.length, details: found }
    );
  }

  async testPostMessageOriginCheck() {
    console.log('📋 Checking postMessage origin/source validation...');
    const files = this.readExtensionFiles(['.js'], { exclude: ['axe.min.js'] });
    let hasMessageListener = false;
    let hasSourceCheck = false;
    for (const filePath of files) {
      const content = this.readFileContent(filePath);
      if (/addEventListener\s*\(\s*['"]message['"]/.test(content) || /on\s*\(\s*['"]message['"]/.test(content)) {
        hasMessageListener = true;
        if (
          /event\.source\s*===?\s*iframe\.contentWindow|event\.origin\s*===?/.test(content) ||
          /event\.source\s*!==?\s*iframe\.contentWindow/.test(content)
        ) {
          hasSourceCheck = true;
        }
      }
    }
    const passed = !hasMessageListener || hasSourceCheck;
    this.addResult(
      'postMessage listener validates event.source or origin',
      passed,
      passed ? 'INFO' : 'HIGH',
      { hasMessageListener, hasSourceCheck, note: 'Sidepanel must verify event.source === iframe.contentWindow' }
    );
  }

  async testNoUnsafeDOM() {
    console.log('📋 Checking for unsafe DOM usage...');
    const files = this.readExtensionFiles(['.js', '.html']);
    let innerHTML = false;
    let documentWrite = false;
    for (const filePath of files) {
      const content = this.readFileContent(filePath);
      if (/\.innerHTML\s*=/.test(content)) innerHTML = true;
      if (/document\.write\s*\(/.test(content)) documentWrite = true;
    }
    const passed = !documentWrite;
    this.addResult(
      'No document.write; innerHTML usage reviewed',
      passed,
      documentWrite ? 'HIGH' : innerHTML ? 'LOW' : 'INFO',
      { innerHTML, documentWrite }
    );
  }

  async testManifestPermissions() {
    console.log('📋 Checking manifest permissions...');
    const manifestPath = path.join(this.extensionPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      this.addResult('Manifest exists', false, 'HIGH', { error: 'manifest.json not found' });
      return;
    }
    const content = this.readFileContent(manifestPath);
    let manifest;
    try {
      manifest = JSON.parse(content);
    } catch (e) {
      this.addResult('Manifest valid JSON', false, 'HIGH', { error: String(e.message) });
      return;
    }
    const permissions = manifest.permissions || [];
    const hostPerms = manifest.host_permissions || [];
    const dangerous = ['debugger', 'tabs', 'proxy', 'webRequestBlocking', 'nativeMessaging', 'management'];
    const foundDangerous = permissions.filter((p) => dangerous.includes(p));
    const hasAllUrls = hostPerms.some((p) => p === '<all_urls>' || p === '*');
    const passed = foundDangerous.length === 0;
    this.addResult(
      'Manifest permissions minimal and not dangerous',
      passed,
      foundDangerous.length > 0 ? 'MEDIUM' : 'INFO',
      { permissions, host_permissions: hostPerms, dangerousFound: foundDangerous, hasAllUrls, note: 'activeTab + scripting + sidePanel + storage are expected' }
    );
  }

  async testStorageUsage() {
    console.log('📋 Checking chrome.storage usage...');
    const files = this.readExtensionFiles(['.js']);
    let storesSensitive = false;
    const sensitiveKeys = ['password', 'apiKey', 'api_key', 'secret', 'token', 'accessToken', 'refreshToken', 'credential'];
    for (const filePath of files) {
      const content = this.readFileContent(filePath);
      if (/chrome\.storage\.(local|sync)\.set/.test(content)) {
        for (const key of sensitiveKeys) {
          if (new RegExp(`['"\`]${key}['"\`]\\s*:`).test(content) || new RegExp(`${key}\\s*:`).test(content)) {
            storesSensitive = true;
            break;
          }
        }
      }
    }
    this.addResult(
      'Extension does not store credentials in chrome.storage',
      !storesSensitive,
      storesSensitive ? 'HIGH' : 'INFO',
      { note: 'Storing only accessScanAppUrl (app URL) is acceptable' }
    );
  }

  async testScriptInjection() {
    console.log('📋 Checking script injection sources...');
    const files = this.readExtensionFiles(['.js']);
    let injectsRemote = false;
    for (const filePath of files) {
      const content = this.readFileContent(filePath);
      if (/executeScript\s*\(\s*\{[^}]*files:\s*\[/.test(content)) {
        if (/https?:\/\//.test(content) && /executeScript|scripting/.test(content)) {
          injectsRemote = true;
        }
      }
    }
    this.addResult(
      'Script injection uses extension files only (no remote URLs)',
      !injectsRemote,
      injectsRemote ? 'HIGH' : 'INFO',
      { note: 'background.js should inject only axe.min.js and content-*.js from extension' }
    );
  }

  async testMultiScanUrlValidation() {
    console.log('📋 Checking RUN_MULTI_SCAN URL validation...');
    const bgPath = path.join(this.extensionPath, 'background.js');
    if (!fs.existsSync(bgPath)) {
      this.addResult('RUN_MULTI_SCAN URL validation', false, 'MEDIUM', { error: 'background.js not found' });
      return;
    }
    const content = this.readFileContent(bgPath);
    const hasFilter = /msg\.urls\s*[^)]*\.filter\s*\([^)]*https?/.test(content) || /urls\.filter/.test(content);
    const hasProtocolCheck = /https?:\/\//.test(content) && content.includes('RUN_MULTI_SCAN');
    this.addResult(
      'RUN_MULTI_SCAN validates URLs (protocol filter)',
      hasFilter || hasProtocolCheck,
      hasFilter ? 'INFO' : 'MEDIUM',
      { hasFilter, hasProtocolCheck }
    );
  }

  async testContentScriptMessageValidation() {
    console.log('📋 Checking content script message validation...');
    const files = this.readExtensionFiles(['.js']);
    const contentScripts = files.filter((p) => path.basename(p).startsWith('content-'));
    let validateType = false;
    for (const filePath of contentScripts) {
      const content = this.readFileContent(filePath);
      if (/msg\.type\s*===?\s*['"]RUN_SCAN['"]/.test(content) || /msg\.type\s*===?\s*['"]GET_LINKS['"]/.test(content)) {
        validateType = true;
        break;
      }
    }
    this.addResult(
      'Content scripts validate message type before acting',
      contentScripts.length === 0 || validateType,
      validateType ? 'INFO' : 'MEDIUM',
      { contentScripts: contentScripts.map((p) => path.basename(p)), validateType }
    );
  }

  async testNoSensitiveDataInExtension() {
    console.log('📋 Checking for sensitive data patterns...');
    const files = this.readExtensionFiles(['.js', '.html', '.json']);
    const sensitive = [
      { pattern: /process\.env\.|CRON_SECRET|SUGGESTION_LEARNING_JOB_SECRET/, name: 'Cron/backend secret or process.env' },
      { pattern: /DATABASE_URL|POSTGRES|PGPASSWORD/, name: 'Database URL' },
      { pattern: /RAPIDAPI_PROXY_SECRET/, name: 'RapidAPI secret' },
      { pattern: /NEXTAUTH_SECRET/, name: 'NextAuth secret' }
    ];
    let found = [];
    for (const filePath of files) {
      const content = this.readFileContent(filePath);
      const rel = path.relative(this.extensionPath, filePath);
      for (const { pattern, name } of sensitive) {
        if (pattern.test(content)) {
          found.push({ file: rel, pattern: name });
        }
      }
    }
    this.addResult(
      'No backend/env secrets referenced in extension',
      found.length === 0,
      found.length > 0 ? 'CRITICAL' : 'INFO',
      { found: found.length, details: found }
    );
  }
}
