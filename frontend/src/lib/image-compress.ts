// Comprime una imagen subida por el cliente a un data URI JPEG chico, para
// entrar bajo el límite del backend (~100.000 caracteres, ver
// backend/src/deposits/dto/submit-tx-hash.dto.ts). Las fotos de celular sin
// comprimir pesan varios MB — sin este paso, casi cualquier subida rebotaría.
const MAX_DIMENSION = 900;
const MAX_DATA_URI_LENGTH = 95_000; // margen bajo el límite real del backend

export async function compressImageToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen en este navegador');
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Baja calidad progresivamente hasta entrar en el límite de tamaño.
  for (const quality of [0.8, 0.6, 0.4, 0.25]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_DATA_URI_LENGTH) return dataUrl;
  }
  throw new Error('La imagen es demasiado grande incluso comprimida — probá con otra foto');
}
