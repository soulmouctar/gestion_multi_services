/** Plus grand côté d'une photo envoyée : suffisant pour l'agrandir à l'écran. */
const MAX_SIDE = 1600;
const QUALITY = 0.8;

/**
 * Allège une photo avant l'envoi : ramenée à 1600 px et encodée en JPEG.
 * Une photo de téléphone de 5 à 10 Mo part ainsi en quelques centaines de Ko,
 * ce qui la fait passer sous la limite du serveur et sur une connexion lente.
 *
 * Si le navigateur ne sait pas lire l'image, le fichier d'origine est renvoyé tel quel.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    // « from-image » redresse les photos prises téléphone tourné
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  const ratio = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return file;
  }
  // Fond blanc : le JPEG n'a pas de transparence, elle deviendrait noire
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob || blob.size >= file.size) {
    return file;
  }
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}
