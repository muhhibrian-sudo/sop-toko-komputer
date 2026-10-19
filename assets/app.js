(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const DEFAULT = window.SOP_DEFAULT;
  if (!DEFAULT || !Array.isArray(DEFAULT.sections)) {
    document.body.textContent = 'Data SOP tidak ditemukan. Pastikan berkas data/sop.js ikut diunggah.';
    return;
  }
  const KEY='soppedia-draft-v1'; // Tetap memakai kunci draf versi lama agar perubahan tidak hilang.
  const deepCopy = value => JSON.parse(JSON.stringify(value));
  const isValid = a => a && typeof a.name === 'string' && Array.isArray(a.sections) && a.sections.every(s => typeof s.id === 'string' && typeof s.title === 'string' && Array.isArray(s.blocks));
  const categories = [
    {name:'Panduan Dasar',number:'01',icon:'◎',color:'lavender',description:'Tujuan, pembagian peran, dan kesiapan operasional.',min:1,max:3},
    {name:'Penjualan & Servis',number:'02',icon:'✳',color:'orange',description:'Pelanggan, penerimaan, diagnosa, QC dan garansi.',min:4,max:11},
    {name:'Stok & Keuangan',number:'03',icon:'▣',color:'mint',description:'Persediaan, kas harian, layanan dan komplain.',min:12,max:16},
    {name:'Dokumen & Lampiran',number:'04',icon:'▤',color:'blue',description:'Indikator kinerja, alur proses, dan formulir.',min:17,max:18}
  ];
  let model=deepCopy(DEFAULT), mode='home', currentId='', searchText='', editMode=false, toastTimer, showAll=false;
  const READING_KEY='sopspace-last-read-v3', PROGRESS_KEY='sopspace-progress-v3';
  let readProgress={},touchStart=null,scrollQueued=false;
  try{readProgress=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'{}')||{};}catch{readProgress={};}
  try {const raw=localStorage.getItem(KEY); if(raw){const parsed=JSON.parse(raw);if(isValid(parsed))model=parsed;}} catch(err) {console.warn('Draf lokal tidak tersedia',err);}
  function hasDraft(){try{return Boolean(localStorage.getItem(KEY));}catch{return false;}}
  function make(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined&&text!==null)el.textContent=String(text);return el;}
  function append(parent,...nodes){for(const n of nodes)parent.append(n);return parent;}
  function clip(text,max=135){const s=String(text||'').replace(/\s+/g,' ').trim();return s.length>max?s.slice(0,max-1).trim()+'…':s;}
  function numberOf(s){const m=s.title.match(/^(\d+)\s*\./);return m?Number(m[1]):0;}
  function docs(){return model.sections.filter(s=>numberOf(s)>0);}
  function forms(){return model.sections.filter(s=>/^LAMPIRAN\s+\d+\./i.test(s.title));}
  function firstParagraph(s){return s.blocks.find(b=>b.type==='paragraph')?.text||s.blocks.find(b=>b.type==='list')?.text||'Lihat rincian panduan dan ketentuan dalam bagian ini.';}
  function titleClean(s){return s.title.replace(/^\d+\s*\.\s*/,'').replace(/^LAMPIRAN\s+\d+\s*\.\s*/i,'');}
  function bText(b){return b.type==='table'?(b.rows||[]).map(r=>r.join(' ')).join(' '):b.text||'';}
  function matches(s,q){return (s.title+' '+s.blocks.map(bText).join(' ')).toLocaleLowerCase('id-ID').includes(q.toLocaleLowerCase('id-ID'));}
  function sectionGroup(s){const n=numberOf(s);if(s.kind==='cover'||['LEMBAR KENDALI DOKUMEN','DAFTAR ISI'].includes(s.title))return'DOKUMEN UTAMA';if(/^LAMPIRAN/i.test(s.title))return'FORMULIR & LAMPIRAN';if(n<=3&&n>0)return'PANDUAN DASAR';if(n<=11&&n>0)return'PENJUALAN & SERVIS';if(n<=16&&n>0)return'STOK & OPERASIONAL';return'KENDALI & LAPORAN';}
  function categoryOf(s){const n=numberOf(s);if(n>0){return categories.find(c=>n>=c.min&&n<=c.max)?.name||'Prosedur'}return/^LAMPIRAN/i.test(s.title)?'Formulir':'Dokumen';}
  function iconButton(symbol,cls,handler,label){const btn=make('button',cls,symbol);btn.type='button';btn.onclick=handler;if(label)btn.setAttribute('aria-label',label);return btn;}
  function toast(message){const t=$('toast');t.textContent=message;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true;},3400);}
  function saveDraft(){try{localStorage.setItem(KEY,JSON.stringify(model));$('draftStatus').textContent='Draf tersimpan · '+new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});}catch(err){toast('Gagal menyimpan di browser. Segera unduh revisi.');}}
  function closeSidebar(){$('sidebar').classList.remove('open');$('sideBackdrop').hidden=true;}
  function renderNav(){
    const nav=$('navigation');nav.replaceChildren();let prevGroup='';
    const all=make('button','nav-item nav-all'+(showAll&&mode==='reader'?' active':''));
    append(all,make('span','nav-number','▦'),make('span','nav-copy','Daftar semua judul'));
    all.onclick=()=>openChapterPicker();nav.append(all);
    for(const s of model.sections){
      const group=sectionGroup(s);
      if(group!==prevGroup){nav.append(make('div','sidebar-caption nav-caption',group));prevGroup=group;}
      const active=mode==='reader'&&!showAll&&currentId===s.id;
      const btn=make('button','nav-item'+(active?' active':''));btn.type='button';btn.title=s.title;
      const prefix=numberOf(s)||(/^LAMPIRAN\s+(\d+)/i.exec(s.title)?.[1]||'•');
      append(btn,make('span','nav-number',String(prefix).padStart(2,'0')),make('span','nav-copy',titleClean(s)));
      btn.onclick=()=>select(s.id);nav.append(btn);
    }
    $('homeLink').classList.toggle('active',mode==='home');
    $('totalSop').textContent=docs().length;
    $('totalForms').textContent=forms().length;
  }
  function dashboardCard(c){
    const s=docs().find(x=>numberOf(x)===c.min)||docs()[0];const count=docs().filter(x=>numberOf(x)>=c.min&&numberOf(x)<=c.max).length;
    const card=make('button',`category-card cat-${c.color}`);card.type='button';
    const upper=make('div','cat-upper');append(upper,make('span','cat-icon',c.icon),make('span','cat-index',c.number+' / 04'));
    const lower=make('div','cat-lower');append(lower,make('span','cat-count',count+' TOPIK'),make('h3','',c.name),make('p','',c.description),make('span','cat-bottom','Lihat topik  ↗'));
    append(card,upper,lower);card.onclick=()=>select(s.id);return card;
  }
  function renderDashboard(){
    const grid=$('categoryGrid');grid.replaceChildren(...categories.map(dashboardCard));
    const quick=$('quickGrid');quick.replaceChildren();
    const picks=[{n:5,name:'Penerimaan Servis',description:'Data unit, kondisi awal & nomor servis',icon:'⌁'},
      {n:7,name:'Konfirmasi Biaya',description:'Persetujuan sebelum pengerjaan',icon:'✓'},
      {n:9,name:'Quality Control',description:'Checklist pengujian perangkat',icon:'◈'},
      {n:12,name:'Pengelolaan Stok',description:'Barang masuk, keluar & opname',icon:'▤'}];
    for(const pick of picks){const s=docs().find(x=>numberOf(x)===pick.n);if(!s)continue;
      const btn=make('button','quick-card');append(btn,make('span','quick-symbol',pick.icon));const copy=make('span','quick-copy');append(copy,make('strong','',pick.name),make('small','',pick.description));append(btn,copy,make('span','quick-go','↗'));btn.onclick=()=>select(s.id);quick.append(btn);}
  }
  function highlight(element,text){
    const hay=String(text||'');if(!searchText){element.textContent=hay;return;}
    const needle=searchText.trim();let i=0,lower=hay.toLocaleLowerCase('id-ID'),seek=needle.toLocaleLowerCase('id-ID');
    while(i<hay.length){const pos=lower.indexOf(seek,i);if(pos<0){element.append(document.createTextNode(hay.slice(i)));break;}if(pos>i)element.append(document.createTextNode(hay.slice(i,pos)));element.append(make('mark','',hay.slice(pos,pos+needle.length)));i=pos+needle.length;}
  }
  function tableNode(block){
    const scroller=make('div','table-scroller');const table=make('table','sop-table');const rows=block.rows||[];
    const isKV=rows.length>1&&rows[0]?.length===2&&(/versi dokumen|nomor servis|tanggal masuk|nama dokumen/i).test(String(rows[0][0]));
    if(isKV)table.classList.add('key-value-table');
    for(const [i,row] of rows.entries()){
      const tr=document.createElement('tr');for(const cell of row){const td=document.createElement((i===0&&!isKV&&rows.length>2)?'th':'td');highlight(td,String(cell||''));if(td.tagName==='TH')td.scope='col';tr.append(td);}table.append(tr);
    }scroller.append(table);return scroller;
  }
  function blockNode(block,index=0,lead=false){
    if(block.type==='table')return tableNode(block);
    const type=block.type==='heading'?'heading':block.type==='list'?'list':'paragraph';
    const wrapper=make('div','sop-block block-'+type+(lead&&type==='paragraph'?' block-lead':''));
    if(type==='list'){
      wrapper.append(make('span','list-bullet','✓'));const copy=make('div','block-copy');highlight(copy,block.text||'');wrapper.append(copy);
    }else if(type==='heading'){
      wrapper.append(make('span','heading-glyph','✳'));const copy=make('span','heading-text');highlight(copy,block.text||'');wrapper.append(copy);
    }else if(lead){wrapper.append(make('span','lead-label','RINGKASAN'));const copy=make('p','');highlight(copy,block.text||'');wrapper.append(copy);
    }else highlight(wrapper,block.text||'');
    return wrapper;
  }
  function editControl(label,fn,cls=''){return iconButton(label,cls,fn);}
  function changeBlock(section,blockIndex,wrap){
    const block=section.blocks[blockIndex];wrap.replaceChildren();
    if(block.type==='table'){
      const frame=make('div','table-editor'),table=make('table');const grid=[];
      for(const row of block.rows||[]){const tr=document.createElement('tr'),inputs=[];for(const cell of row){const td=document.createElement('td'),input=document.createElement('input');input.value=String(cell||'');td.append(input);tr.append(td);inputs.push(input);}table.append(tr);grid.push(inputs);}frame.append(table);wrap.append(frame);
      const footer=make('div','edit-controls');footer.append(editControl('+ Baris',()=>{const tr=document.createElement('tr'),cells=[];for(let i=0;i<(grid[0]?.length||2);i++){const td=document.createElement('td'),input=document.createElement('input');td.append(input);tr.append(td);cells.push(input);}table.append(tr);grid.push(cells);}),editControl('+ Kolom',()=>{for(let i=0;i<grid.length;i++){const td=document.createElement('td'),input=document.createElement('input');td.append(input);table.rows[i].append(td);grid[i].push(input);}}));
      footer.append(editControl('✓ Simpan',()=>{block.rows=grid.map(row=>row.map(input=>input.value));saveDraft();render();toast('Tabel diperbarui.');}),editControl('Batal',render));wrap.append(footer);
    }else{
      const input=make('textarea','field-editor');input.value=block.text||'';input.rows=Math.max(3,Math.min(12,Math.ceil(input.value.length/75)+1));wrap.append(input);
      const footer=make('div','edit-controls');footer.append(editControl('✓ Simpan',()=>{block.text=input.value;saveDraft();render();toast('Teks diperbarui.');}),editControl('Batal',render));wrap.append(footer);input.focus();
    }
  }
  function moveBlock(section,index,dir){const other=index+dir;if(other<0||other>=section.blocks.length){toast('Sudah di batas bagian.');return;}[section.blocks[index],section.blocks[other]]=[section.blocks[other],section.blocks[index]];saveDraft();render();}
  function editedBlock(section,index){
    const block=section.blocks[index],wrap=make('div','block-edit-wrap'),controls=make('div','block-controls');
    controls.append(editControl('✎ Ubah',()=>changeBlock(section,index,wrap)),editControl('↑',()=>moveBlock(section,index,-1)),editControl('↓',()=>moveBlock(section,index,1)),editControl('× Hapus',()=>{if(confirm('Hapus teks atau tabel ini?')){section.blocks.splice(index,1);saveDraft();render();}},'delete-btn'));
    wrap.append(controls,blockNode(block,index,index===0&&block.type==='paragraph'));return wrap;
  }
  function contentFor(section,editing){const content=make('div','sop-content');if(!section.blocks.length){content.append(make('p','empty-card','Bagian ini belum memiliki isi. Gunakan tombol tambah untuk melengkapinya.'));return content;}
    for(let i=0;i<section.blocks.length;i++){const block=section.blocks[i];const el=editing?editedBlock(section,i):blockNode(block,i,i===0&&block.type==='paragraph');if(block.type==='heading')el.id='bagian-'+i;content.append(el);}return content;
  }
  function getCurrent(){return model.sections.find(s=>s.id===currentId)||model.sections[0];}
  function renderAside(section){
    const aside=$('sectionAside');aside.replaceChildren();if(showAll){aside.hidden=true;return;}aside.hidden=false;
    const panel=make('div','aside-box');append(panel,make('div','aside-caption','DALAM BAGIAN INI'));
    const headings=section.blocks.map((b,i)=>({b,i})).filter(x=>x.b.type==='heading');
    if(headings.length){for(const {b,i} of headings){const a=make('button','aside-link',b.text);a.onclick=()=>document.getElementById('bagian-'+i)?.scrollIntoView({behavior:'smooth',block:'center'});panel.append(a);}}
    else panel.append(make('p','aside-placeholder','Lihat isi panduan lengkap di sebelah kiri.'));
    append(panel,make('div','aside-divider'));
    const s=make('div','aside-help');append(s,make('span','help-icon','☷'),make('strong','','Dokumen SOP'),make('p','','Gunakan menu di sisi kiri untuk pindah antarbagian.'));
    panel.append(s);aside.append(panel);
  }
  function renderPagination(section){const nav=$('readerPagination');nav.replaceChildren();if(showAll)return;
    const at=model.sections.findIndex(s=>s.id===section.id),p=model.sections[at-1],n=model.sections[at+1];
    if(p){const b=make('button','page-control prev');append(b,make('span','','← SEBELUMNYA'),make('strong','',titleClean(p)));b.onclick=()=>select(p.id);nav.append(b);}
    if(n){const b=make('button','page-control next');append(b,make('span','','SELANJUTNYA →'),make('strong','',titleClean(n)));b.onclick=()=>select(n.id);nav.append(b);}
  }

  const readerCategories=[
    {id:'intro',name:'Pendahuluan',short:'Mulai',emoji:'✦'},
    {id:'dasar',name:'Panduan Dasar',short:'Dasar',emoji:'◎'},
    {id:'servis',name:'Penjualan & Servis',short:'Servis',emoji:'✳'},
    {id:'operasional',name:'Stok & Operasional',short:'Operasional',emoji:'▣'},
    {id:'lampiran',name:'Dokumen & Lampiran',short:'Lampiran',emoji:'▤'},
    {id:'tambahan',name:'SOP Tambahan',short:'Tambahan',emoji:'+'}
  ];
  function readerGroup(section){
    const n=numberOf(section);
    if(['sampul','lembar-kendali-dokumen','daftar-isi'].includes(section.id))return 'intro';
    if(n>0&&n<=3)return 'dasar';
    if(n>=4&&n<=11)return 'servis';
    if(n>=12&&n<=16)return 'operasional';
    if(n>=17||/^LAMPIRAN/i.test(section.title))return 'lampiran';
    return 'tambahan';
  }
  function chapterLabel(section){const n=numberOf(section);const lamp=/^LAMPIRAN\s+(\d+)/i.exec(section.title);return n?String(n).padStart(2,'0'):lamp?'L'+String(lamp[1]).padStart(2,'0'):'✦';}
  function renderReaderTabs(section){
    const groupId=readerGroup(section),categoryArea=$('categoryTabs'),chapterArea=$('chapterTabs');
    categoryArea.replaceChildren();
    const occupied=new Set(model.sections.map(readerGroup));
    for(const cat of readerCategories.filter(x=>occupied.has(x.id))){
      const active=cat.id===groupId;const button=make('button','category-tab'+(active?' active':''));
      button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-selected',String(active));
      append(button,make('span','category-emoji',cat.emoji),make('span','',cat.name));
      button.onclick=()=>{const target=model.sections.find(x=>readerGroup(x)===cat.id);if(target)select(target.id);};
      categoryArea.append(button);
      if(active)requestAnimationFrame(()=>centerChip(categoryArea,button));
    }
    chapterArea.replaceChildren();
    for(const s of model.sections.filter(x=>readerGroup(x)===groupId)){
      const active=s.id===section.id;const button=make('button','chapter-tab'+(active?' active':'')+(readProgress[s.id]>=95?' finished':''));
      button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-selected',String(active));
      button.title=s.title;
      append(button,make('span','tab-chapter-number',chapterLabel(s)),make('span','tab-chapter-name',titleClean(s)));
      button.onclick=()=>select(s.id);
      chapterArea.append(button);
      if(active)requestAnimationFrame(()=>centerChip(chapterArea,button));
    }
    const i=model.sections.findIndex(x=>x.id===section.id);
    $('dockChapter').textContent='JUDUL '+(i+1)+' / '+model.sections.length;
    $('dockChapterTitle').textContent=titleClean(section);
    $('dockPrev').disabled=i<=0;$('dockNext').disabled=i>=model.sections.length-1;
    $('readingDock').hidden=false;
  }
  function centerChip(parent,chip){if(!parent.contains(chip))return;parent.scrollTo({left:Math.max(0,chip.offsetLeft-parent.offsetLeft-parent.clientWidth/2+chip.offsetWidth/2),behavior:'smooth'});}
  function moveChapter(steps){
    if(mode!=='reader'||showAll||editMode||searchText)return;
    const idx=model.sections.findIndex(s=>s.id===currentId), next=model.sections[idx+steps];
    if(next)select(next.id);else toast(steps>0?'Ini judul terakhir.':'Ini judul pertama.');
  }
  function openChapterPicker(){
    const parent=$('chapterPickerGrid');parent.replaceChildren();
    const occupied=new Set(model.sections.map(readerGroup));
    for(const cat of readerCategories.filter(c=>occupied.has(c.id))){
      const sections=model.sections.filter(s=>readerGroup(s)===cat.id);
      const group=make('section','picker-group');append(group,make('h3','',cat.emoji+' '+cat.name));
      for(const s of sections){const b=make('button','picker-item');b.type='button';
        append(b,make('span','picker-number',chapterLabel(s)),make('span','picker-name',titleClean(s)),make('span','picker-arrow','↗'));
        b.onclick=()=>{$('chapterDialog').close();select(s.id);};group.append(b);
      }parent.append(group);
    }
    $('chapterDialog').showModal();
  }
  function updateReadingProgress(){
    if(mode!=='reader'||showAll||searchText||$('reader').hidden)return;
    const node=$('documentArea');const rect=node.getBoundingClientRect();
    const start=window.scrollY+rect.top-window.innerHeight*.63;
    const end=window.scrollY+rect.bottom-window.innerHeight*.48;
    const pos=Math.max(0,Math.min(100,Math.round((window.scrollY-start)/Math.max(1,end-start)*100)));
    $('chapterProgress').style.width=pos+'%';$('dockProgress').style.width=pos+'%';
    document.body.classList.toggle('reader-compact',window.scrollY>300&&!editMode);
    if(Math.abs((readProgress[currentId]||0)-pos)>1){readProgress[currentId]=pos;try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(readProgress));}catch{}}
  }
  function queueReadingProgress(){if(scrollQueued)return;scrollQueued=true;requestAnimationFrame(()=>{scrollQueued=false;updateReadingProgress();});}
  function onTouchStart(event){
    if(mode!=='reader'||showAll||editMode||searchText||event.touches.length!==1)return;
    if(event.target.closest('button,a,input,textarea,select,.category-tabs,.chapter-tabs,.table-scroller,.table-editor,[contenteditable]'))return;
    const t=event.touches[0];if(t.clientX<24||t.clientX>window.innerWidth-24)return;
    touchStart={x:t.clientX,y:t.clientY,time:Date.now()};
  }
  function onTouchEnd(event){
    if(!touchStart||event.changedTouches.length!==1)return;
    const t=event.changedTouches[0],dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;
    if(Math.abs(dx)>=80&&Math.abs(dx)>Math.abs(dy)*1.5&&Date.now()-touchStart.time<1200)moveChapter(dx<0?1:-1);
    touchStart=null;
  }

  function renderReader(){
    const area=$('documentArea');area.replaceChildren();$('editorToolbar').hidden=!editMode||showAll;
    if(showAll){
      $('breadcrumb').textContent='SELURUH DOKUMEN';$('currentTitle').textContent='Seluruh SOP & Lampiran';$('currentSummary').textContent='Baca semua prosedur dalam satu halaman, atau cetak sebagai dokumen lengkap.';$('readerNumber').textContent='∞';$('readTime').textContent='◷ Seluruh bagian';$('readerIntro').classList.add('reader-all');
      const visible=model.sections;for(const s of visible){const wrap=make('section','full-section');append(wrap,make('div','full-number',numberOf(s)?String(numberOf(s)).padStart(2,'0'):'✦'),make('h2','full-title',s.title),contentFor(s,false));area.append(wrap);}renderAside();renderPagination();
      if(editMode)area.prepend(make('div','editing-hint','Pilih satu bagian pada menu samping untuk mengeditnya.'));
    }else{
      const s=getCurrent(),n=numberOf(s);$('readerIntro').classList.remove('reader-all');$('breadcrumb').textContent='SOP DIGITAL / '+categoryOf(s).toUpperCase();$('currentTitle').textContent=titleClean(s);$('currentSummary').textContent=clip(firstParagraph(s),200);
      $('readerNumber').replaceChildren(document.createTextNode(n?String(n).padStart(2,'0'):'✦'));const tiny=make('span','',n?'/ 18':'/ SOP');$('readerNumber').append(tiny);
      const len=s.blocks.map(bText).join(' ').split(/\s+/).length;$('readTime').textContent='◷ ± '+Math.max(1,Math.ceil(len/180))+' menit baca';
      area.append(contentFor(s,editMode));renderAside(s);renderPagination(s);renderReaderTabs(s);
      requestAnimationFrame(updateReadingProgress);
    }
  }
  function searchCard(s){const b=make('button','search-card');append(b,make('span','search-card-tag',categoryOf(s)),make('h3','',titleClean(s)),make('p','',clip(firstParagraph(s),140)),make('span','search-card-action','Buka dokumen →'));b.onclick=()=>{searchText='';$('searchInput').value='';select(s.id);};return b;}
  function renderSearch(){const matchesList=model.sections.filter(s=>matches(s,searchText));$('searchSubtitle').textContent=matchesList.length+' bagian ditemukan untuk “'+searchText+'”';const grid=$('searchGrid');grid.replaceChildren(...matchesList.map(searchCard));if(!matchesList.length)grid.append(make('div','empty-card','Tidak ada SOP yang cocok. Coba kata kunci lain.'));}
  function render(){
    renderNav();renderDashboard();
    const searching=Boolean(searchText);$('dashboard').hidden=mode!=='home'||searching;$('reader').hidden=mode!=='reader'||searching;$('searchResults').hidden=!searching;
    if(searching)renderSearch();else if(mode==='reader')renderReader();
    document.body.classList.toggle('reading-mode',mode==='reader'&&!showAll&&!searching);
    if(mode!=='reader'||showAll||searching)document.body.classList.remove('reader-compact');
    $('readerNavigator').hidden=showAll||searching||mode!=='reader';
    $('readingDock').hidden=showAll||searching||mode!=='reader';
    $('editBanner').hidden=!editMode;$('editorDock').hidden=!editMode;
    $('editToggle').classList.toggle('editing',editMode);$('editToggle').lastElementChild.textContent=editMode?'Selesai Edit':'Mode Edit';
  }
  function select(id,scroll=true){
    searchText='';$('searchInput').value='';if(id==='home'){mode='home';showAll=false;history.replaceState(null,'','#beranda');}
    else{mode='reader';showAll=id==='all';if(!showAll)currentId=id;history.replaceState(null,'',showAll?'#semua':'#'+encodeURIComponent(id));}
    render();closeSidebar();if(scroll)window.scrollTo(0,0);
    if(mode==='reader'&&!showAll){try{localStorage.setItem(READING_KEY,currentId);}catch{};requestAnimationFrame(updateReadingProgress);}
  }
  function addBlock(type){if(showAll||mode!=='reader')return;const section=getCurrent();let obj;
    if(type==='table')obj={type,rows:[['Kolom 1','Kolom 2'],['','']]};else {const value=prompt(type==='heading'?'Masukkan subjudul:':type==='list'?'Masukkan poin:':'Masukkan paragraf:');if(value===null)return;obj={type,text:value};}section.blocks.push(obj);saveDraft();render();$('documentArea').lastElementChild?.scrollIntoView({behavior:'smooth',block:'end'});
  }
  function addSection(){const title=prompt('Nama SOP atau lampiran baru:');if(!title||!title.trim())return;const id='baru-'+Date.now().toString(36);model.sections.push({id,title:title.trim(),kind:'section',blocks:[{type:'paragraph',text:'Isi SOP baru. Klik Ubah untuk menyunting.'}]});saveDraft();select(id);toast('Bagian baru ditambahkan ke draf.');}
  function exportSop(){const js='/* Konten SOP. Versi revisi yang diunduh dari website. */\nwindow.SOP_DEFAULT = '+JSON.stringify(model,null,2)+';\n';const blob=new Blob([js],{type:'text/javascript;charset=utf-8'}),url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download='sop.js';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('File sop.js diunduh. Perbarui data/sop.js di GitHub untuk menerbitkan.');}
  function importSop(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{let raw=String(reader.result).trim();if(raw.startsWith('/*')){const at=raw.indexOf('window.SOP_DEFAULT');if(at<0)throw Error('Bukan file SOP');raw=raw.slice(raw.indexOf('=',at)+1).trim().replace(/;\s*$/,'');}else if(raw.startsWith('window.SOP_DEFAULT'))raw=raw.slice(raw.indexOf('=')+1).trim().replace(/;\s*$/,'');const parsed=JSON.parse(raw);if(!isValid(parsed))throw Error('Struktur data tidak valid');if(!confirm('Impor akan mengganti draf sekarang. Lanjutkan?'))return;model=parsed;saveDraft();select(parsed.sections[0]?.id||'home');toast('Revisi berhasil diimpor.');}catch(err){alert('Tidak dapat mengimpor file: '+err.message);}finally{$('importFile').value='';}};reader.readAsText(file);}
  function resetDraft(){if(!confirm('Hapus semua revisi di browser dan gunakan kembali isi SOP awal?'))return;model=deepCopy(DEFAULT);try{localStorage.removeItem(KEY);}catch{};render();toast('Draf berhasil direset.');}
  function printCurrent(){if(mode==='home'){select('all',false);setTimeout(()=>window.print(),80);}else window.print();}
  function init(){
    const hash=decodeURIComponent(location.hash.slice(1));if(hash==='semua'){mode='reader';showAll=true;}else if(model.sections.some(s=>s.id===hash)){mode='reader';currentId=hash;}else mode='home';
    $('menuButton').onclick=()=>{$('sidebar').classList.toggle('open');$('sideBackdrop').hidden=!$('sidebar').classList.contains('open');};$('sideBackdrop').onclick=closeSidebar;
    $('homeLink').onclick=()=>select('home');$('startButton').onclick=()=>select(docs()[0]?.id||model.sections[0].id);$('allButton').onclick=openChapterPicker;$('browseAll').onclick=openChapterPicker;$('backHome').onclick=()=>select('home');$('showAllFromReader').onclick=openChapterPicker;$('viewServiceFlow').onclick=()=>select(docs().find(s=>numberOf(s)===5)?.id||model.sections[0].id);
    $('searchInput').addEventListener('input',e=>{searchText=e.target.value.trim();render();});$('clearSearch').onclick=()=>{searchText='';$('searchInput').value='';render();};
    $('printButton').onclick=printCurrent;$('printReader').onclick=printCurrent;$('backTop').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
    $('editToggle').onclick=()=>{editMode=!editMode;if(editMode&&mode==='home')select(docs()[0]?.id||model.sections[0].id);else if(editMode&&showAll)select(docs()[0]?.id||model.sections[0].id);render();if(editMode)toast('Mode edit lokal aktif.');};
    $('renameSection').onclick=()=>{const s=getCurrent();const title=prompt('Ubah judul bagian:',s.title);if(title&&title.trim()){s.title=title.trim();saveDraft();render();}};
    $('addHeading').onclick=()=>addBlock('heading');$('addParagraph').onclick=()=>addBlock('paragraph');$('addList').onclick=()=>addBlock('list');$('addTable').onclick=()=>addBlock('table');$('addSection').onclick=addSection;
    $('removeSection').onclick=()=>{const s=getCurrent();if(!confirm('Hapus seluruh isi bagian “'+s.title+'” dari draf lokal?'))return;model.sections=model.sections.filter(x=>x.id!==s.id);if(!model.sections.length)model.sections.push({id:'bagian-baru',title:'Bagian Baru',kind:'section',blocks:[]});currentId=model.sections[0].id;saveDraft();render();};
    $('howPublish').onclick=()=>$('publishDialog').showModal();document.querySelectorAll('[data-close-dialog]').forEach(b=>b.onclick=()=>$('publishDialog').close());
    $('openChapterList').onclick=openChapterPicker;
    $('closeChapterDialog').onclick=()=>$('chapterDialog').close();
    $('chapterDialog').addEventListener('click',e=>{if(e.target===$('chapterDialog'))$('chapterDialog').close();});
    $('dockPrev').onclick=()=>moveChapter(-1);$('dockNext').onclick=()=>moveChapter(1);
    $('reader').addEventListener('touchstart',onTouchStart,{passive:true});
    $('reader').addEventListener('touchend',onTouchEnd,{passive:true});
    window.addEventListener('scroll',queueReadingProgress,{passive:true});
    window.addEventListener('resize',queueReadingProgress,{passive:true});
    const lastRead=(()=>{try{return localStorage.getItem(READING_KEY);}catch{return null;}})();
    if(lastRead&&model.sections.some(s=>s.id===lastRead)){
      $('startButton').innerHTML='Lanjutkan membaca <span>↗</span>';
      $('startButton').onclick=()=>select(lastRead);
    }
    $('importButton').onclick=()=>$('importFile').click();$('importFile').onchange=e=>importSop(e.target.files?.[0]);$('resetButton').onclick=resetDraft;$('exportButton').onclick=exportSop;
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('searchInput').focus();}if(e.key==='Escape'&&$('sidebar').classList.contains('open'))closeSidebar();
      if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||$('chapterDialog').open)return;
      if(e.key==='ArrowRight')moveChapter(1);if(e.key==='ArrowLeft')moveChapter(-1);});
    window.addEventListener('hashchange',()=>{const hash=decodeURIComponent(location.hash.slice(1));if(hash==='beranda'||!hash)select('home',false);else if(hash==='semua')select('all',false);else if(model.sections.some(s=>s.id===hash))select(hash,false);});
    render();if(hasDraft())$('draftStatus').textContent='Draf dari versi sebelumnya ditemukan';
  }
  init();
})();
