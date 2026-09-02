import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateWithStatus as authenticate, authorize } from '../middleware/auth.js';
import { createUploadService } from '../services/upload.service.js';
import {
  submitDocument,
  getVerificationStatus,
  listPendingDocuments,
  reviewDocument,
  DOCUMENT_TYPES,
  DocumentType,
} from '../services/verification.service.js';
import { logger } from '../services/logger.js';

const router = Router();

// 5 MB alcanza de sobra para la foto de un documento y evita subidas enormes.
const documentUpload = createUploadService().getMulterMiddleware(5 * 1024 * 1024);

const submitSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES as [DocumentType, ...DocumentType[]]),
  document_number: z.string().min(4, 'El número del documento es muy corto').max(50),
});

// POST /api/verification — el prestador sube su documento
router.post(
  '/',
  authenticate,
  authorize('provider'),
  documentUpload.single('document'),
  async (req: Request, res: Response) => {
    try {
      const parsed = submitSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'Falta la foto del documento' });
        return;
      }

      const result = await submitDocument({
        userId: req.user!.userId,
        documentType: parsed.data.document_type,
        documentNumber: parsed.data.document_number,
        file: req.file,
      });

      res.status(201).json({
        message: 'Documento recibido. Te avisamos cuando esté revisado.',
        id: result.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      logger.warn({ err: error, userId: req.user?.userId }, 'Fallo al subir documento');
      res.status(400).json({ error: message });
    }
  }
);

// GET /api/verification/me — el prestador consulta en qué va
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    res.json(await getVerificationStatus(req.user!.userId));
  } catch (error) {
    logger.error({ err: error }, 'Fallo al consultar verificacion');
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/verification/pending — cola de revisión del admin
router.get('/pending', authenticate, authorize('admin'), async (_req: Request, res: Response) => {
  try {
    const documents = await listPendingDocuments();
    res.json({ documents, count: documents.length });
  } catch (error) {
    logger.error({ err: error }, 'Fallo al listar documentos pendientes');
    res.status(500).json({ error: 'Error interno' });
  }
});

const reviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  rejection_reason: z.string().max(500).optional(),
});

// POST /api/verification/:id/review — el admin aprueba o rechaza
router.post('/:id/review', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    await reviewDocument(
      req.params.id,
      req.user!.userId,
      parsed.data.decision,
      parsed.data.rejection_reason
    );

    res.json({ message: parsed.data.decision === 'approved' ? 'Prestador verificado' : 'Documento rechazado' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    res.status(400).json({ error: message });
  }
});

export default router;
