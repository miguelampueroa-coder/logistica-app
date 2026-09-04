import { Router } from 'express';
import {
  register,
  login,
  refresh,
  forgotPassword,
  resetPassword,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', authenticate, refresh);

// Sin autenticar a proposito: el que las usa es justamente quien no puede
// entrar. Quedan bajo el limitador de /api/auth, que ya frena los intentos
// repetidos desde una misma IP.
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

export default router;
