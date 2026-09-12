import { randomUUID } from 'node:crypto';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

/** Assigns a request ID and logs method, path, status, duration and user (no bodies or secrets). */
export const requestContext = (req, res, next) => {
  const incoming = req.get('x-request-id');
  req.id = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  res.set('X-Request-Id', req.id);

  if (process.env.NODE_ENV !== 'test') {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      console.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms req=${req.id} user=${req.user?.id ?? '-'}`
      );
    });
  }
  next();
};
