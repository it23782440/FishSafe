require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[HTTP] FishSafe backend listening on port ${PORT}`);
    console.log(`[HTTP] Health: http://localhost:${PORT}/api/health`);
  });
}

start();

// Fail loud on unhandled rejections so Render restarts the service.
process.on('unhandledRejection', (err) => {
  console.error('[FATAL] Unhandled rejection:', err);
  process.exit(1);
});
