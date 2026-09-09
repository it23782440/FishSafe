const mongoose = require('mongoose');

/**
 * Connect to MongoDB. Called once at startup from server.js.
 * The URI comes from the MONGODB_URI env var (never hard-coded).
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[DB] MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('[DB] MongoDB connected');
  } catch (err) {
    console.error('[DB] Connection error:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () =>
    console.warn('[DB] MongoDB disconnected')
  );
  mongoose.connection.on('reconnected', () =>
    console.log('[DB] MongoDB reconnected')
  );
}

module.exports = connectDB;
