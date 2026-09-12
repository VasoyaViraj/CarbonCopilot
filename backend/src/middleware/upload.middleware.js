import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

// Browsers and operating systems report CSV files under several MIME types; the extension
// check is the primary gate and the parser rejects anything that is not text.
const CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'text/x-csv',
  'application/vnd.ms-excel',
  'text/plain',
  'application/octet-stream',
]);

const csvUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024, files: 1, fields: 10, fieldSize: 1024 },
  fileFilter: (req, file, cb) => {
    if (!/\.csv$/i.test(file.originalname) || !CSV_MIME_TYPES.has(file.mimetype)) {
      return cb(ApiError.badRequest('Only .csv files are accepted', [{ field: file.fieldname, message: 'Must be a .csv file' }]));
    }
    cb(null, true);
  },
});

/** Accepts exactly one CSV file in `field` (memory storage, size-limited) and maps upload errors to the API contract. */
export const csvUpload =
  (field = 'file') =>
  (req, res, next) => {
    csvUploader.single(field)(req, res, (error) => {
      if (!error) {
        if (!req.file) return next(ApiError.badRequest('A CSV file is required', [{ field, message: 'Attach a .csv file' }]));
        return next();
      }
      if (error instanceof ApiError) return next(error);
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return next(new ApiError(413, 'PAYLOAD_TOO_LARGE', `The file exceeds the ${env.MAX_UPLOAD_SIZE_MB} MB upload limit`));
        }
        return next(ApiError.badRequest('Invalid upload', [{ field: error.field ?? field, message: error.message }]));
      }
      next(error);
    });
  };
