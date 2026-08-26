// File upload service.
// Handles image uploads for packages, delivery evidence, etc.
// Supports local storage and S3-compatible storage.

import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

export interface UploadConfig {
  maxFileSize: number; // bytes
  allowedMimeTypes: string[];
  storage: 'local' | 's3';
  uploadDir: string;
  thumbnailSize?: number;
}

export interface UploadedFile {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  thumbnailPath?: string;
  thumbnailUrl?: string;
}

export interface FileStorageProvider {
  save(buffer: Buffer, filename: string, mimeType: string): Promise<string>;
  getUrl(path: string): string;
  delete(path: string): Promise<void>;
}

// ─── Storage Providers ──────────────────────────────────────────────

export class LocalStorageProvider implements FileStorageProvider {
  private uploadDir: string;
  private baseUrl: string;

  constructor(uploadDir: string, baseUrl: string) {
    this.uploadDir = uploadDir;
    this.baseUrl = baseUrl;
  }

  async save(buffer: Buffer, filename: string, _mimeType: string): Promise<string> {
    const filePath = path.join(this.uploadDir, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return filename;
  }

  getUrl(filePath: string): string {
    return `${this.baseUrl}/uploads/${filePath}`;
  }

  async delete(filePath: string): Promise<void> {
    const uploadRoot = path.resolve(this.uploadDir);
    const fullPath = path.resolve(uploadRoot, filePath);
    if (fullPath !== uploadRoot && !fullPath.startsWith(uploadRoot + path.sep)) {
      return;
    }
    await fs.unlink(fullPath).catch(() => {});
  }
}

export class S3StorageProvider implements FileStorageProvider {
  private bucket: string;
  private region: string;
  private accessKey: string;
  private secretKey: string;
  private baseUrl: string;

  constructor(config: { bucket: string; region: string; accessKey: string; secretKey: string }) {
    this.bucket = config.bucket;
    this.region = config.region;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.baseUrl = `https://${config.bucket}.s3.${config.region}.amazonaws.com`;
  }

  async save(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    // S3 upload would use @aws-sdk/client-s3 here
    console.log(`[S3] Would upload ${filename} to ${this.bucket}`);
    return filename;
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  async delete(key: string): Promise<void> {
    console.log(`[S3] Would delete ${key}`);
  }
}

// ─── Upload Service ─────────────────────────────────────────────────

export class UploadService {
  private storage: FileStorageProvider;
  private uploadDir: string;
  private baseUrl: string;

  constructor(storage: FileStorageProvider, uploadDir: string, baseUrl: string) {
    this.storage = storage;
    this.uploadDir = uploadDir;
    this.baseUrl = baseUrl;
  }

  /**
   * Get multer middleware for file uploads.
   */
  getMulterMiddleware(
    maxFileSize: number = 10 * 1024 * 1024, // 10MB
    allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  ) {
    const storage = multer.memoryStorage();

    return multer({
      storage,
      limits: { fileSize: maxFileSize },
      fileFilter: (_req, file, cb) => {
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${file.mimetype} not allowed. Use: ${allowedTypes.join(', ')}`));
        }
      },
    });
  }

  /**
   * Process and save an uploaded file.
   */
  async processUpload(
    file: Express.Multer.File,
    options: {
      resize?: { width: number; height?: number };
      quality?: number;
      createThumbnail?: boolean;
      thumbnailSize?: number;
    } = {}
  ): Promise<UploadedFile> {
    const id = uuidv4();
    const ext = this.getExtension(file.originalname);
    const filename = `${id}.${ext}`;
    const thumbnailFilename = options.createThumbnail ? `thumb_${filename}` : undefined;

    // Process image
    let processedBuffer = file.buffer;
    // Solo las imagenes tienen dimensiones; para el resto quedan en 0 (antes
    // width guardaba el tamano del archivo en bytes, que no es un ancho).
    let width = 0;
    let height = 0;

    if (file.mimetype.startsWith('image/')) {
      const image = sharp(file.buffer);
      const metadata = await image.metadata();
      width = metadata.width || 0;
      height = metadata.height || 0;

      if (options.resize) {
        image.resize(options.resize.width, options.resize.height, { fit: 'inside' });
      }

      processedBuffer = await image
        .jpeg({ quality: options.quality || 85 })
        .toBuffer();
    }

    // Save main file
    const savedFilename = await this.storage.save(processedBuffer, filename, file.mimetype);
    const fileUrl = this.storage.getUrl(savedFilename);

    // Create and save thumbnail
    let thumbnailPath: string | undefined;
    let thumbnailUrl: string | undefined;

    if (options.createThumbnail && file.mimetype.startsWith('image/')) {
      const thumbSize = options.thumbnailSize || 200;
      const thumbBuffer = await sharp(file.buffer)
        .resize(thumbSize, thumbSize, { fit: 'cover' })
        .jpeg({ quality: 70 })
        .toBuffer();

      thumbnailPath = await this.storage.save(thumbBuffer, thumbnailFilename!, file.mimetype);
      thumbnailUrl = this.storage.getUrl(thumbnailPath);
    }

    return {
      id,
      originalName: file.originalname,
      filename: savedFilename,
      path: savedFilename,
      url: fileUrl,
      mimeType: file.mimetype,
      size: processedBuffer.length,
      width,
      height,
      thumbnailPath,
      thumbnailUrl,
    };
  }

  /**
   * Process multiple uploads.
   */
  async processMultipleUploads(
    files: Express.Multer.File[],
    options: {
      resize?: { width: number; height?: number };
      quality?: number;
      createThumbnail?: boolean;
      thumbnailSize?: number;
    } = {}
  ): Promise<UploadedFile[]> {
    return Promise.all(files.map(f => this.processUpload(f, options)));
  }

  /**
   * Delete an uploaded file.
   */
  async deleteFile(filePath: string): Promise<void> {
    await this.storage.delete(filePath);
  }

  /**
   * Save delivery evidence photos.
   */
  async saveDeliveryEvidence(
    shipmentId: string,
    files: Express.Multer.File[],
    description?: string
  ): Promise<UploadedFile[]> {
    const uploads = await this.processMultipleUploads(files, {
      resize: { width: 1920 },
      quality: 85,
      createThumbnail: true,
      thumbnailSize: 300,
    });

    // Store references in database
    const { getSupabaseAdmin } = await import('../config/database.js');
    const supabase = getSupabaseAdmin();

    for (const upload of uploads) {
      await supabase.from('delivery_evidence').insert({
        shipment_id: shipmentId,
        file_url: upload.url,
        thumbnail_url: upload.thumbnailUrl,
        original_name: upload.originalName,
        mime_type: upload.mimeType,
        file_size: upload.size,
        width: upload.width,
        height: upload.height,
        description,
      });
    }

    return uploads;
  }

  /**
   * Save package photos.
   */
  async savePackagePhotos(
    packageId: string,
    files: Express.Multer.File[]
  ): Promise<UploadedFile[]> {
    const uploads = await this.processMultipleUploads(files, {
      resize: { width: 1200 },
      quality: 80,
      createThumbnail: true,
      thumbnailSize: 200,
    });

    const { getSupabaseAdmin } = await import('../config/database.js');
    const supabase = getSupabaseAdmin();

    for (const upload of uploads) {
      await supabase.from('package_photos').insert({
        package_id: packageId,
        file_url: upload.url,
        thumbnail_url: upload.thumbnailUrl,
        original_name: upload.originalName,
        mime_type: upload.mimeType,
        file_size: upload.size,
      });
    }

    return uploads;
  }

  private getExtension(filename: string): string {
    return path.extname(filename).toLowerCase().replace('.', '') || 'jpg';
  }
}

/**
 * Factory: creates the appropriate upload service.
 */
export function createUploadService(baseUrl?: string): UploadService {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const serverUrl = baseUrl || process.env.SERVER_URL || 'http://localhost:3000';

  const storage = new LocalStorageProvider(uploadDir, serverUrl);
  return new UploadService(storage, uploadDir, serverUrl);
}
