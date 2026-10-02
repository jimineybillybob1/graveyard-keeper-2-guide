(function() {
  'use strict';
  const core = window.KeeperSyncCore, ledger = window.KeeperLedger;
  const endpoint = (window.KEEPER_SYNC_ENDPOINT || '').replace(/\/$/, '');
  const META = 'keeper-ledger-cloud-v1', BACKUPS = 'keeper-ledger-recovery-v1';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let meta = { code: '', baseline: null }, status = 'unchecked', message = '', snapshot = null;
  let busy = false, generation = 0, versions = [], showCode = false;
  try {
    const stored = JSON.parse(localStorage.getItem(META) || 'null');
    if (stored?.code) meta = { code: core.normalizeCode(stored.code), baseline: stored.baseline || null };
  } catch { message = 'The saved cloud connection could not be read. Enter your private code again.'; }

  const names = {
    unchecked: 'Not checked yet', checking: 'Checking cloud…', synced: 'In sync',
    'no-cloud': 'No cloud save yet', 'local-newer': 'Changes on this device',
    'cloud-newer': 'Newer cloud progress available', conflict: 'Both copies have changed',
    choose: 'Choose which copy to keep', error: 'Cloud unavailable', offline: 'Offline · local progress kept'
  };
  const date = value => value ? new Date(value).toLocaleString() : 'Not saved';
  const summary = save => `Week ${save.week}, ${['Gluttony','Sloth','Lust','Envy','Pride','Wrath'][save.day]} · ${save.quests.length} quests · ${save.milestones.length} milestones`;
  function persist() { localStorage.setItem(META, JSON.stringify(meta)); }
  function backups() { try { const list = JSON.parse(localStorage.getItem(BACKUPS) || '[]'); return Array.isArray(list) ? list : []; } catch { return []; } }
  function backup(reason) {
    const list = backups(); list.unshift({ at: new Date().toISOString(), reason, save: ledger.getSave() });
    try { localStorage.setItem(BACKUPS, JSON.stringify(list.slice(0, 5))); }
    catch { throw Error('A recovery backup could not be saved. Export your progress and free browser storage before loading another copy.'); }
  }
  function panel() {
    const disabled = busy ? 'disabled' : '';
    return `<div class="eyebrow">Encrypted Cloudflare saves</div><h3>One private code. Your devices.</h3>
      <p>Create a code on your first device, then enter that code on your iPad or PC. Use <strong>Save to cloud</strong> before switching devices and <strong>Load from cloud</strong> on the other one.</p>
      <p class="muted">Your code unlocks the save. Keep a copy somewhere private; it cannot be recovered for you. Pokémon guide codes are separate.</p>
      ${!endpoint ? '<p class="notice">Cloud service setup is in progress. Local saves and file backups still work.</p>' : ''}
      <label for="cloud-code">Private sync code</label><div class="actions sync-code-row"><input id="cloud-code" type="${showCode?'text':'password'}" value="${escape(meta.code)}" placeholder="Six groups of four characters" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="29" ${disabled}>
      <button class="button" data-cloud="show" ${disabled}>${showCode?'Hide':'Show'}</button>
      <button class="button" data-cloud="connect" ${disabled}>Use this code</button></div>
      <div class="actions"><button class="button" data-cloud="create" ${disabled}>Create new code</button><button class="button" data-cloud="copy" ${!meta.code||busy?'disabled':''}>Copy code</button>${meta.code?`<button class="button" data-cloud="forget" ${disabled}>Forget on this device</button>`:''}</div>
      <div class="quiet" role="status"><strong>${meta.code ? names[status] || 'Not checked' : 'No cloud code connected'}</strong><p style="margin:5px 0 0">${escape(message || (meta.code?'Check the cloud before choosing a copy.':'Your progress continues to save on this device.'))}</p>${meta.baseline?.at?`<small>Last matched: ${escape(date(meta.baseline.at))}</small>`:''}</div>
      ${snapshot?.save?`<div class="sync-compare"><div><strong>This device</strong><p>${escape(summary(ledger.getSave()))}</p></div><div><strong>Cloud copy · revision ${snapshot.revision}</strong><p>${escape(summary(snapshot.save))}</p><small>${escape(date(snapshot.updatedAt))}</small></div></div>`:''}
      <div class="actions" style="margin-top:16px"><button class="button" data-cloud="check" ${!meta.code||!endpoint||busy?'disabled':''}>Check latest</button><button class="button primary" data-cloud="upload" ${!meta.code||!endpoint||busy?'disabled':''}>Save to cloud</button><button class="button" data-cloud="download" ${!meta.code||!endpoint||busy?'disabled':''}>Load from cloud</button></div>
      <details class="sync-recovery" ${document.querySelector('.sync-recovery')?.open?'open':''}><summary>Recovery & cloud storage</summary><p>Loading a different copy keeps one of five local recovery backups. The cloud keeps eight previous uploaded versions.</p>
      <button class="button" data-cloud="history" ${!meta.code||!endpoint||busy?'disabled':''}>Show previous cloud saves</button>
      ${versions.map(v=>`<div class="list-row"><span>Cloud revision ${v.revision}<small style="display:block">${escape(date(v.updatedAt))}</small></span><button class="button" data-cloud-history="${v.revision}" ${disabled}>Load this version</button></div>`).join('')}
      ${backups().map((v,i)=>`<div class="list-row"><span>${escape(v.reason)}<small style="display:block">${escape(date(v.at))}</small></span><button class="button" data-cloud-backup="${i}" ${disabled}>Restore locally</button></div>`).join('')}
      <p><button class="button" data-cloud="delete" ${!meta.code||!endpoint||busy?'disabled':''}>Delete cloud copy & history</button></p></details>`;
  }
  function label() { return meta.code ? (busy ? 'Checking cloud…' : names[status] || 'Local save') : 'Saved on this device'; }
  function paint() {
    const root = document.querySelector('#cloud-sync');
    if (root && !root.contains(document.activeElement)) root.innerHTML = panel();
    const labelEl = document.querySelector('#save-status');
    if (labelEl && ledger.storageOK()) labelEl.textContent = label();
  }
  function insistCurrent(g) { if (g !== generation) throw Error('The connected code changed. Check the cloud again.'); }
  async function request(ident, suffix = '', method = 'GET', body) {
    if (!endpoint) throw Error('Cloud service is not configured yet.');
    if (!navigator.onLine) throw Error('You are offline. Your local progress is safe; try again when connected.');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${endpoint}/v1/saves/${ident.id}${suffix}`, {
        method, cache: 'no-store', signal: controller.signal,
        headers: { Authorization: `Bearer ${ident.token}`, ...(body?{'Content-Type':'application/json'}:{}) },
        ...(body?{body:JSON.stringify(body)}:{})
      });
      if (response.status === 404 && method === 'GET') return null;
      const result = await response.json();
      if (!response.ok) { const error = Error(result.error || 'Cloud request failed. Your local progress is unchanged.'); error.status = response.status; throw error; }
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw Error('The cloud did not respond in time. Check latest before retrying.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  async function inspect() {
    if (!meta.code) throw Error('Create a code or connect your existing code first.');
    const g = generation, ident = await core.identity(meta.code);
    status = 'checking'; paint();
    const result = await request(ident); insistCurrent(g);
    const remoteSave = result ? ledger.validate(await core.decrypt(result.envelope, ident)) : null;
    insistCurrent(g);
    const remoteFP = remoteSave ? await core.fingerprint(remoteSave) : null;
    const localFP = await core.fingerprint(ledger.getSave()), emptyFP = await core.fingerprint(ledger.fresh());
    insistCurrent(g);
    snapshot = { ...result, save: remoteSave, fingerprint: remoteFP, revision: result?.revision || 0, ident };
    status = core.compare(localFP, remoteFP, meta.baseline?.fingerprint, emptyFP);
    message = ({synced:'Both devices’ copies match.', 'no-cloud':'Save to cloud to create the first copy.', 'local-newer':'Save to cloud before continuing on another device.', 'cloud-newer':'Load the cloud copy before making changes here.', conflict:'Changes exist on both sides. Nothing has been overwritten.', choose:'This device and the cloud differ, with no shared baseline. Choose which copy to keep.'})[status];
    if (status === 'synced') { meta.baseline = { fingerprint: remoteFP, revision: result.revision, at: result.updatedAt }; persist(); }
    paint(); return snapshot;
  }
  async function upload() {
    const g = generation, found = await inspect(); insistCurrent(g);
    if (status === 'synced') return;
    if (['cloud-newer','conflict','choose'].includes(status) && !confirm('Replace the cloud copy with THIS DEVICE’s progress? The previous cloud version will remain in recovery history.')) return;
    const capture = ledger.getSave(), fingerprint = await core.fingerprint(capture);
    const envelope = await core.encrypt(capture, found.ident); insistCurrent(g);
    const result = await request(found.ident, '', 'PUT', { expectedRevision: found.revision, envelope }); insistCurrent(g);
    meta.baseline = { fingerprint, revision: result.revision, at: result.updatedAt }; persist();
    snapshot = { revision: result.revision, updatedAt: result.updatedAt, save: capture, fingerprint, ident: found.ident };
    const latest = await core.fingerprint(ledger.getSave());
    status = latest === fingerprint ? 'synced' : 'local-newer';
    message = latest === fingerprint ? 'Encrypted progress saved to cloud.' : 'The captured copy is saved. New edits made during upload still need saving.';
    paint();
  }
  async function download(version = null) {
    const g = generation, before = await core.fingerprint(ledger.getSave());
    const found = await inspect(); insistCurrent(g);
    if (!found.save) throw Error('There is no cloud save for this code yet. Save from your other device first.');
    const record = version ? await request(found.ident, '/history/' + version) : found;
    if (!record) throw Error('That recovery version is no longer available.');
    const candidate = version ? ledger.validate(await core.decrypt(record.envelope, found.ident)) : found.save;
    insistCurrent(g);
    if (await core.fingerprint(ledger.getSave()) !== before) throw Error('Local progress changed while checking. Try loading again so no new edits are lost.');
    if (!version && await core.fingerprint(candidate) === before) return;
    if (!confirm(`${version?'Restore cloud revision '+version:'Load the cloud copy'} on THIS DEVICE? Your current progress will be kept in a local recovery backup.`)) return;
    backup(version?'Before restoring a cloud version':'Before loading cloud progress');
    ledger.replaceSave(candidate);
    meta.baseline = { fingerprint: found.fingerprint, revision: found.revision, at: found.updatedAt }; persist();
    status = version ? 'local-newer' : 'synced';
    message = version ? 'Recovery version loaded locally. Save to cloud if you want it on your other devices.' : 'Cloud progress loaded on this device.';
    paint();
  }
  async function run(action) {
    if (busy) return;
    busy = true; paint();
    try { await action(); }
    catch (error) { status = navigator.onLine ? 'error' : 'offline'; message = error.status === 409 ? 'Another device saved first. Your local progress is intact. Check latest and choose a copy.' : error.message; }
    finally { busy = false; const root=document.querySelector('#cloud-sync');if(root)root.innerHTML=panel();paint(); }
  }
  async function handle(action) {
    if (action === 'connect') {
      const code = core.normalizeCode(document.querySelector('#cloud-code').value);
      if (code !== meta.code) { generation++; meta = { code, baseline: null }; persist(); snapshot = null; versions=[]; }
      return run(inspect);
    }
    if (action === 'create') {
      if (meta.code && !confirm('Create a new cloud slot? Keep your old code if you want to return to its save.')) return;
      generation++; meta = { code: core.createCode(), baseline: null }; persist(); status='unchecked';message='Code created. Copy it somewhere private, then choose Save to cloud.';snapshot=null;versions=[];showCode=true;paint();return;
    }
    if (action === 'show') { showCode=!showCode;document.querySelector('#cloud-sync').innerHTML=panel();return; }
    if (action === 'copy') { await navigator.clipboard.writeText(meta.code);message='Private code copied. Paste it on your other device.';paint();return; }
    if (action === 'forget') {
      if (!confirm('Forget the code on this device? Your local progress and the cloud copy will remain. Keep the code elsewhere to reconnect.')) return;
      generation++;meta={code:'',baseline:null};localStorage.removeItem(META);snapshot=null;versions=[];status='unchecked';message='Code forgotten on this device.';paint();return;
    }
    if (action === 'check') return run(inspect);
    if (action === 'upload') return run(upload);
    if (action === 'download') return run(() => download());
    if (action === 'history') return run(async()=>{const g=generation,ident=await core.identity(meta.code),result=await request(ident,'/history');insistCurrent(g);versions=result?.versions||[];message=versions.length?'Choose a previous version to load locally.':'No previous cloud versions yet.';});
    if (action === 'delete') return run(async()=>{const g=generation,found=await inspect();if(!found.save)return;if(!confirm('Permanently delete this cloud copy and all eight cloud recovery versions? Local progress is not deleted.'))return;await request(found.ident,'','DELETE',{expectedRevision:found.revision});insistCurrent(g);meta.baseline=null;persist();snapshot=null;versions=[];status='no-cloud';message='Cloud copy deleted. Your local progress remains.';});
  }
  document.addEventListener('click', event => {
    const target=event.target.closest('[data-cloud],[data-cloud-history],[data-cloud-backup]');
    if(!target||busy)return;
    target.blur();
    if(target.dataset.cloud)handle(target.dataset.cloud).catch(error=>{status='error';message=error.message;paint();});
    if(target.dataset.cloudHistory)run(()=>download(Number(target.dataset.cloudHistory)));
    if(target.dataset.cloudBackup)run(async()=>{const chosen=backups()[Number(target.dataset.cloudBackup)];if(!chosen)return;if(!confirm('Restore this local backup? The cloud will not change until you save to it.'))return;backup('Before restoring a local backup');ledger.replaceSave(ledger.validate(chosen.save));status='unchecked';message='Local backup restored. Check the cloud before saving.';});
  });
  window.addEventListener('keeper:changed',()=>{snapshot=null;status=meta.code?'unchecked':'unchecked';message=meta.code?'Local changes saved. Check latest before saving to cloud.':'';paint();});
  window.addEventListener('storage',event=>{if(event.key===META){generation++;try{const value=JSON.parse(event.newValue||'null');meta=value?.code?{code:core.normalizeCode(value.code),baseline:value.baseline||null}:{code:'',baseline:null};}catch{meta={code:'',baseline:null};}snapshot=null;versions=[];status='unchecked';message='Cloud connection changed in another tab.';paint();}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&meta.code&&endpoint&&!busy)run(inspect);});
  window.addEventListener('online',()=>{if(meta.code&&endpoint&&!busy)run(inspect);});
  window.addEventListener('offline',()=>{if(meta.code){status='offline';message='Your progress is saved locally. Check cloud again when connected.';paint();}});
  window.KeeperCloud={panel,label};
  paint();
  if(meta.code&&endpoint)run(inspect);
})();
