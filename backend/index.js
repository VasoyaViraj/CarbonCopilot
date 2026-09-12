import { env } from './src/config/env.js';
import app from './src/app.js';
import prisma from './src/db/db.js';

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Database connected successfully.');

    const server = app.listen(env.PORT, () => {
      console.log(`EcoTrace API listening on http://localhost:${env.PORT}/api`);
    });

    const shutdown = async (signal) => {
      console.log(`${signal} received, shutting down.`);
      server.close();
      await prisma.$disconnect();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
