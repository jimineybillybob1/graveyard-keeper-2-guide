import { DurableObject } from 'cloudflare:workers';

const MAX_BYTES = 768 * 1024;
const hex = /^[a-f0-9]{64}$/;
const encoded = /^[A-Za-z0-9_-]+$/;
const reply = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }
});

async function readBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) throw new Error('too-large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid-body');
  const chunks = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BYTES) { await reader.cancel(); throw new Error('too-large'); }
    chunks.push(value);
  }
  const all = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(all));
}

function validEnvelope(e) {
  if (!e || e.version !== 1 || typeof e.iv !== 'string' || e.iv.length !== 16 || !encoded.test(e.iv)
    || typeof e.ciphertext !== 'string' || e.ciphertext.length < 24 || e.ciphertext.length > MAX_BYTES - 1024
    || !encoded.test(e.ciphertext)) return false;
  try { return atob(e.iv.replace(/-/g, '+').replace(/_/g, '/')).length === 12; } catch { return false; }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim());
    if (!allowed.includes(origin)) return reply({ error: 'Origin not allowed' }, 403);
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', Vary: 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') return reply({ status: 'ok', protocol: 'keeper-ledger-1' }, 200, cors);
    const route = path.match(/^\/v1\/saves\/([a-f0-9]{64})(?:\/history(?:\/(\d+))?)?$/);
    if (!route) return reply({ error: 'Not found' }, 404, cors);
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (!hex.test(token)) return reply({ error: 'Private sync code required' }, 401, cors);
    try {
      const result = await env.SAVES.get(env.SAVES.idFromName(route[1])).fetch(request);
      const headers = new Headers(result.headers);
      for (const [key, value] of Object.entries(cors)) headers.set(key, value);
      return new Response(result.body, { status: result.status, headers });
    } catch { return reply({ error: 'Cloud save temporarily unavailable' }, 503, cors); }
  }
};

export class LedgerSave extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS vault (
        id INTEGER PRIMARY KEY CHECK (id = 1), auth_hash TEXT NOT NULL,
        revision INTEGER NOT NULL, updated_at TEXT NOT NULL, envelope TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS history (
        revision INTEGER PRIMARY KEY, updated_at TEXT NOT NULL, envelope TEXT NOT NULL
      );
    `);
  }

  async fetch(request) {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (!hex.test(token)) return reply({ error: 'Private sync code required' }, 401);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const authHash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    const path = new URL(request.url).pathname;
    let body;
    if (request.method === 'PUT' || request.method === 'DELETE') {
      try { body = await readBody(request); }
      catch (e) { return reply({ error: e.message === 'too-large' ? 'Save exceeds cloud size limit' : 'Invalid request body' }, e.message === 'too-large' ? 413 : 400); }
      if (!Number.isSafeInteger(body?.expectedRevision) || body.expectedRevision < 0)
        return reply({ error: 'Invalid revision' }, 400);
      if (request.method === 'PUT' && !validEnvelope(body.envelope)) return reply({ error: 'Invalid encrypted save' }, 400);
    }
    return this.ctx.storage.transactionSync(() => {
      const current = this.sql.exec('SELECT * FROM vault WHERE id = 1').toArray()[0];
      if (current && current.auth_hash !== authHash) return reply({ error: 'Private sync code not accepted' }, 403);
      if (path.includes('/history')) {
        if (request.method !== 'GET') return reply({ error: 'Method not allowed' }, 405);
        if (!current) return reply({ error: 'No cloud save' }, 404);
        const version = path.match(/\/history\/(\d+)$/)?.[1];
        if (version) {
          const row = this.sql.exec('SELECT * FROM history WHERE revision = ?', Number(version)).toArray()[0];
          return row ? reply({ revision: row.revision, updatedAt: row.updated_at, envelope: JSON.parse(row.envelope) }) : reply({ error: 'Recovery version not found' }, 404);
        }
        return reply({ versions: this.sql.exec('SELECT revision, updated_at AS updatedAt FROM history ORDER BY revision DESC LIMIT 8').toArray() });
      }
      if (request.method === 'GET') return current
        ? reply({ revision: current.revision, updatedAt: current.updated_at, envelope: JSON.parse(current.envelope) })
        : reply({ error: 'No cloud save' }, 404);
      if (request.method !== 'PUT' && request.method !== 'DELETE') return reply({ error: 'Method not allowed' }, 405);
      const revision = current?.revision || 0;
      if (body.expectedRevision !== revision) return reply({ error: 'Cloud save changed. Check it again before replacing a copy.', revision }, 409);
      if (request.method === 'DELETE') {
        this.sql.exec('DELETE FROM history; DELETE FROM vault;');
        return reply({ deleted: true });
      }
      const updatedAt = new Date().toISOString();
      if (current) this.sql.exec('INSERT INTO history (revision, updated_at, envelope) VALUES (?, ?, ?)', revision, current.updated_at, current.envelope);
      this.sql.exec('INSERT INTO vault (id, auth_hash, revision, updated_at, envelope) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision, updated_at=excluded.updated_at, envelope=excluded.envelope', authHash, revision + 1, updatedAt, JSON.stringify(body.envelope));
      this.sql.exec('DELETE FROM history WHERE revision <= ?', revision - 8);
      return reply({ saved: true, revision: revision + 1, updatedAt });
    });
  }
}
