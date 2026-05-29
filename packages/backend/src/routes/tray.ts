import type { FastifyInstance } from 'fastify';
import { getTrayConfig, setTrayEnabled } from '../tray/index.js';
import { setAutoStart } from '../tray/autostart.js';
import { setAppSetting } from '../db/settings.js';

export function registerTrayRoutes(app: FastifyInstance) {
  app.get('/api/tray/status', async () => getTrayConfig());

  app.post('/api/tray/settings', async (req, reply) => {
    const body = req.body as {
      enabled?: boolean;
      autoStart?: boolean;
      startMinimized?: boolean;
    };

    if (typeof body !== 'object' || body === null) {
      return reply.status(400).send({
        error: { code: 'INVALID_BODY', message: 'Request body must be a JSON object' },
      });
    }

    if (typeof body.enabled === 'boolean') {
      setTrayEnabled(body.enabled);
    }

    if (typeof body.autoStart === 'boolean') {
      setAutoStart(body.autoStart);
    }

    if (typeof body.startMinimized === 'boolean') {
      setAppSetting('tray.startMinimized', body.startMinimized ? 'true' : 'false');
    }

    return {
      ...getTrayConfig(),
      message: 'Settings updated. Restart Sessionless for all changes to take effect.',
    };
  });
}
