import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';

const PORT = Number(process.env.AIMETER_PORT) || 3030;

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.get('/api/health', async () => ({ status: 'ok' }));

  try {
    await app.listen({ port: PORT, host: '127.0.0.1' });
    console.log(`AIMeter running at http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
