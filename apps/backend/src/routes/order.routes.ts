import { Router } from 'express';
import { authenticateWithStatus as authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createShipment,
  getAvailableShipments,
  acceptShipment,
  pickupShipment,
  deliverShipment,
  getMyShipments,
  getShipmentById,
  cancelShipment,
  createShipmentSchema,
} from '../controllers/order.controller.js';
import { createUploadService } from '../services/upload.service.js';

const deliveryPhotoUpload = createUploadService().getMulterMiddleware();

const router = Router();

// Rutas para clientes
router.post(
  '/',
  authenticate,
  authorize('client'),
  validate(createShipmentSchema),
  createShipment
);

router.get('/', authenticate, getMyShipments);
router.get('/:id', authenticate, getShipmentById);

// Rutas para prestadores
router.get(
  '/available',
  authenticate,
  authorize('provider'),
  getAvailableShipments
);

router.post(
  '/:id/accept',
  authenticate,
  authorize('provider'),
  acceptShipment
);

router.post(
  '/:id/pickup',
  authenticate,
  authorize('provider'),
  pickupShipment
);

// La entrega llega como multipart: la foto del paquete entregado es parte de
// la operacion, no una subida aparte que despues nadie hace.
router.post(
  '/:id/deliver',
  authenticate,
  authorize('provider'),
  deliveryPhotoUpload.single('photo'),
  deliverShipment
);

router.post('/:id/cancel', authenticate, cancelShipment);

export default router;
