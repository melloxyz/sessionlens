import type { FastifyInstance } from 'fastify';
import { getBooleanSetting, setAppSetting } from '../db/settings.js';

const REDACT_KEY = 'privacy.redactSensitiveData';

export function registerPrivacyRoutes(app: FastifyInstance): void {
  app.get('/api/privacy/settings', async () => ({
    redactSensitiveData: getBooleanSetting(REDACT_KEY, false),
  }));

  app.post('/api/privacy/settings', async (req, reply) => {
    const body = req.body as { redactSensitiveData?: unknown };
    if (typeof body?.redactSensitiveData !== 'boolean') {
      return reply.status(400).send({
        error: {
          code: 'INVALID_PRIVACY_SETTING',
          message: 'redactSensitiveData must be a boolean',
        },
      });
    }
    setAppSetting(REDACT_KEY, body.redactSensitiveData ? 'true' : 'false');
    return { redactSensitiveData: getBooleanSetting(REDACT_KEY, false) };
  });
}
