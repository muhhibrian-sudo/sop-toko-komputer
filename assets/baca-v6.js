(() => {
'use strict';
const $ = id => document.getElementById(id);
const source = window.SOP_DEFAULT;
if (!source || !Array.isArray(source.sections)) {
  document.body.innerHTML = '<div style="padding:4rem;font-family:sans-serif">Data SOP tidak ditemukan. Pastikan folder <b>data</b> dan file <b>data/sop.js</b> tersedia.</div>';
  return;
}
const LAST_KEY = 'sopbook-v4-last';
const MARKS_KEY = 'sopbook-v4-marks';
let model = JSON.parse(JSON.stringify(source));
let saved = new Set();
try {const marks = JSON.parse(localStorage.getItem(MARKS_KEY)||'[]');if(Array.isArray(marks))saved=new Set(marks);}catch(_){}
let activeId = '', activeCategory = 'all', toastTimer = 0, overlayMode = '', touchStart = null;
const groups = [
  {id:'all',name:'Semua judul',short:'Semua',shade:'#e6ddff',ink:'#4939a8',icon:'✳'},
  {id:'dasar',name:'Panduan dasar',short:'Dasar',shade:'#eee4ff',ink:'#5137ab',icon:'✦'},
  {id:'layanan',name:'Penjualan & servis',short:'Layanan',shade:'#ffe4d6',ink:'#af6341',icon:'✺'},
  {id:'operasional',name:'Operasional toko',short:'Operasional',shade:'#d7f2e2',ink:'#37795d',icon:'✶'},
  {id:'evaluasi',name:'Evaluasi & alur',short:'Evaluasi',shade:'#dce8ff',ink:'#436cbb',icon:'✷'},
  {id:'lampiran',name:'Formulir lampiran',short:'Lampiran',shade:'#f6e1ef',ink:'#975582',icon:'✣'},
  {id:'dokumen',name:'Informasi dokumen',short:'Dokumen',shade:'#e7e5e1',ink:'#6e6259',icon:'◈'},
  {id:'tambahan',name:'SOP tambahan',short:'Tambahan',shade:'#e5dffb',ink:'#654de5',icon:'✻'}
];
const num = section => {const match = section.title.match(/^(\d+)\s*\./);return match ? Number(match[1]) : 0;};
const clean = section => section.title.replace(/^\d+\s*\.\s*/,'').replace(/^LAMPIRAN\s+\d+\s*\.\s*/i,'').replace(/^SOP\s+/i,'').replace(/\s+/g,' ').trim();
const label = section => section.title.startsWith('LAMPIRAN') ? (section.title.match(/^LAMPIRAN\s+\d+/i)||['LAMPIRAN'])[0] : num(section) ? `SOP ${String(num(section)).padStart(2,'0')}` : 'DOKUMEN';
const categoryOf = section => {if(section.category && groups.some(g=>g.id===section.category))return section.category;const n=num(section);if(n>=1&&n<=3)return'dasar';if(n>=4&&n<=11)return'layanan';if(n>=12&&n<=16)return'operasional';if(n>=17&&n<=18)return'evaluasi';if(n>18)return'tambahan';if(/^LAMPIRAN/i.test(section.title))return'lampiran';return'dokumen';};
const groupInfo = id => groups.find(g=>g.id===id)||groups[0];
const chapters = () => {
  const main=model.sections.filter(sec=>num(sec)>0);
  const annex=model.sections.filter(sec=>/^LAMPIRAN/i.test(sec.title));
  const misc=model.sections.filter(sec=>!main.includes(sec)&&!annex.includes(sec));
  return [...main,...annex,...misc];
};
const findSection = id => chapters().find(s=>s.id===id);
const description = sec => {
  const p=sec.blocks.find(b=>b.type==='paragraph' || b.type==='list');
  return p?.text ? p.text.slice(0,145).replace(/\s+/g,' ').trim() : 'Baca prosedur dan pedoman lengkap pada judul ini.';
};
const E=(tag,klass,text)=>{const el=document.createElement(tag);if(klass)el.className=klass;if(text!==undefined)el.textContent=String(text);return el;};
const append=(parent,...nodes)=>{nodes.forEach(n=>parent.append(n));return parent;};
const button=(klass,text,callback)=>{const el=E('button',klass,text);el.type='button';el.addEventListener('click',callback);return el;};
const noScroll=()=>document.body.style.overflow='';
const jumpTop=()=>window.scrollTo({top:0,behavior:'instant'});
const notify=message=>{const node=$('toast');node.textContent=message;node.hidden=false;window.clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>node.hidden=true,3400);};
const show = (id,visible) => $(id).hidden=!visible;
const isHome=()=>!activeId;
function coverStyle(section,index){const g=groupInfo(categoryOf(section));return {bg:g.shade,ink:g.ink,icon:g.icon,ordinal:num(section)||index+1};}
function syncUrlHome(){if(location.hash!=='#beranda')history.pushState(null,'','#beranda');}
function syncUrlChapter(sec){const hash='#baca/'+encodeURIComponent(sec.id);if(location.hash!==hash)history.pushState(null,'',hash);}
function home(opts={}){
  activeId='';
  show('homeView',true);show('readerView',false);$('globalProgress').style.width='0%';
  closeModal();syncUrlHome();renderLibrary();
  if(opts.toLibrary){$('librarySection').scrollIntoView({block:'start',behavior:'instant'});}else{jumpTop();}
}
function filteredChapters(){const all=chapters();return activeCategory==='all'?all:all.filter(sec=>categoryOf(sec)===activeCategory);}
function renderCategories(){
  const container=$('categoryPills');container.replaceChildren();
  for(const g of groups){if(g.id==='tambahan'&&!chapters().some(s=>categoryOf(s)==='tambahan'))continue;
    const qty=g.id==='all'?chapters().length:chapters().filter(s=>categoryOf(s)===g.id).length;
    const el=button('',g.short+(g.id!=='all'?` · ${qty}`:''),()=>{activeCategory=g.id;renderLibrary();});
    el.setAttribute('role','tab');el.setAttribute('aria-selected',String(activeCategory===g.id));if(activeCategory===g.id)el.classList.add('active');container.append(el);
  }
}
function renderLibrary(){
  renderCategories();const list=filteredChapters(),all=chapters();
  $('libraryCount').textContent=`MENAMPILKAN ${list.length} DARI ${all.length} JUDUL`;
  const grid=$('booksGrid');grid.replaceChildren();show('noResults',list.length===0);
  list.forEach((section,index)=>{
    const info=coverStyle(section,index);const card=button('book-card','',()=>open(section.id));
    const cover=E('div','mini-cover');cover.style.setProperty('--cover-bg',info.bg);cover.style.setProperty('--cover-ink',info.ink);
    append(cover,E('span','mini-num',label(section)),E('span','mini-symbol',info.icon),E('div','mini-word',clean(section)),E('span','mini-type','DOKUMEN SOP'));
    const meta=E('div','book-meta');append(meta,E('small','',groupInfo(categoryOf(section)).name),E('h3','',section.title));
    const footer=E('div','book-footer');append(footer,E('span','',saved.has(section.id)?'♥ Disimpan':'Buka & baca'),E('span','go','↗'));meta.append(footer);
    card.append(cover,meta);grid.append(card);
  });
  // Anchor UI on category change without automatically starting the reader.
}
function renderRail(){
  const rail=$('chapterRail');rail.replaceChildren();let prev='';
  chapters().forEach((section,i)=>{const cat=categoryOf(section);if(prev!==cat){rail.append(E('div','rail-separator',groupInfo(cat).name.toUpperCase()));prev=cat;}
    const entry=button('rail-item'+(activeId===section.id?' active':''),'',()=>open(section.id));
    append(entry,E('span','',String(i+1).padStart(2,'0')),E('strong','',clean(section)));rail.append(entry);
  });
  $('railTotal').textContent=chapters().length;
}
function renderBlock(section,block){
  if(block.type==='heading'){
    const h=E('h2','subhead',block.text||'');return h;
  }
  if(block.type==='paragraph'){
    const p=E('p','',block.text||'');return p;
  }
  if(block.type==='list'){
    const div=E('div','point');const mark=E('span','bullet','✦');const p=E('p','',block.text||'');append(div,mark,p);return div;
  }
  if(block.type==='table'){
    const outer=E('div','table-scroll');const table=E('table');const rows=block.rows||[];
    rows.forEach((row,ri)=>{const tr=E('tr');row.forEach((txt,ci)=>{
      const node=E(ri===0?'th':'td','',txt??'');tr.append(node);
    });(ri===0 ? (table.tHead||table.createTHead()) : (table.tBodies[0]||table.createTBody())).append(tr);});
    outer.append(table);return outer;
  }
  return E('p','',block.text||'');
}

function renderReaderTabs(){
  const catbar=$('readerCategoryPills'),tabbar=$('readerChapterTabs');
  catbar.replaceChildren();tabbar.replaceChildren();
  const section=findSection(activeId);if(!section)return;
  const current=categoryOf(section);
  // Categories requested to remain visible; omit global "Semua judul" navigation.
  for(const group of groups){
    if(group.id==='all' || group.id==='evaluasi' || (group.id==='tambahan'&&!chapters().some(s=>categoryOf(s)==='tambahan'))) continue;
    const first=chapters().find(s=>categoryOf(s)===group.id);if(!first)continue;
    const el=button('reader-category'+(current===group.id?' active':''),group.name,()=>open(first.id));
    el.setAttribute('aria-current',current===group.id?'true':'false');catbar.append(el);
  }
  chapters().filter(s=>categoryOf(s)===current).forEach((sec,i)=>{
    const el=button('reader-chapter-tab'+(sec.id===activeId?' active':''),clean(sec),()=>open(sec.id));
    el.title=sec.title;tabbar.append(el);
  });
  const selected=tabbar.querySelector('.active');if(selected)selected.scrollIntoView({inline:'nearest',block:'nearest'});
}

function renderPaper(){
  const s=findSection(activeId);if(!s)return;
  const list=chapters(),index=list.findIndex(x=>x.id===activeId);
  const chapterNo=String(index+1).padStart(2,'0');
  $('chapterLabel').textContent=label(s);$('chapterLength').textContent='PANDUAN SOP';
  const title=$('paperTitle');title.textContent=clean(s);
  const article=$('articleContent');article.replaceChildren();s.blocks.forEach(b=>article.append(renderBlock(s,b)));
  $('chapterPosition').textContent=`${chapterNo} / ${list.length}`;
  const prev=list[index-1],next=list[index+1];$('chapterPrevious').disabled=!prev;$('chapterNext').disabled=!next;
  $('mobilePrevious').disabled=!prev;$('mobileNext').disabled=!next;
  $('previousTitle').textContent=prev?clean(prev):'Awal pustaka';$('nextTitle').textContent=next?clean(next):'Akhir pustaka';
  const liked=saved.has(s.id);$('saveBookmark').innerHTML=liked?'♥ <span>Disimpan</span>':'♡ <span>Simpan</span>';
  $('saveBookmark').classList.toggle('is-saved',liked);
  renderRail();renderReaderTabs();
}
function open(id,opts={}){
  const section=findSection(id);if(!section)return;
  activeId=id;show('homeView',false);show('readerView',true);syncUrlChapter(section);renderPaper();closeModal();
  try{localStorage.setItem(LAST_KEY,id);}catch(_){}
  jumpTop();progress();
}
function move(dir){
  const list=chapters();const pos=list.findIndex(s=>s.id===activeId);const target=list[pos+dir];
  if(target)open(target.id);else notify(dir>0?'Anda sudah berada pada judul terakhir.':'Anda sudah berada pada judul pertama.');
}
function progress(){
  if(!activeId){$('globalProgress').style.width='0%';return;}
  const root=document.documentElement;const max=Math.max(1,root.scrollHeight-window.innerHeight);
  const rate=Math.min(100,Math.max(0,(window.scrollY/max)*100));$('globalProgress').style.width=rate+'%';
}
function openDrawer(){closeModal();overlayMode='drawer';show('overlay',true);show('drawer',true);document.body.style.overflow='hidden';
 const list=$('drawerList');list.replaceChildren();let prev='';chapters().forEach((sec,i)=>{const cat=categoryOf(sec);if(prev!==cat){list.append(E('div','drawer-category',groupInfo(cat).name.toUpperCase()));prev=cat;}
 const item=button('drawer-item','',()=>open(sec.id));append(item,E('span','',String(i+1).padStart(2,'0')),E('strong','',sec.title));list.append(item);});
}
function searchContent(sec,q){return `${sec.title} ${sec.blocks.map(b=>b.type==='table'?b.rows.flat().join(' '):b.text||'').join(' ')}`.toLocaleLowerCase('id-ID').includes(q);}
function renderSearchResults(){
 const query=$('globalSearch').value.toLocaleLowerCase('id-ID').trim();const box=$('searchResults');box.replaceChildren();
 const matched=chapters().filter(s=>!query||searchContent(s,query)).slice(0,30);
 matched.forEach(sec=>{const entry=button('search-item','',()=>{activeCategory='all';open(sec.id);});append(entry,E('small','',groupInfo(categoryOf(sec)).name.toUpperCase()),E('strong','',sec.title),E('p','',description(sec)));box.append(entry);});
 if(!matched.length)box.append(E('p','', 'Tidak ada judul yang cocok. Coba kata kunci lainnya.'));
}
function openSearch(){closeModal();overlayMode='search';show('overlay',true);show('searchPanel',true);document.body.style.overflow='hidden';$('globalSearch').value='';renderSearchResults();$('globalSearch').focus();}
function closeModal(){show('overlay',false);show('drawer',false);show('searchPanel',false);overlayMode='';noScroll();}
function handleHash(){
 const h=decodeURIComponent(location.hash||'');if(h.startsWith('#baca/')){const id=h.slice('#baca/'.length);if(findSection(id))open(id);else home();}else home();
}
function bindEvents(){
 $('startReading').addEventListener('click',()=>open(chapters()[0].id));
 $('continueReading').addEventListener('click',()=>{let id;try{id=localStorage.getItem(LAST_KEY);}catch(_){}open(findSection(id)?id:chapters()[0].id);});

 ['railHome','mobileHome'].forEach(id=>$(id).addEventListener('click',()=>home({toLibrary:true})));
 ['chapterPrevious','mobilePrevious'].forEach(id=>$(id).addEventListener('click',()=>move(-1)));
 ['chapterNext','mobileNext'].forEach(id=>$(id).addEventListener('click',()=>move(1)));
 ['openChapters','mobileChapters'].forEach(id=>$(id).addEventListener('click',openDrawer));$('drawerClose').addEventListener('click',closeModal);
 ['homeSearch','railSearch','drawerSearch','mobileSearch'].forEach(id=>$(id).addEventListener('click',openSearch));$('closeSearch').addEventListener('click',closeModal);$('globalSearch').addEventListener('input',renderSearchResults);
 $('overlay').addEventListener('click',closeModal);
 $('saveBookmark').addEventListener('click',()=>{if(!activeId)return;if(saved.has(activeId))saved.delete(activeId);else saved.add(activeId);try{localStorage.setItem(MARKS_KEY,JSON.stringify([...saved]));}catch(_){}renderPaper();notify(saved.has(activeId)?'Judul ditandai sebagai favorit.':'Tanda favorit dihapus.');});
 window.addEventListener('scroll',progress,{passive:true});
 window.addEventListener('popstate',handleHash);window.addEventListener('hashchange',handleHash);
 document.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&overlayMode)closeModal();
   if(e.key.toLowerCase()==='k'&&(e.ctrlKey||e.metaKey)){e.preventDefault();openSearch();}
   if(activeId&&!overlayMode&&e.altKey&&e.key==='ArrowRight'){e.preventDefault();move(1);}
   if(activeId&&!overlayMode&&e.altKey&&e.key==='ArrowLeft'){e.preventDefault();move(-1);}
 });
 const main=$('storyPaper');
 main.addEventListener('touchstart',ev=>{
   const t=ev.changedTouches?.[0];if(!t||ev.target.closest('table,.table-scroll,[contenteditable="true"],[contenteditable="plaintext-only"]'))return;
   touchStart={x:t.clientX,y:t.clientY,time:Date.now()};
 },{passive:true});
 main.addEventListener('touchend',ev=>{
   if(!touchStart||!activeId){touchStart=null;return;}
   const t=ev.changedTouches?.[0];if(!t)return;
   const dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y,elapsed=Date.now()-touchStart.time;
   touchStart=null;
   // Vertical reading has priority. A deliberate horizontal swipe changes titles.
   if(Math.abs(dx)>=72&&Math.abs(dx)>Math.abs(dy)*1.7&&elapsed<1200)move(dx<0?1:-1);
 },{passive:true});
}
window.SOP_APP = {
 getData:()=>JSON.parse(JSON.stringify(model)),
 getCurrentId:()=>activeId,
 getGroups:()=>groups.filter(g=>g.id!=='all').map(g=>({id:g.id,name:g.name})),
 setData:(next)=>{
   if(!next||!Array.isArray(next.sections))throw new Error('Format data SOP tidak valid');
   model=JSON.parse(JSON.stringify(next));
   const id=activeId;
   renderLibrary();
   if(id&&findSection(id)){renderPaper();progress();}
   else if(id){home({toLibrary:false});}else{renderLibrary();}
 }
};
bindEvents();renderLibrary();handleHash();
})();
