// lib/news-store.ts
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { NewsItem } from './types';

export function formatTimeAgo(dateStr: string): string {
  try {
    const pub = new Date(dateStr).getTime();
    if (isNaN(pub)) return 'Recentemente';

    const diffMs = Date.now() - pub;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);

    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin === 1) return 'Há 1 minuto';
    if (diffMin < 60) return `Há ${diffMin} minutos`;
    if (diffHours === 1) return 'Há 1 hora';
    if (diffHours < 24) return `Há ${diffHours} horas`;
    if (diffHours < 48) return 'Ontem';

    const d = new Date(pub);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return 'Recentemente';
  }
}


export interface GetNewsOptions {
  category?: string;
  sourceId?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
  page?: number;
  orderBy?: 'pubDate' | 'createdAt';
  order?: 'ASC' | 'DESC';
}

export interface UpsertResult {
  inserted: number;
  updated: number;
  unchanged: number;
  totalInStore: number;
}

export interface PruneResult {
  prunedByRetention: number;
  prunedBySourceLimit: number;
  prunedByMaxItems: number;
  totalPruned: number;
  remaining: number;
}

export interface SyncMetadata {
  lastSyncAt: string;
  lastSyncDurationMs: number;
  lastSyncStatus: 'success' | 'partial' | 'error';
  sourcesSynced: number;
  totalSources: number;
  itemsSynced: number;
  itemsInserted: number;
  itemsUpdated: number;
  errorMessage?: string;
}

export interface INewsStore {
  init(): Promise<void>;
  getNews(options?: GetNewsOptions): Promise<{ items: NewsItem[]; total: number }>;
  getNewsBySlugOrId(slugOrId: string): Promise<NewsItem | null>;
  upsertNews(items: NewsItem[]): Promise<UpsertResult>;
  prune(options?: {
    maxItems?: number;
    maxPerSource?: number;
    retentionDays?: number;
  }): Promise<PruneResult>;
  count(category?: string): Promise<number>;
  countBySource(): Promise<Record<string, number>>;
  getDistinctCategories(): Promise<string[]>;
  getSyncMetadata(): Promise<SyncMetadata | null>;
  setSyncMetadata(meta: SyncMetadata): Promise<void>;
  exportBackup(): Promise<NewsItem[]>;
  importBackup(items: NewsItem[]): Promise<number>;
  getDbLocation(): { path: string; isEphemeral: boolean };
  close(): Promise<void>;
}

function parseDateToTimestamp(dateStr?: string): number {
  if (!dateStr) return Date.now();
  const parsed = new Date(dateStr).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
}

export function cleanCategoryName(name: string): string {
  if (!name) return '';
  return name
    .replace(/^Editoria\s+de\s+/i, '')
    .replace(/^Editoria\s+/i, '')
    .trim();
}

function findSeedDbPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'data', 'news.db'),
    path.join(__dirname, '..', 'data', 'news.db'),
    path.join(__dirname, '..', '..', 'data', 'news.db'),
    path.join('/app/applet', 'data', 'news.db'),
    '/data/news.db',
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).size > 100000) {
        return c;
      }
    } catch {}
  }
  return null;
}

function findSeedJsonPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'data', 'seed-news.json'),
    path.join(__dirname, '..', 'data', 'seed-news.json'),
    path.join(__dirname, '..', '..', 'data', 'seed-news.json'),
    path.join('/app/applet', 'data', 'seed-news.json'),
    '/data/seed-news.json',
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).size > 1000) {
        return c;
      }
    } catch {}
  }
  return null;
}

export function getSqliteDbPath(): { dbPath: string; isEphemeral: boolean } {
  if (process.env.NEWS_SQLITE_PATH && process.env.NEWS_SQLITE_PATH.trim()) {
    return {
      dbPath: process.env.NEWS_SQLITE_PATH.trim(),
      isEphemeral: false,
    };
  }

  // Detect serverless or ephemeral filesystems (Vercel, Netlify, AWS Lambda)
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NOW_REGION
  );

  if (isServerless) {
    return {
      dbPath: '/tmp/norma-juridica-news.db',
      isEphemeral: true,
    };
  }

  const defaultDir = path.join(process.cwd(), 'data');
  return {
    dbPath: path.join(defaultDir, 'news.db'),
    isEphemeral: false,
  };
}

export class SqliteNewsStore implements INewsStore {
  private db: Database.Database | null = null;
  private dbPath: string;
  private isEphemeral: boolean;
  private initialized = false;

  constructor() {
    const loc = getSqliteDbPath();
    this.dbPath = loc.dbPath;
    this.isEphemeral = loc.isEphemeral;
  }

  public getDbLocation(): { path: string; isEphemeral: boolean } {
    return { path: this.dbPath, isEphemeral: this.isEphemeral };
  }

  public async init(): Promise<void> {
    if (this.initialized && this.db) return;

    try {
      let resolvedPath = path.isAbsolute(this.dbPath)
        ? this.dbPath
        : path.resolve(process.cwd(), this.dbPath);

      const dir = path.dirname(resolvedPath);
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      } catch (err) {
        console.warn(`[SqliteNewsStore] Aviso: Diretório ${dir} inacessível, utilizando os.tmpdir()`, err);
        const tmpDir = path.join(os.tmpdir(), 'norma-juridica-data');
        if (!fs.existsSync(tmpDir)) {
          try {
            fs.mkdirSync(tmpDir, { recursive: true });
          } catch {}
        }
        resolvedPath = path.join(tmpDir, 'news.db');
        this.dbPath = resolvedPath;
        this.isEphemeral = true;
      }

      // In serverless environment, copy bundled database to /tmp on cold boot
      if (this.isEphemeral) {
        const seedDb = findSeedDbPath();
        const targetNeedsSeed = !fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).size < 10000;
        if (seedDb && targetNeedsSeed && seedDb !== resolvedPath) {
          try {
            fs.copyFileSync(seedDb, resolvedPath);
          } catch (copyErr) {
            console.warn('[SqliteNewsStore] Erro ao copiar seedDb para /tmp:', copyErr);
          }
        }
      }

      try {
        this.db = new Database(resolvedPath, {
          timeout: 5000,
        });
      } catch (dbErr) {
        console.warn(`[SqliteNewsStore] Falha ao abrir ${resolvedPath}, usando fallback em /tmp`, dbErr);
        const fallbackPath = path.join(os.tmpdir(), 'norma-juridica-news-fallback.db');
        this.db = new Database(fallbackPath, {
          timeout: 5000,
        });
        this.dbPath = fallbackPath;
        this.isEphemeral = true;
      }

      // Enable Write-Ahead Logging (WAL) for high concurrency
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('busy_timeout = 5000');

      // Create news table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS news (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          link TEXT NOT NULL,
          pub_date TEXT NOT NULL,
          pub_date_timestamp INTEGER NOT NULL,
          iso_date TEXT,
          category TEXT NOT NULL,
          category_id TEXT NOT NULL,
          source TEXT NOT NULL,
          source_id TEXT,
          summary TEXT NOT NULL,
          content_html TEXT,
          image_url TEXT,
          images_json TEXT,
          image_caption TEXT,
          author TEXT,
          original_category TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sync_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_news_slug ON news (slug);
        CREATE INDEX IF NOT EXISTS idx_news_category ON news (category);
        CREATE INDEX IF NOT EXISTS idx_news_category_id ON news (category_id);
        CREATE INDEX IF NOT EXISTS idx_news_source_id ON news (source_id);
        CREATE INDEX IF NOT EXISTS idx_news_pub_date_ts ON news (pub_date_timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_news_category_pub_ts ON news (category_id, pub_date_timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_news_source_pub_ts ON news (source_id, pub_date_timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_news_link ON news (link);
      `);

      this.initialized = true;

      // Seed fallback from seed-news.json if database has 0 items
      try {
        const countRow = this.db.prepare('SELECT COUNT(*) as count FROM news').get() as { count: number } | undefined;
        if (!countRow || countRow.count === 0) {
          const seedJson = findSeedJsonPath();
          if (seedJson) {
            const raw = fs.readFileSync(seedJson, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              await this.upsertNews(parsed);
            }
          }
        }
      } catch (seedErr) {
        console.warn('[SqliteNewsStore] Aviso ao carregar seed inicial:', seedErr);
      }
    } catch (err) {
      console.error('Falha ao inicializar SQLite store:', err);
      throw err;
    }
  }

  private ensureDb(): Database.Database {
    if (!this.db || !this.initialized) {
      // Synchronous initialization fallback if not awaited
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new Database(this.dbPath, { timeout: 5000 });
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('busy_timeout = 5000');
      this.init();
    }
    return this.db;
  }

  private rowToNewsItem(row: Record<string, unknown>): NewsItem {
    let images: string[] = [];
    if (typeof row.images_json === 'string' && row.images_json) {
      try {
        images = JSON.parse(row.images_json);
      } catch {
        images = [];
      }
    }

    const pubDate = String(row.pub_date || new Date().toISOString());
    const categoryName = cleanCategoryName(String(row.category || ''));

    return {
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      link: String(row.link),
      pubDate,
      isoDate: row.iso_date ? String(row.iso_date) : pubDate,
      timeAgo: formatTimeAgo(pubDate),
      category: categoryName,
      categoryId: String(row.category_id),
      source: String(row.source || 'Norma Jurídica'),
      summary: String(row.summary || ''),
      contentHtml: row.content_html ? String(row.content_html) : undefined,
      imageUrl: row.image_url ? String(row.image_url) : undefined,
      images,
      imageCaption: row.image_caption ? String(row.image_caption) : undefined,
      author: row.author ? String(row.author) : 'Norma Jurídica',
      originalCategory: row.original_category ? String(row.original_category) : undefined,
    };
  }

  public async getNews(options: GetNewsOptions = {}): Promise<{ items: NewsItem[]; total: number }> {
    const db = this.ensureDb();
    const {
      category,
      sourceId,
      searchQuery,
      limit = 30,
      page = 1,
      offset: rawOffset,
      order = 'DESC',
    } = options;

    const offset = rawOffset !== undefined ? rawOffset : (Math.max(1, page) - 1) * limit;

    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (category && category !== 'all' && category !== 'todas') {
      const cleanCat = category.trim().toLowerCase();
      whereClauses.push('(LOWER(category) = ? OR LOWER(category_id) = ? OR LOWER(original_category) = ?)');
      params.push(cleanCat, cleanCat, cleanCat);
    }

    if (sourceId) {
      whereClauses.push('source_id = ?');
      params.push(sourceId.trim());
    }

    if (searchQuery && searchQuery.trim()) {
      const q = `%${searchQuery.trim().toLowerCase()}%`;
      whereClauses.push('(LOWER(title) LIKE ? OR LOWER(summary) LIKE ?)');
      params.push(q, q);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count for query
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM news ${whereSql}`);
    const countRow = countStmt.get(...params) as { count: number } | undefined;
    const total = countRow ? countRow.count : 0;

    // Items query with pagination
    const validOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const itemsSql = `
      SELECT * FROM news
      ${whereSql}
      ORDER BY pub_date_timestamp ${validOrder}
      LIMIT ? OFFSET ?
    `;

    const itemsStmt = db.prepare(itemsSql);
    const rows = itemsStmt.all(...params, limit, offset) as Record<string, unknown>[];

    const items = rows.map(r => this.rowToNewsItem(r));

    return { items, total };
  }

  public async getNewsBySlugOrId(slugOrId: string): Promise<NewsItem | null> {
    if (!slugOrId) return null;
    const db = this.ensureDb();

    const stmt = db.prepare(`
      SELECT * FROM news
      WHERE id = ? OR slug = ? OR link LIKE ?
      LIMIT 1
    `);

    const row = stmt.get(slugOrId, slugOrId, `%/noticia/${slugOrId}`) as Record<string, unknown> | undefined;
    if (row) {
      return this.rowToNewsItem(row);
    }

    // Secondary approximate match if slug has trailing or leading dashes
    const clean = slugOrId.replace(/^-+|-+$/g, '');
    const approxStmt = db.prepare(`
      SELECT * FROM news
      WHERE slug LIKE ?
      LIMIT 1
    `);
    const approxRow = approxStmt.get(`%${clean}%`) as Record<string, unknown> | undefined;
    return approxRow ? this.rowToNewsItem(approxRow) : null;
  }

  public async upsertNews(items: NewsItem[]): Promise<UpsertResult> {
    if (!items || items.length === 0) {
      const count = await this.count();
      return { inserted: 0, updated: 0, unchanged: 0, totalInStore: count };
    }

    const db = this.ensureDb();
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    const findStmt = db.prepare('SELECT id, title, category, category_id, summary, pub_date_timestamp FROM news WHERE id = ? OR slug = ? LIMIT 1');

    const insertStmt = db.prepare(`
      INSERT INTO news (
        id, slug, title, link, pub_date, pub_date_timestamp, iso_date,
        category, category_id, source, source_id, summary, content_html,
        image_url, images_json, image_caption, author, original_category,
        created_at, updated_at
      ) VALUES (
        @id, @slug, @title, @link, @pub_date, @pub_date_timestamp, @iso_date,
        @category, @category_id, @source, @source_id, @summary, @content_html,
        @image_url, @images_json, @image_caption, @author, @original_category,
        @created_at, @updated_at
      )
    `);

    const updateStmt = db.prepare(`
      UPDATE news SET
        title = @title,
        link = @link,
        pub_date = @pub_date,
        pub_date_timestamp = @pub_date_timestamp,
        iso_date = @iso_date,
        category = @category,
        category_id = @category_id,
        source = @source,
        source_id = @source_id,
        summary = @summary,
        content_html = COALESCE(@content_html, content_html),
        image_url = COALESCE(@image_url, image_url),
        images_json = COALESCE(@images_json, images_json),
        image_caption = @image_caption,
        author = @author,
        original_category = @original_category,
        updated_at = @updated_at
      WHERE id = @id OR slug = @slug
    `);

    const now = Date.now();

    const tx = db.transaction((newsItems: NewsItem[]) => {
      for (const item of newsItems) {
        if (!item.title || (!item.id && !item.slug)) continue;

        const id = item.id || item.slug;
        const slug = item.slug || item.id;
        const pubDateTs = parseDateToTimestamp(item.isoDate || item.pubDate);
        const imagesJson = item.images && item.images.length > 0 ? JSON.stringify(item.images) : '[]';

        const existing = findStmt.get(id, slug) as { id: string; title: string; summary: string; pub_date_timestamp: number } | undefined;

        const payload = {
          id,
          slug,
          title: item.title,
          link: item.link || `/noticia/${slug}`,
          pub_date: item.pubDate,
          pub_date_timestamp: pubDateTs,
          iso_date: item.isoDate || item.pubDate,
          category: item.category || 'Notícias Gerais',
          category_id: item.categoryId || 'noticias-gerais',
          source: item.source || 'Norma Jurídica',
          source_id: (item as unknown as { sourceId?: string }).sourceId || '',
          summary: item.summary || '',
          content_html: item.contentHtml || null,
          image_url: item.imageUrl || null,
          images_json: imagesJson,
          image_caption: item.imageCaption || null,
          author: item.author || 'Norma Jurídica',
          original_category: item.originalCategory || null,
          created_at: now,
          updated_at: now,
        };

        if (!existing) {
          try {
            insertStmt.run(payload);
            inserted++;
          } catch {
            // Slug conflict edge-case: update instead
            try {
              updateStmt.run(payload);
              updated++;
            } catch {
              unchanged++;
            }
          }
        } else {
          // Check if changed (including category updates from API)
          if (
            existing.title !== item.title ||
            existing.summary !== item.summary ||
            (existing as { category?: string }).category !== item.category ||
            (existing as { category_id?: string }).category_id !== item.categoryId ||
            Math.abs(existing.pub_date_timestamp - pubDateTs) > 60000 ||
            item.contentHtml
          ) {
            updateStmt.run(payload);
            updated++;
          } else {
            unchanged++;
          }
        }
      }
    });

    tx(items);

    const totalInStore = await this.count();
    return { inserted, updated, unchanged, totalInStore };
  }

  public async prune(options: {
    maxItems?: number;
    maxPerSource?: number;
    retentionDays?: number;
  } = {}): Promise<PruneResult> {
    const db = this.ensureDb();

    const maxItems = options.maxItems ?? parseInt(process.env.NEWS_STORE_MAX_ITEMS || '5000', 10);
    const maxPerSource = options.maxPerSource ?? parseInt(process.env.NEWS_STORE_MAX_PER_SOURCE || '100', 10);
    const retentionDays = options.retentionDays ?? parseInt(process.env.NEWS_RETENTION_DAYS || '30', 10);

    let prunedByRetention = 0;
    let prunedBySourceLimit = 0;
    let prunedByMaxItems = 0;

    const tx = db.transaction(() => {
      // 1. Retention Days Pruning
      // Delete items older than retentionDays, but safeguard the latest 3 items per source
      if (retentionDays > 0) {
        const cutoffTs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
        const retentionStmt = db.prepare(`
          DELETE FROM news
          WHERE pub_date_timestamp < ?
            AND id NOT IN (
              SELECT id FROM (
                SELECT id, row_number() OVER (PARTITION BY source_id ORDER BY pub_date_timestamp DESC) as rn
                FROM news
                WHERE source_id IS NOT NULL AND source_id != ''
              ) WHERE rn <= 3
            )
        `);
        const res = retentionStmt.run(cutoffTs);
        prunedByRetention = res.changes;
      }

      // 2. Per-Source Capacity Pruning (FIFO per source)
      // Keeps the most recent maxPerSource items for each source
      if (maxPerSource > 0) {
        const sourceLimitStmt = db.prepare(`
          DELETE FROM news
          WHERE id IN (
            SELECT id FROM (
              SELECT id, row_number() OVER (PARTITION BY source_id ORDER BY pub_date_timestamp DESC) as rn
              FROM news
              WHERE source_id IS NOT NULL AND source_id != ''
            ) WHERE rn > ?
          )
        `);
        const res = sourceLimitStmt.run(maxPerSource);
        prunedBySourceLimit = res.changes;
      }

      // 3. Global Capacity Limit (FIFO overall, protecting representation of each source)
      if (maxItems > 0) {
        const countRow = db.prepare('SELECT COUNT(*) as count FROM news').get() as { count: number };
        const total = countRow ? countRow.count : 0;

        if (total > maxItems) {
          const excess = total - maxItems;

          // Attempt FIFO deletion protecting top 5 newest items of every source
          const pruneStmt = db.prepare(`
            DELETE FROM news
            WHERE id IN (
              SELECT id FROM news
              WHERE id NOT IN (
                SELECT id FROM (
                  SELECT id, row_number() OVER (PARTITION BY source_id ORDER BY pub_date_timestamp DESC) as rn
                  FROM news
                ) WHERE rn <= 5
              )
              ORDER BY pub_date_timestamp ASC
              LIMIT ?
            )
          `);
          const res = pruneStmt.run(excess);
          prunedByMaxItems = res.changes;

          // If still over limit (e.g. all items belong to protected pool)
          const newCountRow = db.prepare('SELECT COUNT(*) as count FROM news').get() as { count: number };
          const remainingExcess = (newCountRow ? newCountRow.count : 0) - maxItems;
          if (remainingExcess > 0) {
            const fallbackPrune = db.prepare(`
              DELETE FROM news
              WHERE id IN (
                SELECT id FROM news
                ORDER BY pub_date_timestamp ASC
                LIMIT ?
              )
            `);
            const fallbackRes = fallbackPrune.run(remainingExcess);
            prunedByMaxItems += fallbackRes.changes;
          }
        }
      }
    });

    tx();

    const remaining = await this.count();
    const totalPruned = prunedByRetention + prunedBySourceLimit + prunedByMaxItems;

    return {
      prunedByRetention,
      prunedBySourceLimit,
      prunedByMaxItems,
      totalPruned,
      remaining,
    };
  }

  public async count(category?: string): Promise<number> {
    const db = this.ensureDb();
    if (category && category !== 'all' && category !== 'todas') {
      const clean = category.trim().toLowerCase();
      const stmt = db.prepare(`
        SELECT COUNT(*) as count FROM news
        WHERE LOWER(category) = ? OR LOWER(category_id) = ?
      `);
      const row = stmt.get(clean, clean) as { count: number } | undefined;
      return row ? row.count : 0;
    }
    const stmt = db.prepare('SELECT COUNT(*) as count FROM news');
    const row = stmt.get() as { count: number } | undefined;
    return row ? row.count : 0;
  }

  public async countBySource(): Promise<Record<string, number>> {
    const db = this.ensureDb();
    const stmt = db.prepare(`
      SELECT source_id, COUNT(*) as count
      FROM news
      WHERE source_id IS NOT NULL AND source_id != ''
      GROUP BY source_id
    `);
    const rows = stmt.all() as { source_id: string; count: number }[];
    const res: Record<string, number> = {};
    for (const r of rows) {
      res[r.source_id] = r.count;
    }
    return res;
  }

  public async getDistinctCategories(): Promise<string[]> {
    const db = this.ensureDb();
    const stmt = db.prepare('SELECT DISTINCT category FROM news ORDER BY category ASC');
    const rows = stmt.all() as { category: string }[];
    return rows.map(r => r.category).filter(Boolean);
  }

  public async getSyncMetadata(): Promise<SyncMetadata | null> {
    const db = this.ensureDb();
    const stmt = db.prepare('SELECT value FROM sync_meta WHERE key = ?');
    const row = stmt.get('sync_status') as { value: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.value) as SyncMetadata;
    } catch {
      return null;
    }
  }

  public async setSyncMetadata(meta: SyncMetadata): Promise<void> {
    const db = this.ensureDb();
    const stmt = db.prepare(`
      INSERT INTO sync_meta (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    stmt.run('sync_status', JSON.stringify(meta), Date.now());
  }

  public async exportBackup(): Promise<NewsItem[]> {
    const { items } = await this.getNews({ limit: 10000, order: 'DESC' });
    return items;
  }

  public async importBackup(items: NewsItem[]): Promise<number> {
    const res = await this.upsertNews(items);
    return res.inserted + res.updated;
  }

  public async close(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
      } catch {}
      this.db = null;
      this.initialized = false;
    }
  }
}

// Global Singleton instance
let globalStore: INewsStore | null = null;

export function getNewsStore(): INewsStore {
  if (!globalStore) {
    globalStore = new SqliteNewsStore();
    // Non-blocking trigger of init
    globalStore.init().catch(err => {
      console.error('Falha ao inicializar Singleton SqliteNewsStore:', err);
    });
  }
  return globalStore;
}
