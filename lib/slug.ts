// lib/slug.ts
import { fixEncoding } from './sanitizer';

export function slugify(text: string, fallbackId?: string): string {
  if (!text && fallbackId) return fallbackId;
  if (!text) return 'noticia';

  // 1. Fix encoding and entities
  const decoded = fixEncoding(text);

  // 2. Map ç/Ç to c
  const cConverted = decoded.replace(/ç/g, 'c').replace(/Ç/g, 'c');

  // 3. Remove diacritics (acentos)
  const unaccented = cConverted
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // 4. Transform spaces to -, keep only a-z0-9 and hyphens
  let slug = unaccented
    .replace(/&/g, '-e-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length > 85) {
    slug = slug.substring(0, 85).replace(/-[^-]*$/, '');
  }

  return slug || fallbackId || 'noticia';
}

export function categorySlugify(categoryName: string): string {
  if (!categoryName) return 'todas';

  const decoded = fixEncoding(categoryName);
  const cConverted = decoded.replace(/ç/g, 'c').replace(/Ç/g, 'c');

  return cConverted
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'e')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

