import { Router } from 'express';
import { authenticateWithStatus as authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getProfile,
  updateProfile,
  addVehicle,
  getMyVehicles,
  getProviderEarnings,
  updateProfileSchema,
  addVehicleSchema,
} from '../controllers/user.controller.js';

const router = Router();

// Rutas de perfil (todos los usuarios autenticados)
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, validate(updateProfileSchema), updateProfile);

// Rutas de vehículos (solo prestadores)
router.post(
  '/vehicles',
  authenticate,
  authorize('provider'),
  validate(addVehicleSchema),
  addVehicle
);
router.get('/vehicles', authenticate, authorize('provider'), getMyVehicles);

// Rutas de ganancias (solo prestadores)
router.get('/earnings', authenticate, authorize('provider'), getProviderEarnings);

export default router;
