export class HttpError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const badRequest = (message, code) => new HttpError(400, message, code);

/** Express 4 does not catch rejected promises; this forwards them to the error handler. */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/** Escapes user input before it is placed inside a RegExp. */
export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Strict 24-hex check. mongoose.isValidObjectId also accepts any 12-character string. */
export const isObjectId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

export const clampInt = (value, min, max, fallback) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message, ...(err.code && { code: err.code }) });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors || {})[0];
    return res.status(400).json({ error: first?.message || 'Invalid input' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid value' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Already exists' });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
