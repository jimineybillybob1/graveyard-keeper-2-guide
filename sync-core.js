(function(root) {
  'use strict';
  const namespace = 'graveyard-keeper-2-ledger:cloud:v1';
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const encoder = new TextEncoder();
  const toHex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  const encode = bytes => { let s = ''; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  function normalizeCode(value) {
    const raw = String(value).trim().toUpperCase().replace(/[\s-]/g, '');
    if (raw.length !== 24 || [...raw].some(c => !alphabet.includes(c))) throw Error('Enter all six groups of your private sync code.');
    return raw.match(/.{4}/g).join('-');
  }
  function createCode() { return normalizeCode(Array.from(crypto.getRandomValues(new Uint8Array(24)), n => alphabet[n & 31]).join('')); }
  async function identity(code) {
    const normalized = normalizeCode(code);
    const material = await crypto.subtle.importKey('raw', encoder.encode(normalized), 'HKDF', false, ['deriveBits', 'deriveKey']);
    const parameters = label => ({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(namespace), info: encoder.encode(label) });
    const [locator, auth, key] = await Promise.all([
      crypto.subtle.deriveBits(parameters('storage-address'), material, 256),
      crypto.subtle.deriveBits(parameters('authorization'), material, 256),
      crypto.subtle.deriveKey(parameters('encryption'), material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    ]);
    return { id: toHex(locator), token: toHex(auth), key };
  }
  async function encrypt(save, ident) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = encoder.encode(JSON.stringify({ app: namespace, save }));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(namespace + ':' + ident.id) }, ident.key, plaintext);
    const envelope = { version: 1, iv: encode(iv), ciphertext: encode(ciphertext) };
    if (JSON.stringify(envelope).length > 768 * 1024 - 1024) throw Error('This save is too large for cloud sync. Export a backup and shorten your notes.');
    return envelope;
  }
  async function decrypt(envelope, ident) {
    try {
      if (envelope.version !== 1) throw Error('version');
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(envelope.iv), additionalData: encoder.encode(namespace + ':' + ident.id) }, ident.key, decode(envelope.ciphertext));
      const payload = JSON.parse(new TextDecoder().decode(plain));
      if (payload.app !== namespace) throw Error('application');
      return payload.save;
    } catch { throw Error('This code could not unlock the cloud save. Check the code before trying again.'); }
  }
  function canonical(save) {
    const result = { ...save }; delete result.updatedAt;
    for (const k of ['milestones', 'quests', 'favourites', 'caught', 'visited']) result[k] = [...result[k]].sort();
    result.queue = result.queue.map(q => ({ id: q.id, batches: q.batches })).sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify(Object.fromEntries(Object.keys(result).sort().map(k => [k, result[k]])));
  }
  async function fingerprint(save) { return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(canonical(save)))); }
  function compare(local, remote, baseline, empty) {
    if (!remote) return 'no-cloud';
    if (local === remote) return 'synced';
    if (!baseline) return local === empty ? 'cloud-newer' : 'choose';
    if (local === baseline) return 'cloud-newer';
    if (remote === baseline) return 'local-newer';
    return 'conflict';
  }
  const api = { createCode, normalizeCode, identity, encrypt, decrypt, fingerprint, compare };
  root.KeeperSyncCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
