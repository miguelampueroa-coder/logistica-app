// Verificacion de identidad de prestadores.
//
// Enviazo es abierto: cualquiera se registra y puede llevar encomiendas ajenas.
// Sin un documento detras, la plataforma no sabe a quien le esta entregando los
// paquetes de la gente. Esto cubre el circuito completo: el prestador sube su
// documento, un admin lo revisa, y el estado queda consolidado en users.

import { getSupabaseAdmin } from '../config/database.js';
import { createUploadService } from './upload.service.js';
import { logger } from './logger.js';

export type DocumentType = 'cedula' | 'pasaporte' | 'licencia_conducir';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export const DOCUMENT_TYPES: DocumentType[] = ['cedula', 'pasaporte', 'licencia_conducir'];

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  cedula: 'Cédula de identidad',
  pasaporte: 'Pasaporte',
  licencia_conducir: 'Licencia de conducir',
};

export interface SubmitDocumentInput {
  userId: string;
  documentType: DocumentType;
  documentNumber: string;
  file: Express.Multer.File;
}

const uploadService = createUploadService();

/**
 * El prestador sube su documento. Deja la cuenta en 'pending' hasta que un
 * admin la revise.
 */
export async function submitDocument(input: SubmitDocumentInput): Promise<{ id: string }> {
  const supabase = getSupabaseAdmin();

  // Si ya tiene uno aprobado no hace falta otro; y si hay uno pendiente, subir
  // de nuevo solo genera cola duplicada para el admin.
  const { data: existing } = await supabase
    .from('provider_documents')
    .select('id, status')
    .eq('user_id', input.userId)
    .in('status', ['pending', 'approved'])
    .maybeSingle();

  if (existing?.status === 'approved') {
    throw new Error('Tu identidad ya está verificada');
  }
  if (existing?.status === 'pending') {
    throw new Error('Ya tienes un documento en revisión');
  }

  // El documento va al bucket privado bajo su propia carpeta. Nunca se expone
  // por URL publica: es el dato mas sensible de la plataforma.
  const uploads = await uploadService.processMultipleUploads([input.file], {
    resize: { width: 1600 },
    quality: 85,
    createThumbnail: false,
  });

  const upload = uploads[0];
  if (!upload) {
    throw new Error('No se pudo procesar la imagen del documento');
  }

  const { data, error } = await supabase
    .from('provider_documents')
    .insert({
      user_id: input.userId,
      document_type: input.documentType,
      document_number: input.documentNumber.trim().toUpperCase(),
      storage_path: upload.url,
      mime_type: upload.mimeType,
      file_size: upload.size,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`No se pudo registrar el documento: ${error?.message}`);
  }

  await supabase
    .from('users')
    .update({ verification_status: 'pending' })
    .eq('id', input.userId);

  logger.info({ userId: input.userId, documentId: data.id }, 'Documento de verificacion recibido');

  return { id: data.id };
}

export async function getVerificationStatus(userId: string): Promise<{
  status: VerificationStatus;
  documentType?: DocumentType;
  rejectionReason?: string;
  reviewedAt?: string;
}> {
  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('verification_status')
    .eq('id', userId)
    .single();

  const { data: doc } = await supabase
    .from('provider_documents')
    .select('document_type, status, rejection_reason, reviewed_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    status: (user?.verification_status as VerificationStatus) || 'unverified',
    documentType: doc?.document_type as DocumentType | undefined,
    rejectionReason: doc?.rejection_reason || undefined,
    reviewedAt: doc?.reviewed_at || undefined,
  };
}

/**
 * Cola de revision. La foto del documento se entrega como URL firmada que
 * vence, no como enlace permanente.
 */
export async function listPendingDocuments(limit = 50): Promise<unknown[]> {
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from('provider_documents')
    .select('id, user_id, document_type, document_number, storage_path, created_at, users(name, email, phone)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!data) return [];

  return Promise.all(
    data.map(async (doc) => {
      const { storage_path, ...rest } = doc as Record<string, unknown> & { storage_path: string };
      return {
        ...rest,
        // 5 minutos: lo justo para revisarlo, sin dejar un enlace dando vueltas.
        document_url: await uploadService.getEvidenceViewUrl(storage_path, 300),
      };
    })
  );
}

export async function reviewDocument(
  documentId: string,
  adminId: string,
  decision: 'approved' | 'rejected',
  rejectionReason?: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (decision === 'rejected' && !rejectionReason?.trim()) {
    throw new Error('Un rechazo necesita motivo: el prestador tiene que saber qué corregir');
  }

  const { data: doc } = await supabase
    .from('provider_documents')
    .select('id, user_id, status')
    .eq('id', documentId)
    .single();

  if (!doc) {
    throw new Error('Documento no encontrado');
  }
  if (doc.status !== 'pending') {
    throw new Error('Este documento ya fue revisado');
  }

  const { error } = await supabase
    .from('provider_documents')
    .update({
      status: decision,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: decision === 'rejected' ? rejectionReason?.trim() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('status', 'pending');

  if (error) {
    throw new Error(`No se pudo registrar la revisión: ${error.message}`);
  }

  await supabase
    .from('users')
    .update({ verification_status: decision === 'approved' ? 'verified' : 'rejected' })
    .eq('id', doc.user_id);

  logger.info(
    { documentId, adminId, decision, providerId: doc.user_id },
    'Documento de prestador revisado'
  );
}

/**
 * Si el prestador puede tomar envios.
 *
 * El bloqueo esta detras de REQUIRE_PROVIDER_VERIFICATION y viene APAGADO: si
 * se enciende antes de tener prestadores verificados, no queda nadie que pueda
 * trabajar y el marketplace se queda sin oferta. Se enciende cuando haya una
 * revision funcionando.
 */
export async function canProviderAcceptShipments(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  if (process.env.REQUIRE_PROVIDER_VERIFICATION !== 'true') {
    return { allowed: true };
  }

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('users')
    .select('verification_status')
    .eq('id', userId)
    .single();

  const status = user?.verification_status as VerificationStatus | undefined;

  if (status === 'verified') return { allowed: true };

  const reasons: Record<string, string> = {
    unverified: 'Sube tu documento de identidad para poder tomar envíos',
    pending: 'Tu documento está en revisión. Te avisamos apenas esté listo',
    rejected: 'Tu documento fue rechazado. Revisa el motivo y vuelve a subirlo',
  };

  return { allowed: false, reason: reasons[status || 'unverified'] };
}
