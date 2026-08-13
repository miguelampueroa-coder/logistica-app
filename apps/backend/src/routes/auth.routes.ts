import { Router } from 'express';
import { register, login, refresh, registerSchema, loginSchema } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', authenticate, refresh);

export default router;
