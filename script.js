// ===== Helpers =====
const money = (n)=> new Intl.NumberFormat('no-NO',{style:'currency',currency:'NOK'}).format(n||0);
const num = (n)=> new Intl.NumberFormat('no-NO').format(n||0);
const monthName = (d)=> d.toLocaleString('no-NO',{month:'long', year:'numeric'});

const LS = {
  data: "tenksmart:data",
  profile: "tenksmart:profile",
  first: "tenksmart:first"
};

function readLS(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeLS(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

// ===== Storage Abstraction =====
const Storage = {
  mode(){ return (readLS(LS.profile,{mode:'local'}).mode)||'local'; },
  async listMonth(date){ // returns [{user,name,total,count}]
    if(this.mode()==='firebase' && window.TS_FIREBASE?.enabled){
      return await window.TS_FIREBASE.listMonth(date);
    } else {
      const me = readLS(LS.profile, {name:'Anonym'});
      const all = readLS(LS.data, []);
      const month = date.getMonth(), year = date.getFullYear();
      const mine = all.filter(x=>{
        const d = new Date(x.date);
        return d.getMonth()===month && d.getFullYear()===year;
      });
      const total = mine.reduce((s,i)=> s + (Number(i.amount||0)*(Number(i.discount||0)/100)),0);
      return [{user:'me', name: me.name || 'Meg', total, count: mine.length}];
    }
  },
  async add(entry){
    if(this.mode()==='firebase' && window.TS_FIREBASE?.enabled){
      return await window.TS_FIREBASE.add(entry);
    } else {
      const all = readLS(LS.data, []);
      all.push(entry);
      writeLS(LS.data, all);
    }
  },
  async listAll(){
    if(this.mode()==='firebase' && window.TS_FIREBASE?.enabled){
      return await window.TS_FIREBASE.listAll();
    } else {
      return readLS(LS.data, []);
    }
  },
  async seedDemo(){
    if(readLS(LS.first,false)) return;
    try{
      const res = await fetch('data/demo-data.json');
      const items = await res.json();
      writeLS(LS.data, items);
    }catch(e){}
    writeLS(LS.first,true);
  }
};

// ===== Firebase (optional) =====
window.TS_FIREBASE = { enabled:false };
(async function initFirebase(){
  try{
    const cfgResp = await fetch('firebase-config.json');
    if(!cfgResp.ok) return; // not provided, stay disabled
    const cfg = await cfgResp.json();
    if(!cfg || !cfg.apiKey) return;

    // UMD Firebase (provided via lib/*.umd.js)
    const app = firebase.initializeApp(cfg);
    const db = firebase.firestore();

    window.TS_FIREBASE.enabled = true;
    window.TS_FIREBASE.add = async (entry)=>{
      const profile = readLS(LS.profile, {name:'Anonym'});
      await db.collection('tenksmart_entries').add({...entry, user: profile.name || 'Anonym'});
    };
    window.TS_FIREBASE.listAll = async ()=>{
      const snap = await db.collection('tenksmart_entries').get();
      return snap.docs.map(d=>d.data());
    };
    window.TS_FIREBASE.listMonth = async (date)=>{
      const m = date.getMonth()+1, y = date.getFullYear();
      // naive month filter (client side)
      const all = await window.TS_FIREBASE.listAll();
      const monthItems = all.filter(x=>{
        const d = new Date(x.date);
        return (d.getMonth()+1)===m && d.getFullYear()===y;
      });
      const byUser = {};
      for(const i of monthItems){
        const saved = Number(i.amount||0)*(Number(i.discount||0)/100);
        const key = i.user || 'Ukjent';
        if(!byUser[key]) byUser[key] = {user:key, name:key, total:0, count:0};
        byUser[key].total += saved;
        byUser[key].count += 1;
      }
      return Object.values(byUser).sort((a,b)=>b.total-a.total);
    };
  }catch(e){
    // stay disabled
  }
})();

// ===== UI Elements =====
const els = {
  greeting: document.getElementById('greeting'),
  profileName: document.getElementById('profileName'),
  storageMode: document.getElementById('storageMode'),
  saveProfile: document.getElementById('saveProfile'),
  form: document.getElementById('purchaseForm'),
  merchant: document.getElementById('merchant'),
  item: document.getElementById('item'),
  category: document.getElementById('category'),
  amount: document.getElementById('amount'),
  discount: document.getElementById('discount'),
  note: document.getElementById('note'),
  receipt: document.getElementById('receipt'),
  previewWrap: document.getElementById('receiptPreviewWrap'),
  calcPreview: document.getElementById('calcPreview'),
  statPurchases: document.getElementById('statPurchases'),
  statSpent: document.getElementById('statSpent'),
  statSaved: document.getElementById('statSaved'),
  monthBadge: document.getElementById('monthBadge'),
  recentList: document.getElementById('recentList'),
  lbTable: document.getElementById('leaderboardTable').querySelector('tbody'),
  btnExport: document.getElementById('btnExport'),
  btnReset: document.getElementById('btnReset'),
};

// ===== Greetings & Profile =====
function greet(){
  const prof = readLS(LS.profile, {name:null});
  const first = prof?.first? true:false;
  const title = first ? "Velkommen tilbake 👋" : "Velkommen! Du er i gang 💫";
  const text  = first ? "Fortsett der du slapp og registrer et kjøp." :
                        "Lagre profilnavn (valgfritt) og registrer ditt første kjøp.";
  els.greeting.innerHTML = `<h2>${title}</h2><p class="helper">${text}</p>`;
}

function loadProfileToUI(){
  const prof = readLS(LS.profile, {name:'', mode:'local'});
  els.profileName.value = prof.name || '';
  els.storageMode.value = prof.mode || 'local';
}

function saveProfile(){
  const prof = readLS(LS.profile, {});
  const next = {
    ...prof,
    name: els.profileName.value.trim() || 'Meg',
    mode: els.storageMode.value || 'local',
    first: true
  };
  writeLS(LS.profile, next);
  greet();
  renderAll();
}

// ===== Receipts preview =====
function handleReceiptPreview(file){
  if(!file) { els.previewWrap.innerHTML = ""; return; }
  const reader = new FileReader();
  reader.onload = ()=>{
    els.previewWrap.innerHTML = `<img class="preview-img" alt="kvittering" src="${reader.result}"/>`;
  };
  reader.readAsDataURL(file);
}

// ===== Form wiring =====
function wireForm(){
  els.receipt.addEventListener('change', (e)=> handleReceiptPreview(e.target.files?.[0]));
  document.getElementById('add10').onclick = ()=>{ els.discount.value = Number(els.discount.value||0)+10; updatePreview(); };
  document.getElementById('add20').onclick = ()=>{ els.discount.value = Number(els.discount.value||0)+20; updatePreview(); };
  document.getElementById('add40').onclick = ()=>{ els.discount.value = Number(els.discount.value||0)+40; updatePreview(); };

  els.form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    let receipt64 = null;
    const file = els.receipt.files?.[0];
    if(file){
      receipt64 = await new Promise((resolve)=>{
        const r = new FileReader();
        r.onload = ()=> resolve(r.result);
        r.readAsDataURL(file);
      });
    }
    const entry = {
      merchant: els.merchant.value.trim(),
      item: els.item.value.trim(),
      category: els.category.value,
      amount: Number(els.amount.value||0),
      discount: Number(els.discount.value||0),
      note: els.note.value.trim(),
      receipt: receipt64,
      date: new Date().toISOString()
    };
    await Storage.add(entry);
    els.form.reset();
    els.previewWrap.innerHTML = "";
    els.calcPreview.textContent = "";
    renderAll();
  });

  els.amount.addEventListener('input', updatePreview);
  els.discount.addEventListener('input', updatePreview);
  els.btnExport.addEventListener('click', exportCsv);
  els.btnReset.addEventListener('click', resetAll);
  els.saveProfile.addEventListener('click', saveProfile);
}

function updatePreview(){
  const a = Number(els.amount.value||0);
  const d = Number(els.discount.value||0);
  const saved = a*(d/100);
  els.calcPreview.textContent = (a>0 && d>0) ? `Du sparer ${money(saved)} på dette kjøpet.` : "";
}

// ===== Stats helpers =====
function calcStats(items){
  const spent = items.reduce((s,i)=> s + Number(i.amount||0), 0);
  const saved = items.reduce((s,i)=> s + (Number(i.amount||0)*(Number(i.discount||0)/100)), 0);
  return {count: items.length, spent, saved};
}

// ===== Insights helpers (SmartScore, top category, best week) =====
function calcSmartScore(items){
  if(!items.length) return 0;
  const n = items.length;
  const avgDisc = items.reduce((s,i)=>s+(Number(i.discount)||0),0)/n;            // 0–100
  const withNotes = items.filter(i=>(i.note||'').trim().length>0).length/n;      // 0–1
  const cats = new Set(items.map(i=>i.category||'Annet')).size;                  // 1..6
  const catDiversity = Math.min(cats/6,1);                                       // 0–1
  const freq = Math.min(Math.log2(n+1)/5,1);                                     // 0–1
  let score = (freq*30) + (avgDisc*0.3) + (withNotes*20) + (catDiversity*20);    // 0–100+
  return Math.round(Math.min(score,100));
}

function topCategoryBySavings(items){
  const map = {};
  for(const i of items){
    const saved = (Number(i.amount)||0) * ((Number(i.discount)||0)/100);
    const k = i.category || 'Annet';
    map[k] = (map[k]||0) + saved;
  }
  const entries = Object.entries(map).sort((a,b)=>b[1]-a[1]);
  if(!entries.length) return {category:'–', amount:0};
  const [category, amount] = entries[0];
  return {category, amount: Math.round(amount)};
}

function isoWeek(d){
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(),0,4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3) / 7);
  return {year: date.getUTCFullYear(), week};
}

function bestWeekBySavings(items){
  const map = {};
  for(const i of items){
    const d = new Date(i.date);
    const {year, week} = isoWeek(d);
    const key = `${year}-W${week}`;
    const saved = (Number(i.amount)||0) * ((Number(i.discount)||0)/100);
    map[key] = (map[key]||0) + saved;
  }
  const entries = Object.entries(map).sort((a,b)=>b[1]-a[1]);
  if(!entries.length) return {label:'–', amount:0};
  const [label, amount] = entries[0];
  return {label, amount: Math.round(amount)};
}

// ===== Render =====
async function renderAll(){
  const data = await Storage.listAll();
  const stats = calcStats(data);
  els.statPurchases.textContent = num(stats.count);
  els.statSpent.textContent = num(Math.round(stats.spent));
  els.statSaved.textContent = num(Math.round(stats.saved));

  const now = new Date();
  els.monthBadge.textContent = monthName(now);

  // --- Insights (vises hvis <div id="insights"></div> finnes i index.html) ---
  const score = calcSmartScore(data);
  const topCat = topCategoryBySavings(data);
  const bestW  = bestWeekBySavings(data);
  const insightsEl = document.getElementById('insights');
  if (insightsEl) {
    insightsEl.innerHTML = `
      <div class="helper">SmartScore: <strong>${score}</strong> / 100</div>
      <div class="helper">Mest spart: <strong>${topCat.category}</strong> – ${num(topCat.amount)} kr</div>
      <div class="helper">Beste uke: <strong>${bestW.label}</strong> – ${num(bestW.amount)} kr</div>
    `;
  }

  // Siste registreringer
  const recent = data.slice(-8).reverse();
  els.recentList.innerHTML = recent.map(i=>{
    const saved = Number(i.amount||0)*(Number(i.discount||0)/100);
    const d = new Date(i.date).toLocaleDateString('no-NO');
    const img = i.receipt ? `<img class="preview-img" src="${i.receipt}" alt="kvittering"/>` : "";
    return `<li>
      <div><strong>${i.merchant}</strong> – ${i.item} <span class="badge">${i.category||''}</span>
        <div class="meta">${d} • ${money(i.amount)} • ${i.discount||0}%</div>
        ${i.note? `<div class="meta">Notat: ${i.note}</div>`:""}
      </div>
      <div><strong>${money(saved)}</strong>${img? `<div>${img}</div>`:""}</div>
    </li>`;
  }).join('') || '<li class="helper">Ingen registreringer enda.</li>';

  // Leaderboard
  const lb = await Storage.listMonth(new Date());
  els.lbTable.innerHTML = lb.map((row, idx)=> `<tr><td>${idx+1}</td><td>${row.name}</td><td>${row.count}</td><td>${money(row.total)}</td></tr>`).join('');
}

// ===== Export / Reset =====
function exportCsv(){
  Storage.listAll().then(items=>{
    const header = "dato,navn,butikk,vare,kategori,belop,rabatt_prosent,spart,notat\n";
    const prof = readLS(LS.profile,{name:'Meg'});
    const rows = items.map(i=>{
      const saved = Number(i.amount||0)*(Number(i.discount||0)/100);
      return `${i.date},${(prof.name||'Meg')},${i.merchant},${i.item},${i.category||''},${i.amount},${i.discount},${saved},"${(i.note||'').replace(/\"/g,'\"')}"`;
    }).join("\n");
    const blob = new Blob([header + rows], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "tenksmart-data.csv"; a.click();
    URL.revokeObjectURL(url);
  });
}

function resetAll(){
  if(!confirm("Sikker? Sletter lokal profil og data (Firebase-data beholdes).")) return;
  localStorage.removeItem(LS.data);
  localStorage.removeItem(LS.profile);
  localStorage.removeItem(LS.first);
  renderAll();
}

// ===== Optional: copy affiliate codes (harmløs hvis ingen knapper finnes) =====
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.copy-code');
  if (!btn) return;
  const code = btn.getAttribute('data-code');
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    const old = btn.textContent;
    btn.textContent = 'Kopiert!';
    setTimeout(() => (btn.textContent = old), 1200);
  });
});

// ===== Init =====
(async function init(){
  greet();
  loadProfileToUI();
  wireForm();
  await Storage.seedDemo();
  renderAll();
})();
