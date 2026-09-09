/*
 * Tiny logger wrapper. Kept minimal on purpose so the project has no extra
 * logging dependency. Swap for pino/winston later if you need structured logs.
 */
const ts = () => new Date().toISOString();

module.exports = {
  info: (...a) => console.log(`[${ts()}] [INFO]`, ...a),
  warn: (...a) => console.warn(`[${ts()}] [WARN]`, ...a),
  error: (...a) => console.error(`[${ts()}] [ERROR]`, ...a),
};
