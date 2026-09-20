const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// --- Security headers ---
app.use(helmet());

// --- CORS: default allowed origins for local dev and production Vercel ---
const defaultOrigins = [
  'http://localhost:3000',
  'https://fish-safe-frontend.vercel.app'
];

const origins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : defaultOrigins;

app.use(
  cors({
    origin: origins.includes('*') ? true : origins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  })
);

// --- Body parsing (small limit; device payloads are tiny) ---
app.use(express.json({ limit: '16kb' }));

// --- Rate limiting (basic abuse protection) ---
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 req/min/IP is plenty for one device + a dashboard
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// --- Routes ---
app.get('/', (req, res) =>
  res.json({ service: 'FishSafe API', docs: '/api/health' })
);
app.use('/api', apiRoutes);

// --- 404 + error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;