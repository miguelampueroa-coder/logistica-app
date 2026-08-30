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
  /**
   * URL temporal para un archivo privado. Solo la implementan los proveedores
   * con bucket privado; el almacenamiento local no la tiene porque sirve los
   * archivos por ruta publica.
   */
  getSignedUrl?(path: string, expiresInSeconds: number): Promise<string | null>;
  /** true si los archivos NO son accesibles sin firma. */
  readonly isPrivate?: boolean;
}

function isValidLatitude(v?: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
}

function isValidLongitude(v?: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;
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

/**
 * Almacenamiento en Supabase Storage con bucket privado.
 *
 * Es el unico proveedor apto para produccion. LocalStorageProvider guarda en el
 * disco del servidor, que en Vercel se borra en cada despliegue -- las fotos se
 * perderian solas -- y ademas las sirve por URL publica permanente, sin sesion.
 *
 * Aca el bucket es privado: lo que se guarda en la base es la ruta, y para
 * verla hay que pedir una URL firmada que vence. Asi la autorizacion se decide
 * en cada lectura y no queda un enlace eterno dando vueltas.
 */
export class SupabaseStorageProvider implements FileStorageProvider {
  readonly isPrivate = true;
  private bucket: string;

  constructor(bucket: string) {
    this.bucket = bucket;
  }

  async save(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const { getSupabaseAdmin } = await import('../config/database.js');
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.storage.from(this.bucket).upload(filename, buffer, {
      contentType: mimeType,
      upsert: false,
    });

    if (error) {
      throw new Error(`No se pudo guardar el archivo: ${error.message}`);
    }

    return filename;
  }

  // El bucket es privado, asi que no hay URL publica. Se devuelve la ruta, que
  // es lo que se guarda en la base; para mostrarla hay que firmarla.
  getUrl(filePath: string): string {
    return filePath;
  }

  async getSignedUrl(filePath: string, expiresInSeconds: number): Promise<string | null> {
    const { getSupabaseAdmin } = await import('../config/database.js');
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.storage
      .from(this.bucket)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data) return null;
    return data.signedUrl;
  }

  async delete(filePath: string): Promise<void> {
    const { getSupabaseAdmin } = await import('../config/database.js');
    const supabase = getSupabaseAdmin();
    await supabase.storage.from(this.bucket).remove([filePath]);
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
    options: {
      description?: string;
      evidenceType?: 'pickup' | 'delivery' | 'incident';
      uploadedBy?: string;
      capturedLat?: number;
      capturedLng?: number;
      receiverName?: string;
    } = {}
  ): Promise<UploadedFile[]> {
    const uploads = await this.processMultipleUploads(files, {
      resize: { width: 1920 },
      quality: 85,
      createThumbnail: true,
      thumbnailSize: 300,
    });

    const { getSupabaseAdmin } = await import('../config/database.js');
    const supabase = getSupabaseAdmin();

    // Coordenadas validas o nada: un dato de ubicacion inventado en una prueba
    // de entrega es peor que no tenerlo.
    const lat = isValidLatitude(options.capturedLat) ? options.capturedLat : null;
    const lng = isValidLongitude(options.capturedLng) ? options.capturedLng : null;

    for (const upload of uploads) {
      const { error } = await supabase.from('delivery_evidence').insert({
        shipment_id: shipmentId,
        // Con bucket privado, url es la ruta. Se guarda en storage_path para
        // firmarla al leer, y file_url queda por compatibilidad.
        storage_path: upload.url,
        file_url: upload.url,
        thumbnail_url: upload.thumbnailUrl,
        original_name: upload.originalName,
        mime_type: upload.mimeType,
        file_size: upload.size,
        width: upload.width,
        height: upload.height,
        description: options.description,
        evidence_type: options.evidenceType || 'delivery',
        uploaded_by: options.uploadedBy,
        captured_lat: lat,
        captured_lng: lng,
        captured_at: new Date().toISOString(),
        receiver_name: options.receiverName,
      });

      // Si la fila no se guarda, el archivo esta subido pero la evidencia no
      // existe para el sistema. Hay que fallar, no seguir en silencio.
      if (error) {
        throw new Error(`No se pudo registrar la evidencia: ${error.message}`);
      }
    }

    return uploads;
  }

  /**
   * URL temporal para ver una evidencia guardada en bucket privado.
   * Devuelve null si el proveedor no firma (disco local en desarrollo).
   */
  async getEvidenceViewUrl(storagePath: string, expiresInSeconds = 300): Promise<string | null> {
    if (!this.storage.getSignedUrl) return null;
    return this.storage.getSignedUrl(storagePath, expiresInSeconds);
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
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;

  if (bucket) {
    console.log(`[Upload] Usando Supabase Storage (bucket privado: ${bucket})`);
    return new UploadService(new SupabaseStorageProvider(bucket), uploadDir, serverUrl);
  }

  // El disco local sirve para desarrollo. En produccion no: Vercel lo borra en
  // cada despliegue y las evidencias quedarian con URL publica permanente.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[Upload] Falta SUPABASE_STORAGE_BUCKET. En produccion no se puede usar el disco local: ' +
      'se borra en cada despliegue y expone las evidencias por URL publica.'
    );
  }

  console.log('[Upload] Usando disco local (solo desarrollo)');
  return new UploadService(new LocalStorageProvider(uploadDir, serverUrl), uploadDir, serverUrl);
}
