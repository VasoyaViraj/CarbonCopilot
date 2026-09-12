import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import routes from './routes/index.js';
import circularRoutes from './routes/circular.routes.js';
import { requestContext } from './middleware/requestContext.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { apiRateLimit, securityHeaders } from './middleware/security.middleware.js';

const app = express();

app.disable('x-powered-by');
// Behind a reverse proxy / PaaS load balancer, trust that many hops of X-Forwarded-For so
// rate limits key on the real client IP instead of the proxy's.
if (env.TRUST_PROXY_HOPS > 0) app.set('trust proxy', env.TRUST_PROXY_HOPS);

app.use(requestContext);
app.use(securityHeaders);
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  })
);
// Before body parsing, so floods are rejected without reading request bodies.
app.use('/api', apiRateLimit);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api', routes);
app.use('/api/circular', circularRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
