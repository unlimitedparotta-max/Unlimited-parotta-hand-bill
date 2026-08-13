const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function write(file, level, message) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  try { fs.appendFileSync(path.join(LOG_DIR, file), line); } catch (e) { /* best-effort — never crash on a log write failure */ }
}

const logger = {
  info: (message) => { console.log(message); write('app.log', 'INFO', message); },
  warn: (message) => { console.warn(message); write('app.log', 'WARN', message); },
  error: (message) => { console.error(message); write('error.log', 'ERROR', message); }
};

module.exports = logger;
