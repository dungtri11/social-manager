import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`);
  console.log(`[server] Health check: http://localhost:${PORT}/health`);
});
