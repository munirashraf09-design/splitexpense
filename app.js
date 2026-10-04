const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const cfg=()=>({cur:'\u20B9',key:'',svc:'',tpl:'',...get('cfg',{})});
const money=n=>cfg().cur+n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const cap=s=>s[0].toUpperCase()+s.slice(1).toLowerCase();
const STOP=/^(everyone|all|equally|and|the|between|among|split|me|us)$/i;
let cur=null;
function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';setTimeout(()=>e.style.display='none',3000)}
function show(v){$$('.view').forEach(s=>s.hidden=s.id!==v);$$('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
 $('h2').textContent={new:'New split',hist:'History',set:'Settings'}[v];if(v==='hist')renderHist()}
$$('nav button').forEach(b=>b.onclick=()=>show(b.dataset.v));
$('#uname').value=get('name','');$('#saveName').onclick=()=>{set('name',$('#uname').value.trim());toast('Name saved')};
const c=cfg();$('#cCur').value=c.cur;$('#cKey').value=c.key;$('#cSvc').value=c.svc;$('#cTpl').value=c.tpl;
$('#saveCfg').onclick=()=>{set('cfg',{cur:$('#cCur').value||'\u20B9',key:$('#cKey').value.trim(),svc:$('#cSvc').value.trim(),tpl:$('#cTpl').value.trim()});toast('Settings saved')};
$('#clear').onclick=()=>{if(confirm('Delete all history?')){set('hist',[]);toast('History cleared')}};

function names(t){return t.split(/,|&|\band\b/i).map(x=>x.replace(/[^A-Za-z]/g,'')).filter(x=>x&&!STOP.test(x)).map(cap)}
function parse(text){return text.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
 const p=l.match(/^([A-Za-z]+)\s+(?:paid|spent|bought|covered)/i),a=l.match(/(\d[\d,]*\.?\d*)/);
 if(!p||!a)return{raw:l,error:true};
 const d=l.match(/\bfor\s+(.+?)(?:,|\s+split|\s+shared|$)/i),sp=l.match(/(?:between|among|with)\s+(.+)$/i);
 const all=!sp||/everyone|\ball\b/i.test(sp[1]);
 return{raw:l,payer:cap(p[1]),amount:parseFloat(a[1].replace(/,/g,'')),desc:d?d[1].trim():'expense',list:all?null:names(sp[1])}})}
function calc(rows){
 const ok=rows.filter(r=>!r.error),members=[...new Set(ok.flatMap(r=>[r.payer,...(r.list||[])]))],paid={},owed={};
 members.forEach(m=>paid[m]=owed[m]=0);
 ok.forEach(r=>{const g=r.list||members;paid[r.payer]+=r.amount;g.forEach(m=>owed[m]+=r.amount/g.length)});
 const bal=members.map(m=>({m,paid:paid[m],owed:owed[m],net:Math.round((paid[m]-owed[m])*100)/100}));
 const cr=bal.filter(b=>b.net>0).map(b=>({...b})).sort((a,b)=>b.net-a.net),db=bal.filter(b=>b.net<0).map(b=>({m:b.m,net:-b.net})).sort((a,b)=>b.net-a.net),tx=[];
 let i=0,j=0;while(i<db.length&&j<cr.length){const x=Math.min(db[i].net,cr[j].net);if(x>.005)tx.push({from:db[i].m,to:cr[j].m,amt:Math.round(x*100)/100});db[i].net-=x;cr[j].net-=x;if(db[i].net<.01)i++;if(cr[j].net<.01)j++}
 return{ok,bad:rows.filter(r=>r.error),members,bal,tx,total:ok.reduce((s,r)=>s+r.amount,0)}}

function summary(r,who){
 let t=`SplitSense settlement - total ${money(r.total)}, ${r.members.length} members\n\n`;
 if(who){const b=r.bal.find(x=>x.m===who);t=`Hi ${who},\n\n`+t+`You paid ${money(b.paid)}, your fair share is ${money(b.owed)}.\n`+(b.net>0?`You get back ${money(b.net)}.\n`:b.net<0?`You owe ${money(-b.net)}.\n`:`You are all settled.\n`)+'\nWho pays whom:\n'}
 else t+='Who pays whom:\n';
 t+=r.tx.length?r.tx.map(x=>`- ${x.from} pays ${x.to} ${money(x.amt)}`).join('\n'):'- Everyone is settled';
 return t+`\n\nSent via SplitSense${get('name','')?' by '+get('name',''):''}`}

$('#run').onclick=async()=>{
 const text=$('#log').value.trim();if(!text)return toast('Write some expenses first');
 const btn=$('#run'),tr=$('#trace');btn.disabled=true;$('#out').innerHTML='';tr.className='card';tr.innerHTML='';
 const step=async t=>{tr.insertAdjacentHTML('beforeend',`<div class="step"><b>\u2713</b> ${t}</div>`);await sleep(350)};
 const rows=parse(text),r=calc(rows);
 await step(`Read ${rows.length} line(s) of your expense log`);
 await step(`Found ${r.members.length} member(s): ${esc(r.members.join(', '))}`);
 await step(`Parsed ${r.ok.length} expense(s)${r.bad.length?`, could not understand ${r.bad.length}`:''}`);
 await step(`Total spend ${money(r.total)}; equal share applied per expense group`);
 await step(`Settled in ${r.tx.length} payment(s)`);
 cur={r,text};btn.disabled=false;render(r);
 const h=get('hist',[]);h.unshift({id:Date.now(),date:new Date().toLocaleString(),text,total:r.total,n:r.members.length});set('hist',h.slice(0,50))};

function render(r){
 const mx=Math.max(1,...r.bal.map(b=>Math.abs(b.net))),em=get('emails',{});
 $('#out').innerHTML=`${r.bad.length?`<div class="card neg">Could not read: ${r.bad.map(b=>esc(b.raw)).join(' | ')}</div>`:''}
 <div class="stats"><div class="stat">Total<b>${money(r.total)}</b></div><div class="stat">Members<b>${r.members.length}</b></div><div class="stat">Payments<b>${r.tx.length}</b></div></div>
 <div class="card"><h4>Balances</h4><table>${r.bal.map(b=>`<tr><td>${esc(b.m)}</td><td class="mut">paid ${money(b.paid)}</td><td class="mut">share ${money(b.owed)}</td>
 <td class="${b.net>=0?'pos':'neg'}">${b.net>=0?'+':''}${money(b.net)}</td><td style="width:20%"><div class="bar ${b.net<0?'neg':''}" style="width:${Math.abs(b.net)/mx*100}%"></div></td></tr>`).join('')}</table></div>
 <div class="card"><h4>Settle up</h4>${r.tx.map(x=>`<div class="pay"><span>${esc(x.from)} &rarr; ${esc(x.to)}</span><b>${money(x.amt)}</b></div>`).join('')||'<p class="mut">Everyone is settled.</p>'}
 <div class="acts"><button class="ghost" id="cp">Copy summary</button><button class="ghost" id="wa">WhatsApp</button><button class="ghost" id="csv">Export CSV</button></div></div>
 <div class="card"><h4>Email everyone</h4><p class="mut small">Enter each member's email, then send. Each person gets their own balance.</p>
 ${r.members.map(m=>`<div class="erow"><span>${esc(m)}</span><input type="email" data-m="${esc(m)}" placeholder="${esc(m.toLowerCase())}@example.com" value="${esc(em[m]||'')}"></div>`).join('')}
 <div class="acts"><button class="gold" id="send">Send notifications</button><button class="ghost" id="mailto">Open in my mail app</button></div></div>`;
 $$('[data-m]').forEach(i=>i.oninput=()=>{const e=get('emails',{});e[i.dataset.m]=i.value.trim();set('emails',e)});
 $('#cp').onclick=()=>{navigator.clipboard.writeText(summary(r));toast('Copied')};
 $('#wa').onclick=()=>open('https://wa.me/?text='+encodeURIComponent(summary(r)));
 $('#csv').onclick=()=>{const l=[['Member','Paid','Share','Net'],...r.bal.map(b=>[b.m,b.paid,b.owed.toFixed(2),b.net]),[],['From','To','Amount'],...r.tx.map(x=>[x.from,x.to,x.amt])];
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([l.map(x=>x.join(',')).join('\n')],{type:'text/csv'}));a.download='splitsense.csv';a.click()};
 $('#mailto').onclick=()=>{const to=$$('[data-m]').map(i=>i.value).filter(Boolean).join(',');location.href=`mailto:${to}?subject=${encodeURIComponent('Expense settlement')}&body=${encodeURIComponent(summary(r))}`};
 $('#send').onclick=async()=>{const c=cfg();if(!c.key||!c.svc||!c.tpl){toast('Add EmailJS keys in Settings first');return show('set')}
  const t=$$('[data-m]').filter(i=>i.value.trim());if(!t.length)return toast('Enter at least one email');
  $('#send').disabled=true;let ok=0;
  for(const i of t){try{await emailjs.send(c.svc,c.tpl,{to_email:i.value.trim(),to_name:i.dataset.m,subject:'Expense split: your balance, '+i.dataset.m,message:summary(r,i.dataset.m)},{publicKey:c.key});ok++}catch(e){console.error(e)}}
  $('#send').disabled=false;toast(`Sent ${ok} of ${t.length} email(s)`)}}

function renderHist(){const h=get('hist',[]);
 $('#histList').innerHTML=h.length?h.map(x=>`<div class="card pay"><span>${esc(x.date)} &middot; ${x.n} members &middot; ${money(x.total)}</span><button class="ghost" data-id="${x.id}">Load</button></div>`).join(''):'<p class="mut">No splits yet.</p>';
 $$('[data-id]').forEach(b=>b.onclick=()=>{$('#log').value=h.find(x=>x.id==b.dataset.id).text;show('new');$('#run').click()})}

