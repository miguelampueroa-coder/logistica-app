import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createUploadService } from '../services/upload.service.js';

const router = Router();
const uploadService = createUploadService();
const upload = uploadService.getMulterMiddleware();

// POST /api/uploads/package/:packageId — Upload package photos
router.post(
  '/package/:packageId',
  authenticate,
  upload.array('photos', 5),
  async (req: Request, res: Response) => {
    try {
      const { packageId } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'At least one photo is required' });
        return;
      }

      const uploads = await uploadService.savePackagePhotos(packageId, files);

      res.status(201).json({
        message: `${uploads.length} photo(s) uploaded`,
        files: uploads.map(u => ({
          id: u.id,
          url: u.url,
          thumbnailUrl: u.thumbnailUrl,
          width: u.width,
          height: u.height,
        })),
      });
    } catch (error) {
      console.error('[Upload] Package photos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/uploads/delivery/:shipmentId — Upload delivery evidence
router.post(
  '/delivery/:shipmentId',
  authenticate,
  upload.array('photos', 10),
  async (req: Request, res: Response) => {
    try {
      const { shipmentId } = req.params;
      const { description } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'At least one photo is required' });
        return;
      }

      const uploads = await uploadService.saveDeliveryEvidence(shipmentId, files, description);

      res.status(201).json({
        message: `${uploads.length} evidence photo(s) uploaded`,
        files: uploads.map(u => ({
          id: u.id,
          url: u.url,
          thumbnailUrl: u.thumbnailUrl,
          width: u.width,
          height: u.height,
        })),
      });
    } catch (error) {
      console.error('[Upload] Delivery evidence error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/uploads/general — Upload general files
router.post(
  '/general',
  authenticate,
  upload.array('files', 5),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'At least one file is required' });
        return;
      }

      const uploads = await uploadService.processMultipleUploads(files, {
        resize: { width: 1920 },
        quality: 85,
        createThumbnail: true,
      });

      res.status(201).json({
        message: `${uploads.length} file(s) uploaded`,
        files: uploads.map(u => ({
          id: u.id,
          url: u.url,
          thumbnailUrl: u.thumbnailUrl,
          width: u.width,
          height: u.height,
          size: u.size,
        })),
      });
    } catch (error) {
      console.error('[Upload] General upload error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/uploads/:filename — Delete uploaded file
router.delete('/:filename', authenticate, async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    await uploadService.deleteFile(filename);
    res.json({ message: 'File deleted' });
  } catch (error) {
    console.error('[Upload] Delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
