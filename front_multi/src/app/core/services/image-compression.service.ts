import { Injectable } from '@angular/core';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const DEFAULTS: Required<CompressionOptions> = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.82,
};

const AVATAR_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 400,
  maxHeight: 400,
  quality: 0.85,
};

@Injectable({ providedIn: 'root' })
export class ImageCompressionService {

  compress(file: File, options: CompressionOptions = {}): Promise<File> {
    if (!file.type.startsWith('image/')) return Promise.resolve(file);

    const { maxWidth, maxHeight, quality } = { ...DEFAULTS, ...options };

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) { resolve(file); return; }
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
          },
          'image/jpeg',
          quality,
        );
      };

      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  compressAvatar(file: File): Promise<File> {
    return this.compress(file, AVATAR_OPTIONS);
  }

  compressAll(files: File[], options: CompressionOptions = {}): Promise<File[]> {
    return Promise.all(files.map(f => this.compress(f, options)));
  }
}
