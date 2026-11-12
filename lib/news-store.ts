// lib/news-store.ts
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { NewsItem } from './types';
import { getCategoryAliases, getCategorySourceIds } from './sources';

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
    path.join(os.tmpdir(), 'norma-juridica-data', 'news.db'),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).size > 100000) {
        // Verify database is healthy and not corrupt before returning it
        const testDb = new Database(c, { readonly: true, timeout: 2000 });
        const check = testDb.pragma('quick_check') as Array<{ quick_check: string }>;
        testDb.close();
        if (check && check.length > 0 && check[0].quick_check === 'ok') {
          return c;
        }
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

function isDirectoryWritable(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const testFile = path.join(dirPath, `.write_check_${process.pid}_${Date.now()}`);
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

export function getSqliteDbPath(): { dbPath: string; isEphemeral: boolean } {
  // Detect serverless or ephemeral filesystems (Vercel, Netlify, AWS Lambda)
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NOW_REGION
  );

  if (isServerless) {
    return {
      dbPath: path.join(os.tmpdir(), 'norma-juridica-news.db'),
      isEphemeral: true,
    };
  }

  const explicitPath = process.env.NEWS_SQLITE_PATH && process.env.NEWS_SQLITE_PATH.trim();
  if (explicitPath) {
    try {
      const resolved = path.isAbsolute(explicitPath) ? explicitPath : path.resolve(process.cwd(), explicitPath);
      const dir = path.dirname(resolved);
      if (isDirectoryWritable(dir)) {
        return { dbPath: resolved, isEphemeral: false };
      }
    } catch {}
    return { dbPath: path.join(os.tmpdir(), 'norma-juridica-news.db'), isEphemeral: true };
  }

  try {
    const defaultDir = path.join(process.cwd(), 'data');
    if (isDirectoryWritable(defaultDir)) {
      return {
        dbPath: path.join(defaultDir, 'news.db'),
        isEphemeral: false,
      };
    }
  } catch {}

  return {
    dbPath: path.join(os.tmpdir(), 'norma-juridica-news.db'),
    isEphemeral: true,
  };
}

const FEED_SELECT_COLUMNS = `
  id, slug, title, link, pub_date, pub_date_timestamp, iso_date,
  category, category_id, source, source_id, summary, image_url,
  images_json, image_caption, author, original_category, created_at, updated_at
`;

interface QueryCacheEntry {
  items: NewsItem[];
  total: number;
  timestamp: number;
}

export class SqliteNewsStore implements INewsStore {
  private db: Database.Database | null = null;
  private dbPath: string;
  private isEphemeral: boolean;
  private initialized = false;
  private queryCache = new Map<string, QueryCacheEntry>();

  constructor() {
    const loc = getSqliteDbPath();
    this.dbPath = loc.dbPath;
    this.isEphemeral = loc.isEphemeral;
  }

  public clearCache(): void {
    this.queryCache.clear();
  }

  public getDbLocation(): { path: string; isEphemeral: boolean } {
    return { path: this.dbPath, isEphemeral: this.isEphemeral };
  }

  private setupSchema(db: Database.Database): void {
    db.exec(`
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
  }

  public async init(): Promise<void> {
    if (this.initialized && this.db) return;

    try {
      let resolvedPath = path.isAbsolute(this.dbPath)
        ? this.dbPath
        : path.resolve(process.cwd(), this.dbPath);

      const dir = path.dirname(resolvedPath);
      if (!isDirectoryWritable(dir)) {
        const tmpDir = os.tmpdir();
        resolvedPath = path.join(tmpDir, 'norma-juridica-news.db');
        this.dbPath = resolvedPath;
        this.isEphemeral = true;
      }

      // In serverless / ephemeral environment, copy bundled database to /tmp on cold boot
      if (this.isEphemeral) {
        const seedDb = findSeedDbPath();
        let targetNeedsSeed = true;
        try {
          targetNeedsSeed = !fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).size < 10000;
        } catch {
          targetNeedsSeed = true;
        }
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
        // Validate database health
        const check = this.db.pragma('quick_check') as Array<{ quick_check: string }>;
        if (!check || check.length === 0 || check[0].quick_check !== 'ok') {
          throw new Error('Database integrity check failed: ' + JSON.stringify(check));
        }
      } catch (openErr) {
        console.warn('[SqliteNewsStore] Banco inicial malformado ou inacessível, recriando limpo:', openErr);
        if (this.db) {
          try { this.db.close(); } catch {}
          this.db = null;
        }
        try {
          if (fs.existsSync(resolvedPath)) {
            fs.unlinkSync(resolvedPath);
          }
        } catch {}

        // Fallback to fresh clean database
        const cleanPath = path.join(os.tmpdir(), `norma-juridica-news-${Date.now()}.db`);
        this.db = new Database(cleanPath, { timeout: 5000 });
        this.dbPath = cleanPath;
        this.isEphemeral = true;
      }

      // Enable Write-Ahead Logging (WAL) and memory optimizations for zero-copy concurrency
      try {
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('busy_timeout = 5000');
        this.db.pragma('cache_size = -8000'); // 8MB in-memory page cache
        this.db.pragma('mmap_size = 33554432'); // 32MB zero-copy memory map
        this.db.pragma('temp_store = MEMORY'); // Temporary tables and sorts in RAM
      } catch {}

      this.setupSchema(this.db);
      this.initialized = true;

      // Seed fallback from seed-news.json if database has fewer than 15000 items
      try {
        const countRow = this.db.prepare('SELECT COUNT(*) as count FROM news').get() as { count: number } | undefined;
        if (!countRow || countRow.count < 15000) {
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
        // If the database threw an error (e.g. malformed), recreate it cleanly in tmp
        try {
          if (this.db) {
            try { this.db.close(); } catch {}
          }
          const freshFallback = path.join(os.tmpdir(), `norma-juridica-fresh-${Date.now()}.db`);
          this.db = new Database(freshFallback, { timeout: 5000 });
          this.dbPath = freshFallback;
          this.isEphemeral = true;
          this.setupSchema(this.db);
          const seedJson = findSeedJsonPath();
          if (seedJson) {
            const raw = fs.readFileSync(seedJson, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              await this.upsertNews(parsed);
            }
          }
        } catch (recoverErr) {
          console.error('[SqliteNewsStore] Falha crítica ao recuperar banco:', recoverErr);
        }
      }
    } catch (err) {
      console.error('Falha ao inicializar SQLite store, usando fallback em memória:', err);
      try {
        const memoryFallback = path.join(os.tmpdir(), `norma-juridica-mem-${Date.now()}.db`);
        this.db = new Database(memoryFallback, { timeout: 5000 });
        this.dbPath = memoryFallback;
        this.isEphemeral = true;
        this.setupSchema(this.db);
        this.initialized = true;
        const seedJson = findSeedJsonPath();
        if (seedJson) {
          const raw = fs.readFileSync(seedJson, 'utf8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            await this.upsertNews(parsed);
          }
        }
      } catch {}
    }
  }

  private ensureDb(): Database.Database {
    if (!this.db || !this.initialized) {
      try {
        let dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
          try {
            fs.mkdirSync(dir, { recursive: true });
          } catch {
            this.dbPath = path.join(os.tmpdir(), 'norma-juridica-news.db');
            this.isEphemeral = true;
          }
        }

        // On cold-boot in ephemeral path, copy bundled seed db if available
        if (this.isEphemeral && (!fs.existsSync(this.dbPath) || fs.statSync(this.dbPath).size < 10000)) {
          const seedDb = findSeedDbPath();
          if (seedDb && seedDb !== this.dbPath) {
            try {
              fs.copyFileSync(seedDb, this.dbPath);
            } catch {}
          }
        }

        this.db = new Database(this.dbPath, { timeout: 5000 });
        const check = this.db.pragma('quick_check') as Array<{ quick_check: string }>;
        if (!check || check.length === 0 || check[0].quick_check !== 'ok') {
          throw new Error('Database integrity check failed in ensureDb: ' + JSON.stringify(check));
        }
        try {
          this.db.pragma('journal_mode = WAL');
          this.db.pragma('synchronous = NORMAL');
          this.db.pragma('busy_timeout = 5000');
          this.db.pragma('cache_size = -8000');
          this.db.pragma('mmap_size = 33554432');
          this.db.pragma('temp_store = MEMORY');
        } catch {}
        this.setupSchema(this.db);
        this.initialized = true;
      } catch (err) {
        console.warn('[SqliteNewsStore] Falha em ensureDb, usando fallback tmpdir:', err);
        if (this.db) {
          try { this.db.close(); } catch {}
          this.db = null;
        }
        const fallbackPath = path.join(os.tmpdir(), `norma-juridica-fresh-${Date.now()}.db`);
        this.db = new Database(fallbackPath, { timeout: 5000 });
        this.dbPath = fallbackPath;
        this.isEphemeral = true;
        this.setupSchema(this.db);
        this.initialized = true;

        // Auto re-seed fallback from seed-news.json
        try {
          const seedJson = findSeedJsonPath();
          if (seedJson && fs.existsSync(seedJson)) {
            const raw = fs.readFileSync(seedJson, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              this.upsertNews(parsed).catch(() => {});
            }
          }
        } catch {}
      }
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
      const aliases = getCategoryAliases(category);
      const sourceIds = getCategorySourceIds(category);
      const categoryClauses: string[] = [];

      if (aliases.length > 0) {
        const qMarks = aliases.map(() => '?').join(',');
        categoryClauses.push(`category_id IN (${qMarks})`);
        params.push(...aliases);
        categoryClauses.push(`category IN (${qMarks})`);
        params.push(...aliases);
        categoryClauses.push(`original_category IN (${qMarks})`);
        params.push(...aliases);
      }

      if (sourceIds.length > 0) {
        const qMarks = sourceIds.map(() => '?').join(',');
        categoryClauses.push(`source_id IN (${qMarks})`);
        params.push(...sourceIds);
      }

      const cleanCat = category.trim().toLowerCase();
      categoryClauses.push('LOWER(category) = ?');
      params.push(cleanCat);
      categoryClauses.push('LOWER(category_id) = ?');
      params.push(cleanCat);

      whereClauses.push(`(${categoryClauses.join(' OR ')})`);
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

    const cacheKey = `${category || 'all'}|${sourceId || ''}|${searchQuery || ''}|${limit}|${offset}|${order}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 20000) {
      return { items: cached.items, total: cached.total };
    }

    try {
      // Total count for query
      const countStmt = db.prepare(`SELECT COUNT(*) as count FROM news ${whereSql}`);
      const countRow = countStmt.get(...params) as { count: number } | undefined;
      const total = countRow ? countRow.count : 0;

      // Items query with pagination - selects only feed metadata columns, omitting large content_html
      const validOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const itemsSql = `
        SELECT ${FEED_SELECT_COLUMNS} FROM news
        ${whereSql}
        ORDER BY pub_date_timestamp ${validOrder}
        LIMIT ? OFFSET ?
      `;

      const itemsStmt = db.prepare(itemsSql);
      const rows = itemsStmt.all(...params, limit, offset) as Record<string, unknown>[];

      const items = rows.map(r => this.rowToNewsItem(r));

      // Cache result with LRU bounds
      if (this.queryCache.size > 200) {
        this.queryCache.clear();
      }
      this.queryCache.set(cacheKey, { items, total, timestamp: Date.now() });

      return { items, total };
    } catch (queryErr) {
      console.error('[SqliteNewsStore] Erro ao consultar notícias no SQLite:', queryErr);
      // Fallback: If query fails due to malformed db, reset db connection and reseed
      try {
        if (this.db) {
          try { this.db.close(); } catch {}
          this.db = null;
        }
        this.initialized = false;
        const seedJson = findSeedJsonPath();
        if (seedJson && fs.existsSync(seedJson)) {
          const raw = fs.readFileSync(seedJson, 'utf8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            let filtered = parsed;
            if (category && category !== 'all' && category !== 'todas') {
              const aliases = getCategoryAliases(category);
              const sourceIds = getCategorySourceIds(category);
              filtered = filtered.filter(item => {
                const itemCat = (item.category || '').toLowerCase();
                const itemCatId = (item.categoryId || '').toLowerCase();
                const itemSourceId = (item.sourceId || '').toLowerCase();
                return aliases.some(a => a.toLowerCase() === itemCat || a.toLowerCase() === itemCatId) ||
                       sourceIds.some(s => s.toLowerCase() === itemSourceId) ||
                       itemCat === category.toLowerCase() ||
                       itemCatId === category.toLowerCase();
              });
            }
            if (searchQuery && searchQuery.trim()) {
              const q = searchQuery.toLowerCase();
              filtered = filtered.filter(item =>
                (item.title && item.title.toLowerCase().includes(q)) ||
                (item.summary && item.summary.toLowerCase().includes(q))
              );
            }
            return {
              items: filtered.slice(offset, offset + limit),
              total: filtered.length,
            };
          }
        }
      } catch (fbErr) {
        console.error('[SqliteNewsStore] Erro no fallback de leitura JSON:', fbErr);
      }
      throw queryErr;
    }
  }

  public async getNewsBySlugOrId(slugOrId: string): Promise<NewsItem | null> {
    if (!slugOrId) return null;
    const db = this.ensureDb();

    const stmt = db.prepare(`
      SELECT * FROM news
      WHERE id = ? OR slug = ? OR link LIKE ?
      LIMIT 1
    `);

    try {
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
      if (approxRow) return this.rowToNewsItem(approxRow);
    } catch (err) {
      console.error('[SqliteNewsStore] Erro ao buscar notícia por slug/id:', err);
    }

    // Fallback: search in seed-news.json
    try {
      const seedJson = findSeedJsonPath();
      if (seedJson && fs.existsSync(seedJson)) {
        const raw = fs.readFileSync(seedJson, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = slugOrId.replace(/^-+|-+$/g, '').toLowerCase();
          const found = parsed.find(item =>
            item.id === slugOrId ||
            item.slug === slugOrId ||
            (item.slug && item.slug.toLowerCase().includes(clean)) ||
            (item.link && item.link.toLowerCase().includes(clean))
          );
          if (found) return found;
        }
      }
    } catch {}

    return null;
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
    this.clearCache();

    const totalInStore = await this.count();
    return { inserted, updated, unchanged, totalInStore };
  }

  public async prune(options: {
    maxItems?: number;
    maxPerSource?: number;
    retentionDays?: number;
  } = {}): Promise<PruneResult> {
    const db = this.ensureDb();

    const maxItems = Math.max(15000, options.maxItems ?? parseInt(process.env.NEWS_STORE_MAX_ITEMS || '15000', 10));
    const maxPerSource = Math.max(350, options.maxPerSource ?? parseInt(process.env.NEWS_STORE_MAX_PER_SOURCE || '350', 10));
    const retentionDays = Math.max(90, options.retentionDays ?? parseInt(process.env.NEWS_RETENTION_DAYS || '90', 10));

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
    this.clearCache();

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
      const aliases = getCategoryAliases(category);
      const sourceIds = getCategorySourceIds(category);
      const categoryClauses: string[] = [];
      const params: (string | number)[] = [];

      if (aliases.length > 0) {
        const qMarks = aliases.map(() => '?').join(',');
        categoryClauses.push(`category_id IN (${qMarks})`);
        params.push(...aliases);
        categoryClauses.push(`category IN (${qMarks})`);
        params.push(...aliases);
        categoryClauses.push(`original_category IN (${qMarks})`);
        params.push(...aliases);
      }

      if (sourceIds.length > 0) {
        const qMarks = sourceIds.map(() => '?').join(',');
        categoryClauses.push(`source_id IN (${qMarks})`);
        params.push(...sourceIds);
      }

      const cleanCat = category.trim().toLowerCase();
      categoryClauses.push('LOWER(category) = ?');
      params.push(cleanCat);
      categoryClauses.push('LOWER(category_id) = ?');
      params.push(cleanCat);

      const stmt = db.prepare(`SELECT COUNT(*) as count FROM news WHERE (${categoryClauses.join(' OR ')})`);
      const row = stmt.get(...params) as { count: number } | undefined;
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
