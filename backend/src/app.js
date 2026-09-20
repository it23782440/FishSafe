const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// --- Security headers ---
app.use(helmet());

// --- CORS: allow localhost and all *.vercel.app deployment URLs ---
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman, server-to-server)
      if (!origin) return callback(null, true);

      // Allow local development and any subdomain under vercel.app
      if (origin.includes('localhost') || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
  })
);

// --- Body parsing ---
app.use(express.json({ limit: '16kb' }));

// --- Rate limiting ---
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// --- Routes ---
app.get('/', (req, res) =>
  res.json({ service: 'FishSafe API', docs: '/api/health' })
);
app.use('/api', apiRoutes);

// --- 404 + error handling ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;