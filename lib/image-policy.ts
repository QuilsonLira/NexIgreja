export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_MAX_LABEL = "2 MB";
export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export const IMAGE_TYPE_MESSAGE = "Use uma imagem PNG, JPG, JPEG ou WebP.";
export const IMAGE_SIZE_MESSAGE = `A imagem deve ter no máximo ${IMAGE_MAX_LABEL}.`;

export function frontendImageError(file: { type: string; size: number }): string | null {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type.toLowerCase() as SupportedImageType)) return IMAGE_TYPE_MESSAGE;
  if (file.size <= 0 || file.size > IMAGE_MAX_BYTES) return IMAGE_SIZE_MESSAGE;
  return null;
}

export function detectImageMime(bytes: Uint8Array): SupportedImageType | null {
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function validateImageBytes(bytes: Uint8Array, declaredMime: string): SupportedImageType | null {
  if (bytes.length <= 0 || bytes.length > IMAGE_MAX_BYTES) return null;
  const detected = detectImageMime(bytes);
  const normalizedDeclared = declaredMime.toLowerCase() === "image/jpg" ? "image/jpeg" : declaredMime.toLowerCase();
  return detected && detected === normalizedDeclared ? detected : null;
}

export function resolveEffectiveLogoUrl(logos: {
  branch?: string | null;
  matrix?: string | null;
  convention?: string | null;
}): string | null {
  return logos.branch || logos.matrix || logos.convention || null;
}

export function unitLogoUrl(unitId: number, updatedAt: string | null): string | null {
  return updatedAt ? `/api/media/units/${unitId}/logo?v=${encodeURIComponent(updatedAt)}` : null;
}

export function userPhotoUrl(userId: number, updatedAt: string | null): string | null {
  return updatedAt ? `/api/media/users/${userId}/profile-photo?v=${encodeURIComponent(updatedAt)}` : null;
}

export function profilePresentation(name: string, photoUrl: string | null): { photoUrl: string | null; initial: string } {
  return { photoUrl, initial: name.trim().slice(0, 1).toUpperCase() || "?" };
}

export function cameraFailureMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "A câmera não foi autorizada. Você ainda pode escolher uma imagem do dispositivo.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Nenhuma câmera foi encontrada. Escolha uma imagem do dispositivo.";
  }
  return "Não foi possível abrir a câmera. Escolha uma imagem do dispositivo.";
}
