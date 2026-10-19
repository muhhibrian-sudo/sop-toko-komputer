/* SOP V6: admin login & RLS-protected publication via Supabase REST API.
   NO secret/service_role keys in browser; public key is safe only with RLS policies. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const settings=window.SOP_BACKEND||{};
const base=(settings.url||'').trim().replace(/\/$/,'');
const apiKey=(settings.publishableKey||'').trim();
const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base)&&apiKey.length>15;
const SESSION_KEY='sop-admin-v6-session';
let session=null,admin=false,documentVersion=0,draft=null,currentIndex=0,busy=false;
let publishedAt=null;
const clone=value=>JSON.parse(JSON.stringify(value));
const $notice=$('adminNotice');
function message(msg,isError=false){$notice.textContent=msg;$notice.style.background=isError?'#fff0ed':'#faf1dd';$notice.style.color=isError?'#8c3131':'#69512b';}
function setBusy(value){busy=value;$('adminPublish').disabled=value;$('adminLoginSubmit').disabled=value;}
function requestHeaders(access=false){const h={'apikey':apiKey,'Content-Type':'application/json'};if(access&&session?.access_token)h.Authorization='Bearer '+session.access_token;return h;}
async function req(path,{method='GET',body=null,access=false,headers={}}={}){
  if(!configured)throw Error('Layanan admin belum dikonfigurasi. Ikuti petunjuk README.');
  if(access)await ensureSession();
  const res=await fetch(base+path,{method,headers:{...requestHeaders(access),...headers},body:body===null?undefined:JSON.stringify(body),cache:'no-store'});
  const raw=await res.text();let parsed=null;
  try{parsed=raw?JSON.parse(raw):null;}catch(_){parsed=raw;}
  if(!res.ok){const reason=parsed?.msg||parsed?.error_description||parsed?.message||parsed?.error||res.statusText;throw Error(String(reason));}
  return parsed;
}
function saveSession(){try{if(session)sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));else sessionStorage.removeItem(SESSION_KEY);}catch(_){}}
async function ensureSession(){
  if(!session?.access_token)throw Error('Sesi login admin tidak tersedia. Masuk kembali.');
  if(session.expires_at>Date.now()+60000)return;
  const res=await fetch(base+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:requestHeaders(false),body:JSON.stringify({refresh_token:session.refresh_token})});
  const data=await res.json();
  if(!res.ok||!data.access_token){session=null;saveSession();admin=false;throw Error('Sesi admin telah berakhir. Silakan login lagi.');}
  session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+(data.expires_in||3600)*1000,user:data.user};saveSession();
}
async function isAllowedAdmin(){
  const id=session?.user?.id;if(!id)return false;
  const rows=await req('/rest/v1/sop_admins?select=user_id&user_id=eq.'+encodeURIComponent(id),{access:true});
  return Array.isArray(rows)&&rows.length===1;
}
async function loadDocument(){
  if(!configured)return;
  try{
    const rows=await req('/rest/v1/sop_documents?select=content,version,updated_at&id=eq.utama');
    if(Array.isArray(rows)&&rows[0]?.content&&Array.isArray(rows[0].content.sections)){
      documentVersion=rows[0].version;
      publishedAt=rows[0].updated_at;
      window.SOP_APP.setData(rows[0].content);
    }
  }catch(err){console.warn('Tidak berhasil memuat pembaruan online:',err.message);}
}
function openAdmin(){
  $('adminDialog').hidden=false;$('adminBackdrop').hidden=false;document.body.style.overflow='hidden';
  if(!configured)message('Login admin belum dapat digunakan. Hubungkan Supabase terlebih dahulu: lihat README.md dan supabase-setup.sql.',true);
  else message(admin?'Mode admin aktif. Perubahan akan disimpan secara online.':'Masuk menggunakan akun admin yang telah ditetapkan pada Supabase.');
  showAdmin();
}
function closeAdmin(){if(busy)return;$('adminDialog').hidden=true;$('adminBackdrop').hidden=true;document.body.style.overflow='';}
function showAdmin(){
  $('adminLogin').hidden=admin;
  $('adminEditor').hidden=!admin;
  document.querySelectorAll('.admin-open').forEach(b=>b.textContent=admin?'✎ Kelola SOP (Admin)':'♙ Login Admin');
  if(admin){$('adminIdentity').textContent=session?.user?.email||'Admin';freshDraft();}
}
function freshDraft(){
  draft=window.SOP_APP.getData();
  const current=window.SOP_APP.getCurrentId();
  currentIndex=Math.max(0,draft.sections.findIndex(s=>s.id===current));
  renderSelect();renderFields();
}
function getSection(){return draft?.sections[currentIndex];}
function titleCategory(sec){
  if(sec.category)return sec.category;
  const n=Number(sec.title.match(/^(\d+)\s*\./)?.[1]||0);
  if(n>=1&&n<=3)return'dasar';if(n>=4&&n<=11)return'layanan';if(n>=12&&n<=16)return'operasional';if(n>=17&&n<=18)return'evaluasi';if(n>18)return'tambahan';
  if(/^LAMPIRAN/i.test(sec.title))return'lampiran';return'dokumen';
}
function renderSelect(){
 const select=$('adminSections');select.replaceChildren();
 draft.sections.forEach((sec,i)=>{const option=document.createElement('option');option.value=i;option.textContent=sec.title;select.add(option);});select.value=String(currentIndex);
}
function mkBtn(text,onClick){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',onClick);return b;}
function renderFields(){
 const sec=getSection();if(!sec)return;
 $('adminTitle').value=sec.title;$('adminCategory').value=titleCategory(sec);
 const container=$('adminBlocks');container.replaceChildren();
 sec.blocks.forEach((block,i)=>{
   const wrap=document.createElement('div');wrap.className='admin-block';
   const controls=document.createElement('div');controls.className='block-controls';
   const select=document.createElement('select');
   [['paragraph','Paragraf'],['heading','Subjudul'],['list','Daftar poin'],['table','Tabel']].forEach(([v,name])=>{const opt=document.createElement('option');opt.value=v;opt.textContent=name;select.append(opt);});
   select.value=block.type;select.addEventListener('change',()=>{writeFields();sec.blocks[i]=select.value==='table'?{type:'table',rows:[['Kolom 1','Kolom 2'],['','']]}:{type:select.value,text:''};renderFields();});
   const del=mkBtn('Hapus',()=>{writeFields();sec.blocks.splice(i,1);renderFields();});
   const up=mkBtn('↑',()=>{writeFields();if(i>0){[sec.blocks[i-1],sec.blocks[i]]=[sec.blocks[i],sec.blocks[i-1]];renderFields();}});
   const down=mkBtn('↓',()=>{writeFields();if(i<sec.blocks.length-1){[sec.blocks[i+1],sec.blocks[i]]=[sec.blocks[i],sec.blocks[i+1]];renderFields();}});
   controls.append(select,up,down,del);
   const input=document.createElement('textarea');input.rows=block.type==='table'?6:4;
   input.dataset.block=String(i);
   if(block.type==='table'){
     input.value=(block.rows||[]).map(row=>row.join('\t')).join('\n');
     input.setAttribute('aria-label','Tabel: baris baru, kolom dipisah TAB');
     const hint=document.createElement('small');hint.textContent='Untuk tabel: setiap baris dipisah Enter; antar kolom dipisah TAB.';hint.style.color='#777';wrap.append(controls,input,hint);
   }else{input.value=block.text||'';input.setAttribute('aria-label','Isi blok '+(i+1));wrap.append(controls,input);}
   container.append(wrap);
 });
}
function writeFields(){
 const sec=getSection();if(!sec)return;
 const title=$('adminTitle').value.trim();if(title)sec.title=title;
 sec.category=$('adminCategory').value;
 for(const input of $('adminBlocks').querySelectorAll('textarea')){
   const i=Number(input.dataset.block);const block=sec.blocks[i];if(!block)continue;
   if(block.type==='table'){
     const rows=input.value.replace(/\r/g,'').split('\n').filter(x=>x.trim()).map(line=>line.split('\t').map(c=>c.trim()));
     block.rows=rows.length?rows:[['Kolom 1','Kolom 2']];
   }else block.text=input.value;
 }
}
function slug(text){return text.toLocaleLowerCase('id-ID').normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'baru';}
async function signIn(email,password){
 const data=await req('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
 if(!data?.access_token)throw Error('Login gagal. Periksa email dan password.');
 session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+(data.expires_in||3600)*1000,user:data.user};saveSession();
 if(!await isAllowedAdmin()){session=null;saveSession();throw Error('Akun ini tidak terdaftar sebagai admin SOP. Hubungi pemilik proyek Supabase.');}
 admin=true;showAdmin();message('Login admin berhasil. Anda dapat mengubah atau menambahkan SOP.');
}
async function logout(){
 try{if(session?.access_token)await req('/auth/v1/logout',{method:'POST',access:true});}catch(_){}
 session=null;saveSession();admin=false;draft=null;showAdmin();message('Anda sudah keluar dari mode admin.');
}
async function publish(){
 if(!admin)throw Error('Anda harus login sebagai admin.');
 if(busy)return;
 writeFields();const sec=getSection();if(!sec.title?.trim())throw Error('Nama judul wajib diisi.');
 if(!confirm('Terbitkan seluruh perubahan SOP sehingga pengunjung dapat membacanya?'))return;
 setBusy(true);message('Menyimpan perubahan ke server…');
 try{
   const tokenUser=session.user.id;
   let result;
   if(documentVersion===0){
     result=await req('/rest/v1/sop_documents',{method:'POST',body:{id:'utama',content:draft,version:1,updated_by:tokenUser},access:true,headers:{Prefer:'return=representation'}});
   }else{
     const path='/rest/v1/sop_documents?id=eq.utama&version=eq.'+documentVersion;
     result=await req(path,{method:'PATCH',body:{content:draft,version:documentVersion+1,updated_by:tokenUser,updated_at:new Date().toISOString()},access:true,headers:{Prefer:'return=representation'}});
   }
   if(!Array.isArray(result)||result.length!==1)throw Error('Perubahan online tidak diterbitkan: versi SOP telah berubah di tempat lain. Tutup editor dan muat ulang halaman.');
   documentVersion=result[0].version;
   window.SOP_APP.setData(draft);
   renderSelect();message('Berhasil diterbitkan. Pembaca yang membuka atau memuat ulang website akan melihat perubahan.');
 }catch(err){message('Gagal menerbitkan: '+err.message,true);}finally{setBusy(false);}
}
async function init(){
 if(!configured)return;
 await loadDocument();
 try{
   session=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
   if(session?.access_token){await ensureSession();admin=await isAllowedAdmin();if(!admin){session=null;saveSession();}}
 }catch(_){session=null;admin=false;saveSession();}
 showAdmin();
}
function installEvents(){
 document.querySelectorAll('.admin-open').forEach(button=>button.addEventListener('click',openAdmin));
 $('adminClose').addEventListener('click',closeAdmin);$('adminBackdrop').addEventListener('click',closeAdmin);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('adminDialog').hidden)closeAdmin();});
 $('adminLoginForm').addEventListener('submit',async e=>{
   e.preventDefault();if(busy)return;setBusy(true);
   try{await signIn($('adminEmail').value.trim(),$('adminPassword').value);$('adminPassword').value='';}
   catch(err){message('Login gagal: '+err.message,true);}
   finally{setBusy(false);}
 });
 $('adminLogout').addEventListener('click',logout);
 $('adminSections').addEventListener('change',()=>{writeFields();currentIndex=Number($('adminSections').value);renderFields();});
 $('adminAddBlock').addEventListener('click',()=>{writeFields();getSection().blocks.push({type:'paragraph',text:''});renderFields();});
 $('adminNewSection').addEventListener('click',()=>{
   writeFields();const nums=draft.sections.map(s=>Number(s.title.match(/^(\d+)\s*\./)?.[1]||0));
   const next=Math.max(18,...nums)+1;
   const title=next+'. SOP BARU';let id=next+'-sop-baru';while(draft.sections.some(s=>s.id===id))id=id+'-2';
   draft.sections.push({id,title,kind:'section',category:'tambahan',blocks:[{type:'paragraph',text:'Tuliskan isi SOP baru di sini.'}]});
   currentIndex=draft.sections.length-1;renderSelect();renderFields();
 });
 $('adminDeleteSection').addEventListener('click',()=>{
   if(!confirm('Hapus judul ini beserta seluruh isinya? Penghapusan baru terbit setelah menekan Terbitkan perubahan online.'))return;
   if(draft.sections.length<=1)return;
   draft.sections.splice(currentIndex,1);currentIndex=Math.min(currentIndex,draft.sections.length-1);renderSelect();renderFields();
 });
 $('adminPublish').addEventListener('click',()=>{publish().catch(err=>message(err.message,true));});
}
installEvents();init().catch(err=>console.error('SOP Admin V6:',err));
})();
