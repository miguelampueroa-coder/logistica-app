// Backwards-compatible re-export from the new centralized auth middleware
// All authentication now uses the v2 implementation with caching + status validation
export { authenticate, authenticateWithStatus, authorize, generateToken, verifyToken } from './auth-v2.js';
