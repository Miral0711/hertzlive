import cors from 'cors';
import express from 'express';
import { env } from './lib/env';
import { authRouter } from './routes/auth';

export const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRouter);

// Keep this last: catches anything unhandled above and any thrown/rejected error from a route.
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});
