import { Router, Request, Response } from 'express';
import { createProxy, getProxies } from '../services/proxy.service';

const router = Router();

// POST /proxies
router.post('/', async (req: Request, res: Response) => {
  const { host, port, username, password } = req.body;

  if (!host || typeof host !== 'string') {
    res.status(400).json({ error: 'host is required' });
    return;
  }
  if (!port || typeof port !== 'number') {
    res.status(400).json({ error: 'port is required and must be a number' });
    return;
  }

  try {
    const proxy = await createProxy({ host, port, username, password });
    res.status(201).json(proxy);
  } catch (err: any) {
    console.error('[proxies] POST error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /proxies
router.get('/', async (_req: Request, res: Response) => {
  try {
    const proxies = await getProxies();
    res.json(proxies);
  } catch (err) {
    console.error('[proxies] GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
