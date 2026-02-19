// server/src/middleware/cookie-parser.js

import cookieParser from 'cookie-parser';

/**
 * Cookie parser middleware.
 *
 * Required for:
 * - Supabase SSR auth (marketing site uses httpOnly cookies)
 * - CSRF token validation on cookie-based endpoints
 * - Wizard resume token (set as httpOnly cookie as fallback)
 */
export const cookieParserMiddleware = cookieParser();
