// lib/slug.ts

export function slugify(text: string, fallbackId?: string): string {
  if (!text && fallbackId) return fallbackId;
  if (!text) return 'noticia';

  let slug = text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/&/g, '-e-')
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with -
    .replace(/^-+|-+$/g, '') // trim -
    .replace(/--+/g, '-'); // replace multiple - with single -

  if (slug.length > 85) {
    slug = slug.substring(0, 85).replace(/-[^-]*$/, '');
  }

  return slug || fallbackId || 'noticia';
}

export function categorySlugify(categoryName: string): string {
  if (!categoryName) return 'todas';

  return categoryName
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/&/g, 'e')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}
