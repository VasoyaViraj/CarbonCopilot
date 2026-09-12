import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { requestContext } from './middleware/requestContext.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

const app = express();

app.disable('x-powered-by');

app.use(requestContext);
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
