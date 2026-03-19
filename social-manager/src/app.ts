import express, { Application } from 'express';
import cors from 'cors';
import path from 'path';
import healthRouter from './routes/health';
import accountsRouter from './routes/accounts';
import proxiesRouter from './routes/proxies';
import automationRouter from './routes/automation';
import jobsRouter from './routes/jobs';
import batchRouter from './routes/batch';
import behaviorRouter from './routes/behavior';
import contentRouter from './routes/content';
import fingerprintRouter from './routes/fingerprint';
import riskRouter from './routes/risk';
import identityRouter from './routes/identity';

const app: Application = express();

// Enable CORS for UI
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// API Routes
app.use('/health', healthRouter);
app.use('/accounts', accountsRouter);
app.use('/proxies', proxiesRouter);
app.use('/automation', automationRouter);
app.use('/jobs', jobsRouter);
app.use('/batch', batchRouter);
app.use('/behavior', behaviorRouter);
app.use('/content', contentRouter);
app.use('/fingerprint', fingerprintRouter);
app.use('/risk', riskRouter);
app.use('/identity', identityRouter);

// Serve static UI files in production
if (process.env.NODE_ENV === 'production') {
  const uiPath = path.join(__dirname, '..', 'ui', 'dist');
  app.use(express.static(uiPath));

  // Serve index.html for all non-API routes (SPA support)
  app.get('*', (req, res) => {
    res.sendFile(path.join(uiPath, 'index.html'));
  });
}

export default app;
