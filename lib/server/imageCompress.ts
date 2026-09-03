import sharp from 'sharp';

/**
 * Resizes (never upscales) and re-encodes an uploaded image as WebP. Used for
 * new upload paths that need to stay small over slow mobile connections —
 * existing upload paths that already produce a small fixed-size JPEG via
 * client-side canvas crop are left alone.
 */
export async function compressToWebp(
  input: ArrayBuffer,
  opts: { maxWidth: number; maxHeight: number; quality?: number },
): Promise<Buffer> {
  return sharp(Buffer.from(input))
    .resize({ width: opts.maxWidth, height: opts.maxHeight, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: opts.quality ?? 82 })
    .toBuffer();
}
