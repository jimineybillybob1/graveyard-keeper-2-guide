(function () {
  'use strict';
  const U = window.UNLOCK_DATA;
  const techById = new Map(U.technologies.map(t => [t.id, t]));
  const inspById = new Map(U.inspirations.map(i => [i.id, i]));
  const techByName = new Map(U.technologies.map(t => [t.name.toLowerCase(), t]));
  const params = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const owned = id => state.technologies.includes(id);
  const routeLink = (kind, id) => `#${kind}?node=${encodeURIComponent(id)}`;
  function reference(ref, recipe = false) {
    const url = new URL(ref.url), id = decodeURIComponent(url.hash.slice(1));
    if (url.pathname === '/techs/' && techById.has(id)) return `<a class="unlock-link" href="${routeLink('technology', id)}">${esc(techById.get(id).name)}${owned(id) ? ' ✓' : ''}</a>`;
    if (url.pathname === '/inspirations/' && inspById.has(id)) return `<a class="unlock-link" href="${routeLink('inspirations', id)}">${esc(inspById.get(id).name)}</a>`;
    if (url.pathname.startsWith('/items/') && D.items.some(i => i.id === id)) {
      const hasRecipe = D.recipes.some(r => r.item === id);
      if (recipe && hasRecipe) return `<a class="unlock-link" href="#crafting?item=${encodeURIComponent(id)}">${esc(ref.name)} <span class="recipe-hint">· recipes ↗</span></a>`;
      return `<button class="ingredient" data-item="${esc(id)}">${esc(ref.name)}</button>`;
    }
    if (url.pathname === '/quests/' && D.quests.some(q => q.id === id)) return `<button class="ingredient" data-quest="${esc(id)}">${esc(ref.name)}${state.quests.includes(id) ? ' ✓' : ''}</button>`;
    return source(ref.url, ref.name);
  }
  function rich(parts, recipe = false) { return parts.map(p => typeof p === 'string' ? esc(p) : reference(p, recipe)).join(''); }
  function plain(parts) { return parts.map(p => typeof p === 'string' ? p : (p.url.includes('/techs/#') ? techById.get(p.url.split('#')[1])?.name || p.name : p.name)).join(' '); }
  function costs(cost) {
    const entries = Object.entries(cost);
    return entries.length ? `<div class="tech-cost">${entries.map(([color, n]) => `<span class="tech-point ${color}">${n} ${color}</span>`).join('')}</div>` : '<span class="badge">No tech-point cost</span>';
  }
  function techLink(id) { const t = techById.get(id); return t ? reference({ name: t.name, url: t.source }) : esc(id); }
  function ancestors(id, seen = new Set()) {
    const out = [];
    for (const parent of techById.get(id)?.parents || []) {
      if (seen.has(parent)) continue;
      seen.add(parent); out.push(...ancestors(parent, seen), parent);
    }
    return out;
  }
  function techStatus(t) {
    if (owned(t.id)) return 'Recorded as unlocked';
    const missing = t.parents.filter(id => !owned(id));
    if (missing.length) return `${missing.length} prerequisite${missing.length === 1 ? '' : 's'} not recorded`;
    return t.parents.length ? 'Tech prerequisites recorded · check other conditions' : 'Check tab, points and any conditions';
  }
  function requirements(t) {
    return `<h3>What you need</h3><div class="requirement-links">${t.requires.length ? rich(t.requires) : 'No earlier technology listed.'}</div>
      ${t.hidden ? '<p class="notice">Starts hidden. A reveal event is needed as well as any requirements shown here. The technology table does not specify every reveal trigger.</p>' : ''}
      ${t.quests.length ? `<p>Quest rewards linked to this technology: ${t.quests.map(id => reference({name:D.quests.find(q=>q.id===id)?.name||id,url:'https://gk2db.org/quests/#'+id})).join(' · ')}</p>` : ''}`;
  }
  function unlocks(t) {
    return Object.entries(t.unlocks).map(([kind, refs]) => `<div class="unlock-group"><h3>${kind === 'Recipes' ? 'Crafting recipes' : esc(kind)}</h3><div class="unlock-links">${refs.map(r => reference(r, kind === 'Recipes' || kind === 'Alchemy')).join(' ')}</div></div>`).join('') || '<p class="muted">No direct unlock is listed in the source table.</p>';
  }
  function trackTechnology(t) { return `<label class="actions tech-track"><input type="checkbox" data-tech="${esc(t.id)}" ${owned(t.id)?'checked':''}> I have unlocked this in the game</label>`; }
  const tabRules = {
    Building: 'Opens after your first wake-up at home. The Concept of Wood is granted during the introduction.',
    Metallurgy: 'Opens after your first wake-up at home.',
    Farming: 'Opens after your first wake-up at home.',
    Theology: 'Meet Agatha (the Nun) to open this tab.',
    'Anatomy and alchemy': 'Put a body on the autopsy table to open Anatomy.',
    Cooking: 'Cooking technologies are revealed and granted by events, rather than bought with tech points.'
  };
  function technology() {
    const id = params().get('node'), t = techById.get(id);
    if (id && !t) return head('Technology not found.', 'This link does not match the current catalogue.') + '<a class="button" href="#technology">Browse technologies</a>';
    if (t) {
      const path = ancestors(t.id), total = {};
      for (const node of [...path, t.id].filter(id => !owned(id))) for (const [c,n] of Object.entries(techById.get(node).cost)) total[c] = (total[c] || 0) + n;
      return head(t.name, `${t.category} · ${techStatus(t)}`, '<a class="button" href="#technology">All technologies</a>') +
        `<p class="notice">${esc(tabRules[t.category])}</p><div class="split unlock-detail"><section class="panel">${costs(t.cost)}${trackTechnology(t)}${requirements(t)}${unlocks(t)}<p>${source(t.source,'Technology source')}</p></section>
        <section class="panel"><h2>Your unlock path</h2><p>Earlier technologies first. Each node requires all of its direct prerequisites. Costs below exclude nodes you have recorded.</p>
        <ol class="tech-path">${[...path,t.id].map(id=>{const n=techById.get(id);return `<li class="${owned(id)?'done':''}"><div>${techLink(id)}${id===t.id?' <span class="badge">TARGET</span>':''}</div>${n.parents.length?`<small>Needs: ${n.parents.map(techLink).join(' + ')}</small>`:'<small>Root of this path</small>'}${costs(n.cost)}${n.hidden?'<small>Reveal event also needed</small>':''}</li>`}).join('')}</ol>
        <h3>Unrecorded path cost</h3>${costs(total)}<p class="muted">Point costs only; reputation, quest conditions and reveal events still apply.</p>
        <h3>Leads to</h3><div class="unlock-links">${t.children.map(techLink).join(' ')||'No later node listed.'}</div></section></div>`;
    }
    const statusFilter=params().get('status')||'all';
    const matches=U.technologies.filter(t=>(category==='all'||t.category===category)&&
      `${t.name} ${t.category} ${plain(t.requires)} ${Object.values(t.unlocks).flat().map(r=>r.name).join(' ')}`.toLowerCase().includes(search.toLowerCase())&&
      (statusFilter==='all'||(statusFilter==='owned'?owned(t.id):!owned(t.id))));
    const paging=pager(matches.length);
    return head('The technology tree.',`${U.technologies.length} technologies across six branches. Search a technology, requirement, building or recipe.`)+
      `<div class="notice">${state.technologies.length} recorded as unlocked. Open a node to follow its full prerequisite path. Marks are your guide notes; they do not spend points or change the game.</div>`+
      controls(Object.keys(tabRules),'Search technologies, unlocks or requirements…')+
      `<div class="actions unlock-filters">${[['all','All technologies'],['owned','Recorded as unlocked'],['missing','Not yet recorded']].map(([value,label])=>`<button class="pill ${statusFilter===value?'active':''}" data-tech-filter="${value}">${label}</button>`).join('')}</div>`+
      (category!=='all'?`<p class="quiet">${esc(tabRules[category])}</p>`:'')+
      `<div class="split tech-results">${matches.slice(page*36,(page+1)*36).map(t=>`<article class="panel tech-node"><div class="eyebrow">${esc(t.category)}</div><h2><a href="${routeLink('technology',t.id)}">${esc(t.name)}</a></h2>${costs(t.cost)}<p class="muted">${esc(techStatus(t))}</p><p class="requirement-links"><strong>Requires:</strong> ${t.requires.length?rich(t.requires):'No earlier technology listed.'}</p>${t.hidden?'<p class="badge">Reveal event needed</p>':''}${unlocks(t)}<div class="actions"><a class="button" href="${routeLink('technology',t.id)}">Explore unlock path →</a></div>${trackTechnology(t)}</article>`).join('')||'<p class="empty">No technologies match. Try an item name or another branch.</p>'}</div>`+paging;
  }
  function inspirationCard(i, expanded=false) {
    const purchased=state.inspirations[i.id]||0;
    return `<details class="panel inspiration-card" ${expanded?'open':''}><summary>${image(i,true)}<span><strong>${esc(i.name)}</strong><small>${esc(i.category)} · ${i.levels.length} levels · ${purchased} recorded</small></span>${i.blocked?'<span class="badge">Blocked</span>':''}</summary>
      ${i.blocked?'<p class="notice">Cannot currently be completed: the source reports no game action that increases this counter.</p>':''}
      <h3>When it appears</h3><div class="requirement-links">${rich(i.appears)}</div><h3>What counts toward it</h3><ul class="inspiration-actions">${i.actions.map(parts=>`<li>${rich(parts,true)}</li>`).join('')}</ul>
      <div class="level-scroll"><table class="inspiration-levels"><caption>Cumulative goals · Faith is paid for each level</caption><thead><tr><th>Level</th><th>Total needed</th><th>Faith</th><th>Talent XP</th></tr></thead><tbody>${i.levels.map(l=>`<tr class="${l.level<=purchased?'done':''}"><th>${l.level}${l.level<=purchased?' ✓':''}</th><td>${l.goal}</td><td>${l.faith||'Free'}</td><td>${l.xp}</td></tr>`).join('')}</tbody></table></div>
      <label class="inspiration-record">Levels purchased in the game <select data-inspiration="${esc(i.id)}" ${i.blocked?'disabled':''}><option value="0">None yet</option>${i.levels.map(l=>`<option value="${l.level}" ${purchased===l.level?'selected':''}>Through level ${l.level}</option>`).join('')}</select></label>
      <p class="muted">Reaching a goal is not the same as buying the level. Record purchased levels after paying the Faith cost.</p><div class="actions"><a href="${routeLink('inspirations',i.id)}">Link to this inspiration</a>${source(i.source,'Inspiration source')}</div></details>`;
  }
  function inspirations() {
    const id=params().get('node'),selected=inspById.get(id);
    if(id&&!selected)return head('Inspiration not found.','This link does not match the current catalogue.')+'<a class="button" href="#inspirations">Browse inspirations</a>';
    if(selected)return head(selected.name,selected.category,'<a class="button" href="#inspirations">All inspirations</a>')+inspirationCard(selected,true);
    const matches=U.inspirations.filter(i=>(category==='all'||i.category===category)&&`${i.name} ${i.category} ${plain(i.appears)} ${i.actions.map(plain).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
    const paging=pager(matches.length);
    return head('A little inspiration.',`${U.inspirations.length} tracks, with appearance requirements, cumulative goals and every level’s cost.`)+
      `<section class="quiet inspiration-intro"><strong>Work → inspiration goal → buy the level → talent XP → talent point</strong><p>Goals accumulate; buying a level usually costs Faith. XP goes to that inspiration’s branch. It takes 2 XP for the first talent level, then 3, then 4, then 5 per level. Inspirations do not directly unlock crafting recipes.</p><p>The inspiration page opens when one branch has two free levels ready to buy. Picking a pocket and completing the first burial provide the early Anatomy route. Recipe links below show what to make for a goal.</p>${source('https://gk2db.org/mechanics/talents/','Talent and inspiration rules')} · ${source('https://gk2db.org/talents/keeper/','Keeper talent tree')}</section>`+
      controls([...new Set(U.inspirations.map(i=>i.category))],'Search inspirations, goals, items or requirements…')+
      `<div class="inspiration-results">${matches.slice(page*36,(page+1)*36).map(i=>inspirationCard(i)).join('')||'<p class="empty">No inspirations match. Try a crafting item or another branch.</p>'}</div>`+paging;
  }
  function recipeRequirements(r) { return r.requires.map(name=>{const t=techByName.get(name.toLowerCase());return t?techLink(t.id):esc(name)}).join(', '); }
  document.addEventListener('change',event=>{
    const id=event.target.dataset.tech;
    if(id&&techById.has(id)) {
      const y=scrollY;
      if(!event.target.checked) {const dependent=U.technologies.filter(t=>owned(t.id)&&ancestors(t.id).includes(id));if(dependent.length&&!confirm(`Remove this mark? ${dependent.length} recorded later technologies rely on it. Their marks will remain until you change them.`)){event.target.checked=true;return;}}
      toggle('technologies',id);render();window.scrollTo(0,y);
    }
    const insp=event.target.dataset.inspiration;
    if(insp&&inspById.has(insp)) {const n=Number(event.target.value),record=inspById.get(insp);if(record.blocked||!Number.isInteger(n)||n<0||n>record.levels.length)return;if(n)state.inspirations[insp]=n;else delete state.inspirations[insp];save();const card=event.target.closest('.inspiration-card'),y=scrollY;card.outerHTML=inspirationCard(record,true);window.scrollTo(0,y);}
  });
  document.addEventListener('click',event=>{
    if(event.target.closest('a[href^="#"]')&&document.querySelector('#detail')?.open)document.querySelector('#detail').close();
    const value=event.target.closest('[data-tech-filter]')?.dataset.techFilter;
    if(value){page=0;history.replaceState(null,'','#technology?status='+value);render();}
  });
  window.KeeperUnlocks={technology,inspirations,recipeRequirements};
  if(['technology','inspirations'].includes(route))render();
})();
