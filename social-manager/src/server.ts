import 'dotenv/config';
import app from './app';
import { behaviorEventsService } from './services/behavior-events.service';

// Subscribe to Redis channel so worker behavior events are forwarded to SSE clients
behaviorEventsService.initSubscriber();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`);
  console.log(`[server] Health check: http://localhost:${PORT}/health`);
});
