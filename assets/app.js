(function(){
'use strict';
const $ = id => document.getElementById(id);
const DEFAULT = window.SOP_DEFAULT;
if (!DEFAULT || !Array.isArray(DEFAULT.sections)) {
  document.body.textContent = 'Data SOP gagal dimuat. Pastikan file data/sop.js ikut diunggah.';
  return;
}
const KEY = 'soppedia-draft-v1';
const deepCopy = a => JSON.parse(JSON.stringify(a));
const isValid = a => a && typeof a.name==='string' && Array.isArray(a.sections) && a.sections.every(s=>typeof s.id==='string' && typeof s.title==='string' && Array.isArray(s.blocks));
let model = deepCopy(DEFAULT), editMode = false, currentId='sampul', searchText='', toastTimer, showAll=false;
try { const draft=localStorage.getItem(KEY); if(draft){let parsed=JSON.parse(draft); if(isValid(parsed)) model=parsed;} }catch(err){console.warn('Draf lokal tidak tersedia',err);}
function hasDraft(){try{return !!localStorage.getItem(KEY);}catch{return false;}}
function toast(message){ const t=$('toast');t.textContent=message;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true;},3300); }
function saveDraft(){
  try {localStorage.setItem(KEY,JSON.stringify(model));$('draftStatus').textContent='Draf tersimpan di browser · '+new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});}
  catch(err){toast('Penyimpanan browser gagal. Unduh hasil edit sekarang.');}
}
function make(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;}
function bText(block){if(block.type==='table')return(block.rows||[]).map(r=>r.join(' ')).join(' ');return block.text||'';}
function matches(s,q){let haystack=s.title+' '+s.blocks.map(bText).join(' ');return haystack.toLocaleLowerCase('id-ID').includes(q.toLocaleLowerCase('id-ID'));}
function closeSidebar(){$('sidebar').classList.remove('open');$('sideBackdrop').hidden=true;}
function navItem(s,selected){const b=make('button','nav-item'+(selected?' active':'')); b.type='button';const no = s.kind==='cover'?'⌂':s.title.match(/^(\d+|LAMPIRAN\s+\d+)[.]/i)?.[1]||'▦';b.append(make('span','nav-num',no),make('span','',s.title));b.onclick=()=>select(s.id);return b;}
function renderNav(){
 const nav=$('navigation');nav.replaceChildren();
 const allB=make('button','nav-item'+(showAll?' active':''));allB.append(make('span','nav-num','▤'),make('span','','Lihat Semua Dokumen'));allB.onclick=()=>select('all');nav.append(allB);
 let prevGroup='';let found=0;
 for(const s of model.sections){
  if(searchText&&!matches(s,searchText))continue;
  found++;
  const group=s.kind==='cover'||s.title==='LEMBAR KENDALI DOKUMEN'||s.title==='DAFTAR ISI'?'DOKUMEN UMUM':s.title.toUpperCase().startsWith('LAMPIRAN')?'LAMPIRAN FORM':'DAFTAR SOP';
  if(group!==prevGroup){nav.append(make('div','nav-label',group));prevGroup=group;}
  nav.append(navItem(s,!showAll&&currentId===s.id));
 }
 if(!found){nav.append(make('p','nav-empty','Tidak ada bagian yang cocok.'));}
 $('totalSop').textContent=model.sections.filter(s=>/^\d+\./.test(s.title)).length;
 $('totalForms').textContent=model.sections.filter(s=>/^LAMPIRAN\s+\d+\./i.test(s.title)).length;
}
function highlight(element,text){
 if(!searchText){element.textContent=text;return;}
 const hay=String(text), needle=searchText.trim();let i=0;
 const idx=hay.toLocaleLowerCase('id-ID').indexOf(needle.toLocaleLowerCase('id-ID'));
 if(idx<0){element.textContent=hay;return;}
 while(i<hay.length){let pos=hay.toLocaleLowerCase('id-ID').indexOf(needle.toLocaleLowerCase('id-ID'),i);if(pos<0){element.append(document.createTextNode(hay.slice(i)));break;}if(pos>i)element.append(document.createTextNode(hay.slice(i,pos)));element.append(make('mark','',hay.slice(pos,pos+needle.length)));i=pos+needle.length;}
}
function tableNode(block){const scroller=make('div','table-scroller');const table=make('table','sop-table');for(const [ir,row] of (block.rows||[]).entries()){const tr=document.createElement('tr');for(const cell of row){const td=make('td');highlight(td,String(cell||''));tr.append(td);}table.append(tr);}scroller.append(table);return scroller;}
function blockNode(block){if(block.type==='table')return tableNode(block);const type=block.type==='heading'?'heading':block.type==='list'?'list':'paragraph';const el=make('div','sop-block block-'+type);highlight(el,String(block.text||''));return el;}
function editControl(label,fn,css=''){const btn=make('button',css,label);btn.type='button';btn.onclick=fn;return btn;}
function changeBlock(section,blockIndex,wrap){
 const block=section.blocks[blockIndex];const previous=wrap.innerHTML;wrap.replaceChildren();
 if(block.type==='table'){
  const frame=make('div','table-editor'),table=make('table');const grid=[];
  for(const row of block.rows||[]){const tr=document.createElement('tr');const inputs=[];for(const cell of row){const td=document.createElement('td');const input=document.createElement('input');input.value=String(cell||'');td.append(input);tr.append(td);inputs.push(input);}table.append(tr);grid.push(inputs);}frame.append(table);wrap.append(frame);
  const footer=make('div','edit-controls');
  footer.append(editControl('+ Baris',()=>{const tr=document.createElement('tr');const cells=[];const count=grid[0]?.length||2;for(let j=0;j<count;j++){const td=document.createElement('td'),inp=document.createElement('input');td.append(inp);tr.append(td);cells.push(inp);}table.append(tr);grid.push(cells);}),editControl('+ Kolom',()=>{for(let i=0;i<grid.length;i++){const td=document.createElement('td'),inp=document.createElement('input');td.append(inp);table.rows[i].append(td);grid[i].push(inp);}}));
  footer.append(editControl('✓ Simpan',()=>{block.rows=grid.map(row=>row.map(input=>input.value));saveDraft();render();toast('Tabel diperbarui.');}),editControl('Batal',render));wrap.append(footer);
 }else{
  const input=make('textarea','field-editor');input.value=block.text||'';input.rows=Math.max(3,Math.min(12,input.value.length/75+1));wrap.append(input);
  const footer=make('div','edit-controls');footer.append(editControl('✓ Simpan',()=>{block.text=input.value;saveDraft();render();toast('Teks diperbarui.');}),editControl('Batal',render));wrap.append(footer);input.focus();
 }
}
function editedBlock(section,index){const block=section.blocks[index],wrap=make('div','block-edit-wrap');const controls=make('div','block-controls');controls.append(editControl('✎ Ubah',()=>changeBlock(section,index,wrap)),editControl('↑',()=>moveBlock(section,index,-1)),editControl('↓',()=>moveBlock(section,index,1)),editControl('✕ Hapus',()=>{if(confirm('Hapus bagian teks/tabel ini?')){section.blocks.splice(index,1);saveDraft();render();}},'delete-btn'));
 wrap.append(controls,blockNode(block));return wrap;}
function moveBlock(section,index,dir){const other=index+dir;if(other<0||other>=section.blocks.length){toast('Sudah di batas bagian.');return;}[section.blocks[index],section.blocks[other]]=[section.blocks[other],section.blocks[index]];saveDraft();render();}
function contentFor(section,editing){const content=make('div','sop-content');if(!section.blocks.length){content.append(make('p','editing-hint','Belum ada isi. Gunakan tombol tambah di atas.'));return content;}for(let i=0;i<section.blocks.length;i++){content.append(editing?editedBlock(section,i):blockNode(section.blocks[i]));}return content;}
function getCurrent(){return model.sections.find(s=>s.id===currentId)||model.sections[0];}
function render(){
 renderNav();const body=$('documentArea');body.replaceChildren();const title=$('currentTitle'), desc=$('currentSummary');
 if(showAll){
  title.textContent='Seluruh Dokumen SOP';desc.textContent='Semua bagian SOP dan lampiran dalam satu halaman.';
  $('breadcrumb').textContent='DOKUMEN · SELURUH BAGIAN';$('editorToolbar').hidden=true;
  const visible=model.sections.filter(s=>!searchText||matches(s,searchText));
  for(const s of visible){const wrap=make('section','full-section');const h=make('h3','sop-section-title',s.title);wrap.append(h,contentFor(s,false));wrap.style.marginBottom='44px';body.append(wrap);}
  if(!visible.length)body.append(make('div','paper-empty','Tidak ada hasil pencarian.'));
  if(editMode)body.prepend(make('div','editing-hint','Pilih satu bagian dari daftar isi untuk mengeditnya.'));
 }else{
  const s=getCurrent();currentId=s.id;title.textContent=s.title;desc.textContent=s.kind==='cover'?'Identitas dan pengantar dokumen sumber.':'Isi dan ketentuan dari dokumen Word yang Anda kirim.';
  $('breadcrumb').textContent=s.title.toUpperCase().startsWith('LAMPIRAN')?'DOKUMEN · FORM LAMPIRAN':'DOKUMEN · STANDAR OPERASIONAL';$('editorToolbar').hidden=!editMode;
  body.append(contentFor(s,editMode));
 }
 $('editBanner').hidden=!editMode;$('editorDock').hidden=!editMode;
 const e=$('editToggle');e.innerHTML=editMode?'✓ <span>Selesai Edit</span>':'✎ <span>Mode Edit</span>';
}
function select(id){showAll=id==='all';if(!showAll)currentId=id;history.replaceState(null,'',id==='all'?'#semua':('#'+encodeURIComponent(id)));render();closeSidebar();$('workspace').scrollIntoView({behavior:'smooth',block:'start'});}
function addBlock(type){if(showAll){toast('Pilih satu bagian sebelum mengedit.');return;}const section=getCurrent();let obj;if(type==='table'){obj={type,rows:[['Kolom 1','Kolom 2'],['','']]};}else {const value=prompt(type==='heading'?'Masukkan subjudul:':type==='list'?'Masukkan poin baru:':'Masukkan teks paragraf:');if(value===null)return;obj={type,text:value};}section.blocks.push(obj);saveDraft();render();const paper=$('documentArea');paper.lastElementChild?.scrollIntoView({behavior:'smooth',block:'end'});}
function addSection(){const title=prompt('Judul SOP atau lampiran baru:');if(!title||!title.trim())return;const id='baru-'+Date.now().toString(36);model.sections.push({id,title:title.trim(),kind:'section',blocks:[{type:'paragraph',text:'Isi SOP baru. Klik Ubah untuk menyunting teks ini.'}]});saveDraft();select(id);toast('Bagian baru ditambahkan ke draf lokal.');}
function exportSop(){const js='/* Konten SOP untuk website GitHub Pages. Hasil revisi dari editor. */\nwindow.SOP_DEFAULT = '+JSON.stringify(model,null,2)+';\n';const blob=new Blob([js],{type:'text/javascript;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='sop.js';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('sop.js terunduh. Ganti file data/sop.js di GitHub untuk menerbitkan.');}
function importSop(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{let raw=String(reader.result).trim();if(raw.startsWith('window.SOP_DEFAULT')){raw=raw.slice(raw.indexOf('=')+1).trim().replace(/;\s*$/,'');}else if(raw.startsWith('/*')){const pos=raw.indexOf('window.SOP_DEFAULT');if(pos<0)throw Error('File bukan data SOP');raw=raw.slice(raw.indexOf('=',pos)+1).trim().replace(/;\s*$/,'');}const parsed=JSON.parse(raw);if(!isValid(parsed))throw Error('Struktur data tidak cocok');if(!confirm('Impor data ini akan mengganti draf SOP saat ini. Lanjutkan?'))return;model=parsed;showAll=false;currentId=model.sections[0].id;saveDraft();render();toast('Data SOP berhasil diimpor.');}catch(err){alert('File tidak bisa diimpor: '+err.message);}finally{$('importFile').value='';}};reader.readAsText(file);}
function resetDraft(){if(!confirm('Hapus semua revisi lokal dan kembalikan isi asli dari dokumen Word?'))return;model=deepCopy(DEFAULT);try{localStorage.removeItem(KEY);}catch{};showAll=false;currentId=model.sections[0].id;render();toast('Draf lokal berhasil direset.');}
function init(){
 const hash=decodeURIComponent(location.hash.slice(1));if(hash==='semua')showAll=true;else if(model.sections.some(s=>s.id===hash))currentId=hash;
 $('menuButton').onclick=()=>{$('sidebar').classList.toggle('open');$('sideBackdrop').hidden=!$('sidebar').classList.contains('open');};$('sideBackdrop').onclick=closeSidebar;
 $('startButton').onclick=()=>select(model.sections.find(s=>/^1\./.test(s.title))?.id||model.sections[0].id);
 $('searchInput').addEventListener('input',e=>{searchText=e.target.value.trim();render();});
 $('editToggle').onclick=()=>{editMode=!editMode;if(editMode&&showAll){const x=model.sections.find(s=>/^1\./.test(s.title));select(x?.id||model.sections[0].id);}render();if(editMode)toast('Anda sedang mengedit draf lokal.');};
 $('printButton').onclick=()=>window.print();$('backTop').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
 $('renameSection').onclick=()=>{const s=getCurrent();const title=prompt('Ubah judul bagian:',s.title);if(title&&title.trim()){s.title=title.trim();saveDraft();render();}};
 $('addHeading').onclick=()=>addBlock('heading');$('addParagraph').onclick=()=>addBlock('paragraph');$('addList').onclick=()=>addBlock('list');$('addTable').onclick=()=>addBlock('table');$('addSection').onclick=addSection;
 $('removeSection').onclick=()=>{const s=getCurrent();if(!confirm('Yakin ingin menghapus seluruh bagian "'+s.title+'" dari draf?'))return;model.sections=model.sections.filter(x=>x.id!==s.id);if(!model.sections.length)model.sections.push({id:'bagian-baru',title:'Bagian Baru',kind:'section',blocks:[]});currentId=model.sections[0].id;saveDraft();render();};
 $('howPublish').onclick=()=>$('publishDialog').showModal();document.querySelectorAll('[data-close-dialog]').forEach(x=>x.onclick=()=>$('publishDialog').close());
 $('importButton').onclick=()=>$('importFile').click();$('importFile').onchange=e=>importSop(e.target.files?.[0]);$('resetButton').onclick=resetDraft;$('exportButton').onclick=exportSop;
 window.addEventListener('hashchange',()=>{const h=decodeURIComponent(location.hash.slice(1));if(h==='semua'){showAll=true;render();}else if(model.sections.some(s=>s.id===h)){currentId=h;showAll=false;render();}});
 render();if(hasDraft())$('draftStatus').textContent='Ada draf tersimpan pada browser ini';
}
init();
})();
