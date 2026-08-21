import { ApiError, administrativeSession, assertTrustedOrigin, database, ensureDatabase } from "@/lib/server/auth";
import { userPhotoUrl } from "@/lib/image-policy";
import {
  IMAGE_MAX_BYTES,
  IMAGE_SIZE_MESSAGE,
  IMAGE_TYPE_MESSAGE,
  validateImageBytes,
  type SupportedImageType,
} from "@/lib/image-policy";

type StoredImage = {
  image_data: ArrayBuffer | Uint8Array;
  mime_type: SupportedImageType;
  byte_size: number;
  updated_at: string;
};

export type ValidatedImageUpload = {
  bytes: Uint8Array;
  mimeType: SupportedImageType;
};

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function readImageUpload(request: Request): Promise<ValidatedImageUpload> {
  assertTrustedOrigin(request);
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > IMAGE_MAX_BYTES) throw new ApiError(413, "IMAGEM_MUITO_GRANDE", IMAGE_SIZE_MESSAGE);

  const declaredMime = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > IMAGE_MAX_BYTES) throw new ApiError(413, "IMAGEM_MUITO_GRANDE", IMAGE_SIZE_MESSAGE);
  const mimeType = validateImageBytes(bytes, declaredMime);
  if (!mimeType) throw new ApiError(415, "IMAGEM_INVALIDA", IMAGE_TYPE_MESSAGE);
  return { bytes, mimeType };
}

export async function saveUnitLogo(unitId: number, upload: ValidatedImageUpload): Promise<string> {
  const updatedAt = new Date().toISOString();
  await database().prepare(
    "INSERT INTO unit_logos (unit_id, image_data, mime_type, byte_size, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(unit_id) DO UPDATE SET image_data = excluded.image_data, mime_type = excluded.mime_type, byte_size = excluded.byte_size, updated_at = excluded.updated_at",
  ).bind(unitId, asArrayBuffer(upload.bytes), upload.mimeType, upload.bytes.byteLength, updatedAt).run();
  return updatedAt;
}

export async function removeUnitLogo(unitId: number): Promise<void> {
  await database().prepare("DELETE FROM unit_logos WHERE unit_id = ?").bind(unitId).run();
}

export async function saveUserPhoto(userId: number, upload: ValidatedImageUpload): Promise<string> {
  const updatedAt = new Date().toISOString();
  await database().prepare(
    "INSERT INTO user_profile_photos (user_id, image_data, mime_type, byte_size, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET image_data = excluded.image_data, mime_type = excluded.mime_type, byte_size = excluded.byte_size, updated_at = excluded.updated_at",
  ).bind(userId, asArrayBuffer(upload.bytes), upload.mimeType, upload.bytes.byteLength, updatedAt).run();
  return updatedAt;
}

export async function removeUserPhoto(userId: number): Promise<void> {
  await database().prepare("DELETE FROM user_profile_photos WHERE user_id = ?").bind(userId).run();
}

export async function updateOwnProfilePhoto(
  request: Request,
  upload: ValidatedImageUpload | null | (() => Promise<ValidatedImageUpload>),
): Promise<string | null> {
  assertTrustedOrigin(request);
  const session = await administrativeSession(request);
  const resolvedUpload = typeof upload === "function" ? await upload() : upload;
  const updatedAt = resolvedUpload ? await saveUserPhoto(session.user.id, resolvedUpload) : (await removeUserPhoto(session.user.id), null);
  await database().prepare("INSERT INTO audit_logs (user_id, tenant_id, event, reason, created_at) VALUES (?, ?, 'FOTO_PERFIL', ?, ?)")
    .bind(session.user.id, session.user.tenantId, resolvedUpload ? "ATUALIZADA_PELO_USUARIO" : "REMOVIDA_PELO_USUARIO", new Date().toISOString()).run();
  return userPhotoUrl(session.user.id, updatedAt);
}

export async function unitLogo(unitId: number): Promise<StoredImage | null> {
  return database().prepare("SELECT image_data, mime_type, byte_size, updated_at FROM unit_logos WHERE unit_id = ? LIMIT 1")
    .bind(unitId).first<StoredImage>();
}

export async function userPhoto(userId: number): Promise<StoredImage | null> {
  return database().prepare("SELECT image_data, mime_type, byte_size, updated_at FROM user_profile_photos WHERE user_id = ? LIMIT 1")
    .bind(userId).first<StoredImage>();
}

export async function publicConventionLogo(tenantId: number): Promise<StoredImage | null> {
  await ensureDatabase();
  return database().prepare(
    "SELECT logo.image_data, logo.mime_type, logo.byte_size, logo.updated_at FROM unit_logos logo JOIN organizational_units unit ON unit.id = logo.unit_id JOIN tenants tenant ON tenant.id = unit.tenant_id WHERE unit.tenant_id = ? AND unit.type = 'CONVENCAO' AND unit.status = 'ATIVO' AND unit.archived_at IS NULL AND tenant.status = 'ATIVO' ORDER BY unit.id LIMIT 1",
  ).bind(tenantId).first<StoredImage>();
}

export function storedImageResponse(image: StoredImage | null, cacheControl = "private, max-age=300"): Response {
  if (!image) throw new ApiError(404, "IMAGEM_NAO_ENCONTRADA", "Imagem não encontrada.");
  const data = image.image_data instanceof Uint8Array ? image.image_data : new Uint8Array(image.image_data);
  return new Response(data as BodyInit, {
    headers: {
      "Content-Type": image.mime_type,
      "Content-Length": String(image.byte_size),
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
      ETag: `\"${image.updated_at}\"`,
    },
  });
}
