
/* ====== CONFIGURACION: pega aqui los datos de tu proyecto de Supabase (Settings > API) ====== */
const SB_URL='https://wkxlveqmpenrnoavmobm.supabase.co',SB_KEY='sb_publishable_8603-nrStKTEUkZzEfXyyg_noFRc6Yy';
const sb=supabase.createClient(SB_URL,SB_KEY);
let KEY='',uid=()=>Math.random().toString(36).slice(2,8);
const esc=s=>String(s).replace(/[&<>"'`]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c]));
const cats0=()=>[{id:'a',n:'Apreciación',w:100/3},{id:'b',n:'Parciales',w:100/3},{id:'c',n:'Examen o proyecto trimestral',w:100/3}];
function sample(){
  const st=['Ana Pérez','Luis Gómez','María Castillo','Carlos Ríos','Sofía Núñez'].map(n=>({id:uid(),n}));
  const ac=[['Taller','a'],['Cuaderno','a'],['Parcial 1','b'],['Parcial 2','b'],['Examen trimestral','c']].map(([n,c])=>({id:uid(),t:1,n,c}));
  const v=[[4.5,5,3.8,4.4,4.5],[3,2.5,2.8,3.4,3.1],[5,4.8,4.5,4.9,4.7],[3.5,3,3.2,3.4,3.3],[4,3.8,4.2,3.9,4]],gr={};
  st.forEach((s,i)=>ac.forEach((a,j)=>gr[s.id+'|'+a.id]=v[i][j]));
  const g={id:crypto.randomUUID(),n:'5.º A (ejemplo)',sub:'Matemática',min:3,cats:cats0(),st,ac,gr,ej:true};
  return g;
}
/* Todo lo que viene de la base de datos se limpia antes de usarse */
const T=(v,n)=>String(v==null?'':v).replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,n);
const ID=v=>/^[A-Za-z0-9_-]{1,40}$/.test(String(v))?String(v):uid();
const NUM=(v,a,b,d)=>{v=+v;return isFinite(v)?Math.min(b,Math.max(a,v)):d};
function clean(r){
  const d=(r&&r.datos&&typeof r.datos==='object')?r.datos:{};
  let cats=(Array.isArray(d.cats)?d.cats:[]).slice(0,10).map(c=>({id:ID(c&&c.id),n:T(c&&c.n,40)||'Casilla',w:NUM(c&&c.w,0,100,33.3)}));
  if(!cats.length)cats=cats0();
  const st=(Array.isArray(d.st)?d.st:[]).slice(0,500).map(x=>({id:ID(x&&x.id),n:T(x&&x.n,80)}));
  const ac=(Array.isArray(d.ac)?d.ac:[]).slice(0,300).map(a=>({id:ID(a&&a.id),t:Math.round(NUM(a&&a.t,1,3,1)),n:T(a&&a.n,60)||'Nota',c:ID(a&&a.c)}));
  const gr={};
  if(d.gr&&typeof d.gr==='object'){for(const k of Object.keys(d.gr).slice(0,60000)){const v=+d.gr[k];if(isFinite(v)&&v>=1&&v<=5&&/^[\w-]+\|[\w-]+$/.test(k))gr[k]=v}}
  return{id:String(r.id),n:T(r.nombre,80)||'Grupo',sub:T(r.materia,80),ej:!!r.es_ejemplo,sv:true,min:NUM(d.min,1,5,3),cats,st,ac,gr};
}
let UID=null,ADMIN=false,tmr=null,busy=false,again=false;
const sig=g=>JSON.stringify([g.n,g.sub,g.min,g.cats,g.st,g.ac,g.gr]);
const toRow=g=>({id:g.id,usuario_id:UID,nombre:g.n,materia:g.sub,es_ejemplo:!!g.ej,datos:{min:g.min,cats:g.cats,st:g.st,ac:g.ac,gr:g.gr}});
const say=t=>{const e=document.getElementById('syncs');if(e)e.textContent=t};
function save(){
  try{localStorage.setItem('promedia:ui',JSON.stringify({cur:S.cur,tab:S.tab}))}catch(e){}
  clearTimeout(tmr);tmr=setTimeout(sync,600);
}
async function sync(){
  if(!UID||!S)return;
  if(busy){again=true;return}
  busy=true;say('Guardando…');let fail=false;
  try{
    for(const g of [...S.groups]){
      if(g.sv&&g.h===sig(g))continue;
      const r=g.sv?await sb.from('grupos').update(toRow(g)).eq('id',g.id):await sb.from('grupos').insert(toRow(g));
      if(r.error){fail=true;await dbErr(r.error,g)}else{g.sv=true;g.h=sig(g)}
    }
  }catch(e){fail=true}
  busy=false;say(fail?'No se pudo guardar. Revisa tu conexión.':'Guardado');
  if(again){again=false;sync()}
}
async function dbErr(er,g){
  const m=er.message||'';
  if(m.includes('ELIMINAR_ESTUDIANTES')){await enter({id:UID,email:ME});openPlans('delst');return}
  if(m.includes('LIMITE_GRATIS')||m.includes('EJEMPLO_USADO')){S.groups=S.groups.filter(x=>x!==g);S.cur=S.groups[0]?S.groups[0].id:null;render();openPlans('limit')}
  else console.error(er);
}
function queueDel(g){(S.removed=S.removed||[]).push(g);setTimeout(flushDel,8000)}
async function flushDel(){
  const list=(S&&S.removed)||[];if(S)S.removed=[];
  for(const g of list){
    if(!g.sv)continue;
    const {error}=await sb.from('grupos').delete().eq('id',g.id);
    if(error){if((error.message||'').includes('ELIMINAR_PRO')){S.groups.push(g);S.cur=g.id;render();openPlans('delete')}else console.error(error)}
  }
}
async function refreshPlan(){
  if(!UID||!S)return;
  const {data}=await sb.from('perfiles').select('plan_tipo,plan_inicio,plan_fin,grupos_creados').eq('id',UID).single();
  const c=await sb.from('pagos').select('id',{count:'exact',head:true}).eq('usuario_id',UID).eq('estado','pendiente');S.pend=c.count||0;
  if(data){S.plan=data.plan_fin?{tipo:data.plan_tipo,inicio:Date.parse(data.plan_inicio),fin:Date.parse(data.plan_fin)}:null;S.created=data.grupos_creados;badge()}
}
let S;
const G=()=>S.groups.find(x=>x.id==S.cur)||S.groups[0];
const fmt=v=>v==null?'–':(Math.floor(v*100+1e-9)/100).toFixed(2);
const avg=a=>a.reduce((p,q)=>p+q,0)/a.length;
function tri(g,s,t){let sw=0,sv=0;g.cats.forEach(c=>{const v=g.ac.filter(a=>a.t==t&&a.c==c.id).map(a=>g.gr[s.id+'|'+a.id]).filter(x=>x!=null);if(v.length){sw+=c.w;sv+=c.w*avg(v)}});return sw?sv/sw:null}
function catAvg(g,s,t,cid){const v=g.ac.filter(a=>a.t==t&&a.c==cid).map(a=>g.gr[s.id+'|'+a.id]).filter(x=>x!=null);return v.length?avg(v):null}
function fin(g,s){const v=[1,2,3].map(t=>tri(g,s,t)).filter(x=>x!=null);return v.length?avg(v):null}
function render(){
  window.__dg=false;badge();
  const g=G(),open=document.querySelector('details')?.open;
  if(!g){$('#app').innerHTML=`<div class="welcome"><h2>Bienvenido a Promedia</h2><p>Empieza creando tu primer grupo, o carga un grupo de Matemática de ejemplo, ya listo para probar.</p><div class="cta"><button class="big" data-a="ng">Crear mi primer grupo</button><button class="big ghost" data-a="ex">Cargar ejemplo de Matemática</button></div></div>`;return}
  let h=`<div class="bar"><div class="chipsg" role="tablist">${S.groups.map(x=>`<button class="gc${x.id==g.id?' on':''}" data-a="sg" data-id="${x.id}" data-gid="${x.id}">${esc(x.n)}<small>${esc(x.sub)}</small></button>`).join('')}</div><button data-a="ng">Nuevo grupo</button></div>${S.groups.length>1?'<p class="hint">Clic derecho sobre un grupo para eliminarlo (en el celular, mantén presionado).</p>':''}`;
  h+=`<details><summary>Configuración del grupo</summary><div class="cfg">
  <label>Grupo<input data-k="n" value="${esc(g.n)}"></label>
  <label>Materia<input data-k="sub" value="${esc(g.sub)}"></label>
  <label>Nota mínima para aprobar<input type="number" step="0.1" data-k="min" value="${g.min}"></label>
  <h4>Categorías y porcentajes <span id="wsum" class="sub"></span></h4>
  ${g.cats.map(c=>`<div class="row"><input data-c="${c.id}" data-k="n" value="${esc(c.n)}" aria-label="Nombre"><input type="number" step="any" data-c="${c.id}" data-k="w" value="${+(+c.w).toFixed(1)}" aria-label="Porcentaje">%<button class="x" data-a="dc" data-id="${c.id}" aria-label="Quitar categoría">×</button></div>`).join('')}
  <div><button data-a="nc">Agregar categoría</button></div>
  <h4>Estudiantes</h4>
  <textarea id="stin" placeholder="Un nombre por línea. Puedes pegar la lista desde Excel."></textarea>
  <div><button data-a="as">Agregar estudiantes</button></div><h4>Zona de cuidado</h4><div><button class="ghost" data-a="dg">Eliminar este grupo${canDel(g)?'':' (solo Pro)'}</button></div></div></details>`;
  h+=`<div class="tabs">${['Trim. I','Trim. II','Trim. III','Anual'].map((x,i)=>`<button class="${S.tab==i+1?'on':''}" data-a="tab" data-id="${i+1}">${x}</button>`).join('')}</div>`;
  if(S.tab<4){
    const none=`<div class="empty">Agrega tu lista de estudiantes en la configuración del grupo.</div>`;
    h+=`<div id="stats"></div>`;
    g.cats.forEach(c=>{
      const acs=g.ac.filter(a=>a.t==S.tab&&a.c==c.id);
      h+=`<h3 class="ct">${esc(c.n)}</h3><div class="add"><input id="an-${c.id}" placeholder="Nueva nota, por ejemplo ${esc(c.n)} ${acs.length+1}" aria-label="Nueva nota de ${esc(c.n)}"><button data-a="aa" data-id="${c.id}">Agregar nota</button></div>`;
      h+=g.st.length?`<div class="wrap"><table><thead><tr><th>Estudiante</th>${acs.map(a=>`<th>${esc(a.n)}<button class="x" data-a="da" data-id="${a.id}" aria-label="Quitar nota">×</button></th>`).join('')}<th>Promedio</th></tr></thead><tbody>${g.st.map(s=>`<tr><td>${nm(s)}</td>${acs.map(a=>`<td><input class="gi" type="number" inputmode="decimal" step="0.1" min="1" max="5" data-g="${s.id}|${a.id}" value="${g.gr[s.id+'|'+a.id]??''}" aria-label="${esc(s.n)}, ${esc(a.n)}"></td>`).join('')}<td class="p" data-s="${s.id}" data-t="c:${c.id}"></td></tr>`).join('')}</tbody></table></div>`:none;
    });
    h+=`<h3 class="ct">Nota del trimestre</h3>`+(g.st.length?`<div class="wrap"><table><thead><tr><th>Estudiante</th>${g.cats.map(c=>`<th>${esc(c.n)}</th>`).join('')}<th>Trimestre</th></tr></thead><tbody>${g.st.map(s=>`<tr><td>${nm(s)}</td>${g.cats.map(c=>`<td class="p" data-s="${s.id}" data-t="c:${c.id}"></td>`).join('')}<td class="p" data-s="${s.id}" data-t="${S.tab}"></td></tr>`).join('')}</tbody></table></div>`:none);
  }else{
    h+=`<div id="stats"></div>`;
    h+=g.st.length?`<div class="wrap"><table><thead><tr><th>Estudiante</th><th>Trim. I</th><th>Trim. II</th><th>Trim. III</th><th>Final</th></tr></thead><tbody>${g.st.map(s=>`<tr><td>${nm(s)}</td>${['1','2','3','f'].map(t=>`<td class="p" data-s="${s.id}" data-t="${t}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<div class="empty">Todavía no hay estudiantes en este grupo.</div>`;
  }
  $('#app').innerHTML=h;
  if(open)document.querySelector('details').open=true;
  refresh();
}
const $=s=>document.querySelector(s);
function refresh(){
  const g=G(),vals=[];
  document.querySelectorAll('td.p').forEach(td=>{
    const s=g.st.find(x=>x.id==td.dataset.s),t=td.dataset.t,v=t=='f'?fin(g,s):t[0]=='c'?catAvg(g,s,S.tab,t.slice(2)):tri(g,s,t);
    td.textContent=fmt(v);td.classList.toggle('bad',v!=null&&v<g.min);
    if(t==(S.tab<4?S.tab:'f')&&v!=null)vals.push(v);
  });
  const st=$('#stats');
  if(st)st.textContent=vals.length?`Promedio del grupo: ${fmt(avg(vals))}. Por debajo de ${g.min}: ${vals.filter(v=>v<g.min).length} de ${vals.length}.`:'Escribe notas del 1.0 al 5.0 y los promedios aparecen aquí.';
  const w=$('#wsum');if(w){const t=Math.round(g.cats.reduce((p,c)=>p+(+c.w||0),0)*10)/10;w.textContent=`Suman ${t}%${t==100?'':' (lo normal es 100%)'}`}
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a,g=G(),id=b.dataset.id;
  if(!isPro()&&((a=='ng'&&used()>=1)||(a=='ex'&&S.groups.length>=1))){openPlans('limit');return}
  if(a=='ng'){S.created=used()+1;const n={id:crypto.randomUUID(),n:'Grupo nuevo',sub:'Materia',min:3,cats:cats0(),st:[],ac:[],gr:{}};S.groups.push(n);S.cur=n.id}
  else if(a=='da'){delAccount();return}
  else if(a=='sg')S.cur=id;
  else if(a=='ds'){
    if(!isPro()){openPlans('delst');return}
    const i=g.st.findIndex(x=>x.id==id);if(i<0)return;
    const st=g.st[i],gr={};
    Object.keys(g.gr).forEach(k=>{if(k.startsWith(st.id+'|')){gr[k]=g.gr[k];delete g.gr[k]}});
    g.st.splice(i,1);lastDs={g,s:st,i,gr};toastDs(st.n);
  }
  else if(a=='ex'){const n=sample();S.groups.push(n);S.cur=n.id;S.tab=1}
  else if(a=='dg'){if(!canDel(g)){openPlans('delete');return}if(!window.__dg){window.__dg=true;b.textContent='¿Seguro? Toca otra vez para eliminar';return}window.__dg=false;queueDel(g);S.groups=S.groups.filter(x=>x.id!=g.id);S.cur=S.groups[0]?S.groups[0].id:null}
  else if(a=='nc')g.cats.push({id:uid(),n:'Nueva',w:10});
  else if(a=='dc'){if(g.cats.length<2)return;g.cats=g.cats.filter(c=>c.id!=id);g.ac=g.ac.filter(x=>x.c!=id)}
  else if(a=='tab')S.tab=+id;
  else if(a=='aa'){const inp=$('#an-'+id),n=T(inp.value.trim(),60);if(!n){inp.focus();return}if(g.ac.length<300)g.ac.push({id:uid(),t:S.tab,n,c:id})}
  else if(a=='da')g.ac=g.ac.filter(x=>x.id!=id);
  else if(a=='as'){$('#stin').value.split('\n').map(x=>T(x.trim(),80)).filter(Boolean).slice(0,200).forEach(n=>{if(g.st.length<500)g.st.push({id:uid(),n})})}
  save();render();
});
document.addEventListener('change',e=>{
  const t=e.target,g=G();
  if(t.id=='gsel'){S.cur=t.value;save();render();return}
  if(!t.dataset.k)return;
  const val=t.type=='number'?(t.dataset.k=='min'?NUM(t.value,1,5,3):NUM(t.value,0,100,0)):T(t.value,80);
  if(t.dataset.c)g.cats.find(c=>c.id==t.dataset.c)[t.dataset.k]=val;else g[t.dataset.k]=val;
  save();render();
});
document.addEventListener('input',e=>{
  const t=e.target;if(!t.dataset.g)return;
  const v=parseFloat(t.value),g=G();
  if(!isNaN(v)&&v>=1&&v<=5)g.gr[t.dataset.g]=v;else delete g.gr[t.dataset.g];
  save();refresh();
});
const LOGO='<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect width="32" height="32" rx="9" style="fill:var(--ac)"/><text x="16" y="22" text-anchor="middle" font-size="21" font-weight="800" font-family="Bricolage Grotesque,system-ui,sans-serif" style="fill:var(--bg)">P</text><rect x="8" y="25" width="16" height="3.2" rx="1.6" fill="#f2c94c"/></svg>';
const gate=$('#gate'),main=$('#appmain');
$('#brand2').innerHTML=LOGO+'Promedia';
const nav=`<div class="nav"><button class="link brand" data-go="home">${LOGO}Promedia</button><span><button class="ghost" data-go="login">Iniciar sesión</button> <button data-go="reg">Crear cuenta</button></span></div>`;
const INFO=`<section class="info"><div class="two"><div><h2>¿Qué es Promedia y cómo funciona?</h2><p>Promedia es una herramienta web para docentes que calcula las notas de sus estudiantes. En cada trimestre anotas las notas de tres casillas (apreciación, parciales y examen o proyecto trimestral), y Promedia saca el promedio de cada casilla, la nota del trimestre y la nota final del año.</p><p>Usa la escala de 1.0 a 5.0, con una nota mínima para aprobar que tú ajustas. Se basa en un método común de tres casillas por trimestre; confirma siempre cómo lo aplica el reglamento de tu centro.</p></div><svg class="illus" viewBox="0 0 360 230" role="img" aria-label="Libreta de notas con los promedios calculados"><rect x="8" y="8" width="344" height="214" rx="14" style="fill:var(--sf);stroke:var(--ln)" stroke-width="2"/><rect x="9" y="9" width="342" height="38" rx="13" style="fill:var(--acb)"/><text x="24" y="33" font-size="14" font-weight="700" style="fill:var(--tx)">5.º A · Matemática</text><g font-size="11" text-anchor="middle" style="fill:var(--mu)"><text x="170" y="68">Aprec.</text><text x="222" y="68">Parc.</text><text x="274" y="68">Examen</text><text x="326" y="68">Trim.</text></g><line x1="20" x2="340" y1="76" y2="76" style="stroke:var(--ln)"/><g font-size="13" style="fill:var(--tx)"><text x="24" y="104">Ana Pérez</text><text x="24" y="144">Luis Gómez</text><text x="24" y="184">María Castillo</text><g text-anchor="middle"><text x="170" y="104">4.75</text><text x="222" y="104">4.10</text><text x="274" y="104">4.50</text><text x="170" y="144">3.00</text><text x="222" y="144">2.80</text><text x="274" y="144">3.10</text><text x="170" y="184">5.00</text><text x="222" y="184">4.90</text><text x="274" y="184">4.70</text></g></g><rect x="304" y="88" width="44" height="22" rx="6" style="fill:var(--hl)"/><rect x="304" y="128" width="44" height="22" rx="6" style="fill:var(--bad)"/><rect x="304" y="168" width="44" height="22" rx="6" style="fill:var(--hl)"/><g font-size="13" font-weight="700" text-anchor="middle"><text x="326" y="104" fill="#1f2933">4.45</text><text x="326" y="144" fill="#fff">2.96</text><text x="326" y="184" fill="#1f2933">4.86</text></g></svg></div><h2>Calculadora de notas: ¿qué puedes calcular aquí?</h2><ul><li>El promedio de cada casilla: apreciación, parciales y examen o proyecto.</li><li>La nota de cada trimestre y la nota final del año.</li><li>El promedio de todo el grupo y cuántos estudiantes están por debajo de la nota mínima.</li><li>Resultados provisionales cuando aún falta alguna casilla, por ejemplo antes del examen.</li></ul><h2>Casos comunes donde esta herramienta es útil</h2><ul><li>Docentes con varios grupos y materias que llevan las notas en cuaderno o Excel.</li><li>Cierre de trimestre, cuando hay que revisar promedios antes de llenar los boletines.</li><li>Reuniones con padres de familia, para explicar de dónde sale la nota de un estudiante.</li><li>Detectar a tiempo qué estudiantes están en riesgo de no aprobar.</li></ul><h2>¿Por qué usar una calculadora de notas?</h2><ul><li>Ahorra tiempo: las cuentas se hacen al escribir cada nota.</li><li>Evita errores de suma y división al promediar muchas notas.</li><li>Marca en rojo las notas bajas para verlas de inmediato.</li><li>Funciona en el celular y en la computadora, con tus grupos siempre ordenados.</li></ul><h2>Cómo usar Promedia: guía paso a paso</h2><ol class="guide"><li><b>Crea tu cuenta</b> con tu correo y una contraseña.</li><li><b>Crea tu grupo</b> y agrega la lista de estudiantes, incluso pegada desde Excel.</li><li><b>Revisa las casillas</b> en la configuración y ajusta la nota mínima si hace falta.</li><li><b>Agrega las notas</b> de cada casilla en el trimestre que corresponda.</li><li><b>Consulta los resultados:</b> promedio por casilla, nota del trimestre y nota final del año.</li></ol></section>`;
const PAGES={
 priv:['Política de Privacidad',`<p class="upd">Última actualización: 22 de octubre de 2026.</p><p>En Promedia cuidamos la información que escribes. Esta política explica qué datos usamos y para qué.</p><h3>Qué datos usamos</h3><p>Tu nombre y correo para crear la cuenta, y las listas de estudiantes y notas que tú mismo escribes.</p><h3>Dónde se guardan</h3><p>Tus datos se guardan en servidores en la nube (Supabase), con reglas de seguridad para que solo tú puedas ver tus grupos y notas. De los pagos registramos el plan, el monto, la fecha y la referencia.</p><h3>Datos de estudiantes</h3><p>Tú decides qué datos de tus estudiantes escribes. Te recomendamos usar solo el nombre y evitar información sensible. Promedia no usa estos datos para otros fines.</p><h3>Lo que no hacemos</h3><p>No vendemos tus datos ni mostramos anuncios de terceros.</p><h3>Tus derechos</h3><p>Puedes pedir acceso, corrección o eliminación de tus datos, conforme a la normativa aplicable de protección de datos personales. Escríbenos a jonathanalex0230@gmail.com.</p>`],
 about:['Sobre Nosotros',`<p>Promedia nació para ayudar a los docentes a calcular las notas de sus estudiantes sin cuadernos llenos de sumas ni hojas de Excel difíciles de mantener.</p><p>Es una herramienta independiente, creada con una idea sencilla: que anotar una nota sea lo único que tengas que hacer, y que Promedia se encargue del resto.</p><h3>Qué viene</h3><p>Estamos mejorando la herramienta junto con docentes: asistencia, exportar a Excel o PDF, y respaldo en la nube. Si eres docente y quieres probarla, escríbenos.</p>`],
 contact:['Contacto',`<p>¿Tienes una pregunta, una sugerencia o encontraste un error? Nos ayuda mucho saberlo.</p><ul><li>Correo: jonathanalex0230@gmail.com</li><li>WhatsApp: <a href="https://wa.me/50765646376" target="_blank" rel="noopener">6564-6376</a></li></ul><p>Respondemos lo antes posible. Si eres docente y quieres probar Promedia con tus grupos, cuéntanos qué materias das y qué te gustaría que la herramienta hiciera.</p>`],
 terms:['Términos y Condiciones',`<p class="upd">Última actualización: 22 de octubre de 2026.</p><h3>Uso de la herramienta</h3><p>Promedia es una herramienta de apoyo para calcular notas con fines informativos y educativos. Al usarla aceptas estos términos.</p><h3>Tu responsabilidad</h3><p>Los resultados son orientativos. Eres responsable de verificarlos con el reglamento de evaluación de tu centro educativo antes de registrar notas oficiales.</p><h3>Tu cuenta</h3><p>Debes dar datos verdaderos y cuidar tu contraseña. Eres responsable de la información que escribas, incluidos los datos de tus estudiantes.</p><h3>Uso permitido</h3><p>No uses Promedia para actividades ilegales ni para intentar dañar o copiar el servicio.</p><h3>Sin garantías</h3><p>Hacemos lo posible para que los cálculos sean correctos, pero no garantizamos que el servicio esté libre de errores ni disponible siempre.</p><h3>Cambios</h3><p>Podemos actualizar estos términos y avisaremos en esta página. Se rigen por las leyes de la República de Panamá.</p>`],
 cookies:['Política de Cookies',`<p class="upd">Última actualización: 22 de octubre de 2026.</p><p>Promedia no usa cookies de seguimiento ni de publicidad.</p><h3>Qué guardamos en tu navegador</h3><p>Usamos el almacenamiento local de tu navegador solo para mantener tu sesión iniciada y recordar el grupo que estabas viendo. Tus grupos y notas se guardan en la nube, en tu cuenta.</p><h3>Cómo borrarlo</h3><p>Puedes borrar estos datos desde la configuración de tu navegador. Si lo haces, tendrás que iniciar sesión de nuevo, pero tus notas siguen guardadas en tu cuenta.</p>`],
 disc:['Descargo de Responsabilidad',`<p>Promedia es una herramienta independiente, creada con fines informativos y educativos.</p><p>No estamos afiliados, respaldados ni conectados oficialmente con ningún ministerio de educación, institución educativa, plataforma de notas o empresa externa. Las marcas y documentos que se mencionen son de sus respectivos dueños.</p><p>Los cálculos son orientativos y no reemplazan los registros oficiales de tu centro educativo. Verifica siempre las notas con el reglamento de evaluación vigente.</p>`]
};
const footer=()=>`<footer class="foot"><div class="fg"><div class="fb"><span class="brand">${LOGO}Promedia</span><p>Las notas de tu clase, sin hacer cuentas.</p></div><div><h4>Información</h4><button class="fk" data-go="priv">Política de Privacidad</button><button class="fk" data-go="terms">Términos y Condiciones</button><button class="fk" data-go="cookies">Política de Cookies</button><button class="fk" data-go="disc">Descargo de Responsabilidad</button></div><div><h4>Promedia</h4><button class="fk" data-go="about">Sobre Nosotros</button><button class="fk" data-go="contact">Contacto</button></div><div><h4>Escríbenos</h4><span class="fk fx">jonathanalex0230@gmail.com</span><a class="fk" href="https://wa.me/50765646376" target="_blank" rel="noopener">WhatsApp 6564-6376</a></div></div><p class="fl2">© 2026 Promedia. Herramienta independiente con fines informativos y educativos; no está afiliada ni respaldada por ningún ministerio ni institución educativa.</p></footer>`;
const PM={
 priv:['#1f6f9f','Cómo cuidamos tu información','<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'],
 about:['#2f7a4f','Quiénes somos y por qué lo hacemos','<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'],
 contact:['#7a56b3','Escríbenos, te leemos','<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'],
 terms:['#1f4e79','Reglas claras para usar Promedia','<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>'],
 cookies:['#9a6412','Qué guardamos en tu navegador','<path d="M12 3a9 9 0 109 9 4 4 0 01-4-4 4 4 0 01-5-5z"/><path d="M9 11h.01M13 15h.01M9 15h.01"/>'],
 disc:['#a6453a','Lo que debes saber antes de usar los resultados','<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>']
};
const SV=(p,s)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const BACK=SV('<path d="M15 6l-6 6 6 6"/>',18),FWD=SV('<path d="M9 6l6 6-6 6"/>',16);
function pageHTML(k){
  const t=PAGES[k][0],m=PM[k],parts=PAGES[k][1].split('<h3>'),lead=parts.shift();
  const cards=parts.map((p,i)=>{const j=p.indexOf('</h3>');return `<section class="lc"><span class="nm">${String(i+1).padStart(2,'0')}</span><div><h3>${p.slice(0,j)}</h3>${p.slice(j+5)}</div></section>`}).join('');
  const others=Object.keys(PAGES).filter(x=>x!=k).map(x=>`<button class="oc" style="--pc:${PM[x][0]}" data-go="${x}"><i></i>${PAGES[x][0]}${FWD}</button>`).join('');
  return `<article class="legal" style="--pc:${m[0]}"><button class="back" data-go="home">${BACK}Volver al inicio</button><header class="lh"><div><span class="eyebrow">${['about','contact'].includes(k)?'Promedia':'Legal'}</span><h2>${t}</h2><p>${m[1]}</p></div><span class="wm">${SV(m[2],112)}</span></header>${lead.trim()?`<div class="lead">${lead}</div>`:''}${cards}<div class="more"><h3>Otras páginas</h3><div class="ocs">${others}</div></div><button class="big home" data-go="home">${BACK}Volver al inicio</button></article>`;
}
function page(k){
  main.hidden=true;gate.hidden=false;
  gate.innerHTML=nav+pageHTML(k)+footer();
  window.scrollTo(0,0);
}
const BK=[['Ana Pérez',[4.75,4.1,4.5]],['Luis Gómez',[3,2.8,3.1]],['María Castillo',[5,4.9,4.7]],['Carlos Ríos',[3.6,3.2,3.3]]];
const BOOKT=`<table id="bk"><thead><tr><th>Estudiante</th><th>Aprec.</th><th>Parc.</th><th>Examen</th><th>Trim.</th></tr></thead><tbody>${BK.map(r=>`<tr><td>${r[0]}</td>${r[1].map(x=>`<td data-v="${x.toFixed(2)}"></td>`).join('')}<td class="tt"></td></tr>`).join('')}</tbody></table>`;
function book(){
  const t=document.getElementById('bk');if(!t)return;
  const cells=[...t.querySelectorAll('td[data-v]')],tt=[...t.querySelectorAll('td.tt')],rm=matchMedia('(prefers-reduced-motion:reduce)').matches;
  let n=0;
  const clear=()=>{[...cells,...tt].forEach(c=>{c.textContent='';c.classList.remove('in','low')});n=0};
  const step=()=>{
    if(!document.getElementById('bk'))return;
    if(n<cells.length){
      const c=cells[n++];c.textContent=c.dataset.v;c.classList.add('in');
      if(n%3==0){const r=n/3-1,m=avg(BK[r][1]),c2=tt[r];c2.textContent=(Math.floor(m*100+1e-9)/100).toFixed(2);c2.classList.add('in');c2.classList.toggle('low',m<3)}
      setTimeout(step,rm?0:240);
    }else if(!rm)setTimeout(()=>{clear();step()},4200);
  };
  step();
}
function reveal(){
  const els=[...document.querySelectorAll('.rv')];
  if(!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('on'));return}
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target)}}),{threshold:.15});
  els.forEach(e=>io.observe(e));
}
function demo(){
  const v=[...document.querySelectorAll('.dm')].map(i=>parseFloat(i.value)).filter(x=>x>=1&&x<=5),r=$('#dres'),f=$('#dfx');
  if(!v.length){r.textContent='–';f.textContent='Escribe notas del 1.0 al 5.0';return}
  const m=v.reduce((a,b)=>a+b,0)/v.length;
  r.textContent=(Math.floor(m*100+1e-9)/100).toFixed(2);r.classList.toggle('low',m<3);
  f.textContent='('+v.map(x=>x.toFixed(2)).join(' + ')+') ÷ '+v.length;
}
function home(){
  main.hidden=true;gate.hidden=false;
  gate.innerHTML=nav+`<section class="hero2"><div class="glow"></div><div class="h2c"><span class="pill">Pensada para docentes</span><h2>Cada nota al instante. Cada promedio sin errores.</h2><p>Promedia suma, divide y ordena por ti: apreciación, parciales y examen se convierten en la nota del trimestre y en la nota final del año.</p><div class="cta"><button class="big" data-go="reg">Crear cuenta gratis</button><button class="big ghost" data-go="login">Ya tengo cuenta</button></div><ul class="proof"><li><b>3</b>casillas por trimestre</li><li><b>1.0 a 5.0</b>escala de notas</li><li><b>0</b>cuentas a mano</li></ul></div><div class="book" aria-hidden="true"><div class="bh">5.º A · Matemática<span>Trimestre I</span></div>${BOOKT}</div></section><section class="rv ba"><div class="before"><h3>Antes</h3><p class="scrib">4.5 + 3.8 + 4.2 = 12.5<br>12.5 ÷ 3 = 4.1<s>7</s>…<br>¿4.17 o 4.16?</p><small>Cuaderno, calculadora y dudas.</small></div><div class="arrow" aria-hidden="true">→</div><div class="after"><h3>Con Promedia</h3><div class="dres sm">4.16</div><small>Escribes las notas. El resto es automático.</small></div></section><section class="rv flow"><h2>El camino de una nota</h2><div class="pipe"><div class="chips"><span>Apreciación <b>4.75</b></span><span>Parciales <b>4.10</b></span><span>Examen <b>4.50</b></span></div><div class="op">se promedian</div><div class="node">Trimestre <b>4.45</b></div><div class="op">promedio de los 3 trimestres</div><div class="node end">Nota final <b>4.45</b></div></div></section><section class="rv try"><h2>Pruébalo ahora</h2><div class="calc"><h3>Cambia una nota y mira el resultado</h3><label>Apreciación<input class="dm" type="number" step="0.1" min="1" max="5" value="4.75"></label><label>Parciales<input class="dm" type="number" step="0.1" min="1" max="5" value="4.10"></label><label>Examen<input class="dm" type="number" step="0.1" min="1" max="5" value="4.50"></label><div class="dres" id="dres"></div><div class="dfx" id="dfx"></div></div></section>`+INFO+footer();
  document.querySelectorAll('.dm').forEach(i=>i.oninput=demo);demo();book();reveal();
}
function authView(mode,msg,em){
  const reg=mode=='reg';main.hidden=true;gate.hidden=false;
  gate.innerHTML=nav+`<div class="auth"><h2 style="margin:0">${reg?'Crea tu cuenta':'Inicia sesión'}</h2>${reg?'<label>Nombre<input id="nm" autocomplete="name" maxlength="80"></label>':''}<label>Correo<input id="em" type="email" maxlength="254" autocomplete="email" value="${esc(em||'')}"></label><label>Contraseña<input id="pw" type="password" maxlength="128" autocomplete="${reg?'new-password':'current-password'}"></label>${reg?'<small class="sub">Mínimo 10 caracteres, con letras y números.</small>':''}<div class="err" role="alert">${msg||''}</div><button class="big" data-go="sub" data-mode="${mode}">${reg?'Crear cuenta':'Entrar'}</button>${reg?'':'<div><button class="link" data-go="forgot">¿Olvidaste tu contraseña?</button></div>'}<div>${reg?'¿Ya tienes cuenta?':'¿Eres nuevo?'} <button class="link" data-go="${reg?'login':'reg'}">${reg?'Inicia sesión':'Crea tu cuenta'}</button></div><small class="sub">Tus datos se guardan de forma segura en tu cuenta.</small></div>`;
  $('#pw').onkeydown=e=>{if(e.key=='Enter')submit(mode)};
}
let REC=/type=recovery/.test(location.hash);
function forgotView(msg,em,ok){
  main.hidden=true;gate.hidden=false;
  gate.innerHTML=nav+`<div class="auth"><h2 style="margin:0">Recuperar contraseña</h2><p class="sub" style="margin:0">Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.</p><label>Correo<input id="em" type="email" maxlength="254" autocomplete="email" value="${esc(em||'')}"></label><div class="${ok?'sub':'err'}" role="alert">${msg||''}</div><button class="big" data-go="sendreset">Enviar enlace</button><div><button class="link" data-go="login">Volver a iniciar sesión</button></div></div>`;
}
async function sendReset(){
  const em=$('#em').value.trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(em))return forgotView('Escribe un correo válido.',em);
  const {error}=await sb.auth.resetPasswordForEmail(em,{redirectTo:location.origin+location.pathname});
  if(error)return forgotView(esc(error.message),em);
  forgotView('Listo. Si ese correo tiene cuenta, te enviamos un enlace. Revisa también la carpeta de spam.',em,true);
}
function resetView(msg){
  main.hidden=true;gate.hidden=false;
  gate.innerHTML=nav+`<div class="auth"><h2 style="margin:0">Crea tu nueva contraseña</h2><label>Nueva contraseña<input id="np" type="password" maxlength="128" autocomplete="new-password"></label><label>Repite la contraseña<input id="np2" type="password" maxlength="128" autocomplete="new-password"></label><div class="err" role="alert">${msg||''}</div><button class="big" data-go="setpw">Guardar contraseña</button></div>`;
}
async function setPw(){
  const a=$('#np').value,b=$('#np2').value;
  if(a.length<10||a.length>128||!/[A-Za-z]/.test(a)||!/\d/.test(a))return resetView('Usa una contraseña de al menos 10 caracteres, con letras y números.');
  if(a!==b)return resetView('Las contraseñas no coinciden.');
  const {data,error}=await sb.auth.updateUser({password:a});
  if(error)return resetView(esc(error.message));
  REC=false;history.replaceState(null,'',location.pathname);enter(data.user);
}
async function resend(){
  const em=$('#em').value.trim().toLowerCase();if(!em)return;
  const {error}=await sb.auth.resend({type:'signup',email:em});
  authView('login',error?esc(error.message):'Te reenviamos el correo de confirmación. Revisa también el spam.',em);
}
async function submit(mode){
  const em=$('#em').value.trim().toLowerCase(),pw=$('#pw').value,nm=($('#nm')||{value:''}).value.trim();
  if(!/^\S+@\S+\.\S+$/.test(em))return authView(mode,'Escribe un correo válido.',em);
  if(mode=='reg'&&(pw.length<10||!/[A-Za-z]/.test(pw)||!/\d/.test(pw)))return authView(mode,'Usa una contraseña de al menos 10 caracteres, con letras y números.',em);
  if(pw.length<6||pw.length>128)return authView(mode,'Revisa tu contraseña.',em);
  if(mode=='reg'){
    const {data,error}=await sb.auth.signUp({email:em,password:pw,options:{data:{nombre:nm||em}}});
    if(error)return authView(mode,esc(error.message),em);
    if(!data.session)return authView('login','Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.',em);
    return enter(data.session.user);
  }
  const {data,error}=await sb.auth.signInWithPassword({email:em,password:pw});
  if(error){if((error.message||'').toLowerCase().includes('not confirmed'))return authView(mode,'Aún no has confirmado tu correo. Revisa tu bandeja y el spam. <button class="link" data-go="resend">Reenviar correo</button>',em);return authView(mode,(error.message||'').toLowerCase().includes('invalid login')?'Correo o contraseña incorrectos.':esc(error.message),em)}
  enter(data.user);
}
async function enter(u){
  UID=u.id;ME=u.email;
  const [p,g]=await Promise.all([sb.from('perfiles').select('*').eq('id',UID).single(),sb.from('grupos').select('*').order('creado_en')]);
  const pf=p.data||{};ADMIN=!!pf.es_admin;admBadge();if(ADMIN&&!window.__ai){window.__ai=setInterval(admBadge,60000)}
  let ui={};try{ui=JSON.parse(localStorage.getItem('promedia:ui'))||{}}catch(e){}
  S={cur:ui.cur||null,tab:ui.tab||1,removed:[],created:pf.grupos_creados||0,
     plan:pf.plan_fin?{tipo:pf.plan_tipo,inicio:Date.parse(pf.plan_inicio),fin:Date.parse(pf.plan_fin)}:null,
     groups:(g.data||[]).map(clean)};
  S.groups.forEach(x=>x.h=sig(x));
  if(!S.groups.find(x=>x.id==S.cur))S.cur=S.groups[0]?S.groups[0].id:null;
  $('#who').textContent=pf.nombre||ME;
  refreshPlan();
  gate.hidden=true;main.hidden=false;render();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-go]');if(!b)return;const k=b.dataset.go;
  if(k=='out'){sb.auth.signOut().then(()=>{UID=null;S=null;ADMIN=false;try{localStorage.removeItem('promedia:ui')}catch(e){}home()})}else if(k=='home')home();else if(k=='sub')submit(b.dataset.mode);else if(k=='forgot')forgotView('',($('#em')||{value:''}).value);else if(k=='sendreset')sendReset();else if(k=='setpw')setPw();else if(k=='resend')resend();else if(k=='plans')openPlans('');else if(k=='admin')openAdmin();else if(PAGES[k])page(k);else authView(k);
});
let ME='';
const YAPPY='6564-6376',WA='50765646376';
const PLANS={mensual:{n:'Pro mensual',p:5,m:1,l:'$5 al mes'},anual:{n:'Pro anual',p:40,m:12,l:'$40 al año'}};
const addM=(t,n)=>{const d=new Date(t);d.setMonth(d.getMonth()+n);return d.getTime()};
const fdate=t=>new Date(t).toLocaleDateString('es',{day:'numeric',month:'long',year:'numeric'});
const isPro=()=>!!(S&&S.plan&&S.plan.fin>Date.now());
const used=()=>Math.max(S.created||0,S.groups.filter(g=>!g.ej).length);
const canDel=g=>isPro()||!!(g&&(g.ej||/\(ejemplo\)/.test(g.n)));
function badge(){const b=$('#pbadge');if(!b)return;b.textContent=isPro()?'Pro hasta '+fdate(S.plan.fin):(S.pend?'Pago en revisión':'Plan gratis · 1 grupo');b.classList.toggle('pro',isPro())}
function closePlans(){const m=$('#pm');if(m)m.remove()}
function openPlans(why,sel){
  closePlans();refreshPlan();let b;
  if(why=='paid')b=`<h2>Pago enviado</h2><p>Lo verificaré en mi Yappy y activaré tu plan. Normalmente toma menos de 24 horas.</p><button data-pm="close">Entendido</button>`;
  else if(sel){
    const P=PLANS[sel],ini=isPro()?S.plan.fin:Date.now(),fin=addM(ini,P.m),msg=`Hola, pagué el plan ${P.n} (${P.l}) por Yappy. Mi correo en Promedia es ${ME}.`;
    b=`<h2>${P.n}</h2><p>Total a pagar: <b>$${P.p}</b> (${P.l})</p><div class="paybox"><div class="pl">1 · Envía el pago por Yappy</div><div class="pv"><b>${YAPPY}</b><button class="ghost cp" data-pm="copy" data-t="${YAPPY}">Copiar número</button></div></div><div class="paybox"><div class="pl">2 · Escribe tu correo en el mensaje del Yappy</div><div class="pv"><b>${esc(ME)}</b><button class="ghost cp" data-pm="copy" data-t="${esc(ME)}">Copiar</button></div></div><div class="paybox"><div class="pl">3 · Avísame por WhatsApp</div><a class="btn" data-pm="paid" data-pl="${sel}" href="https://wa.me/${WA}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Ya pagué, avisar por WhatsApp</a></div><p class="fine">Verifico tu pago y activo tu plan, normalmente en menos de 24 horas. Tu plan empezaría el ${fdate(ini)} y terminaría el ${fdate(fin)}.</p><p><button class="link" data-pm="back">← Ver otros planes</button></p>`;
  }else{
    b=`<h2>${why=='limit'?'Llegaste al límite del plan gratis':why=='delete'?'Eliminar grupos es una función Pro':why=='delst'?'Eliminar estudiantes es una función Pro':'Planes'}</h2><p>${why=='limit'?'El plan gratis permite crear 1 grupo. Pasa a Pro para crear los que necesites.':why=='delete'?'En el plan gratis los grupos no se pueden eliminar. Pasa a Pro para eliminarlos y organizar todos los que necesites.':why=='delst'?'En el plan gratis no se pueden eliminar estudiantes. Pasa a Pro para quitarlos de la lista cuando lo necesites.':isPro()?'Tu plan Pro empezó el '+fdate(S.plan.inicio)+' y termina el '+fdate(S.plan.fin)+'. Puedes renovar cuando quieras.':'Elige el plan que te convenga.'}</p>${S.pend&&!isPro()?'<div class="paybox">Tienes un pago en revisión. Te avisaré por WhatsApp cuando tu plan esté activo.</div>':''}<div class="plans"><div class="pcard"><h3>Gratis</h3><div class="pr">$0</div><ul><li>1 grupo</li><li>Notas, trimestres y promedios</li></ul><button class="ghost" disabled>${isPro()?'Incluido':'Tu plan actual'}</button></div><div class="pcard"><h3>Pro mensual</h3><div class="pr">$5<small>/mes</small></div><ul><li>Grupos ilimitados</li><li>Más funciones, próximamente</li></ul><button data-pm="m">Elegir mensual</button></div><div class="pcard best"><span class="tag">Ahorra $20</span><h3>Pro anual</h3><div class="pr">$40<small>/año</small></div><ul><li>Grupos ilimitados</li><li>Más funciones, próximamente</li></ul><button data-pm="a">Elegir anual</button></div></div>`;
  }
  const m=document.createElement('div');m.id='pm';m.className='pm';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');
  m.innerHTML=`<div class="pp"><button class="x pclose" data-pm="close" aria-label="Cerrar">×</button>${b}</div>`;
  document.body.appendChild(m);
}
async function admBadge(){
  const b=$('#admbtn');if(!b)return;
  b.hidden=!ADMIN;if(!ADMIN)return;
  const {count}=await sb.from('pagos').select('id',{count:'exact',head:true}).eq('estado','pendiente');
  b.innerHTML='Administrar'+(count?`<span class="cnt">${count}</span>`:'');
  b.setAttribute('aria-label','Pagos pendientes'+(count?': '+count:''));
}
let admQ='',USERS=[],PEND={};
function openAdmin(){
  closePlans();
  const m=document.createElement('div');m.id='pm';m.className='pm';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');
  m.innerHTML=`<div class="pp wide"><button class="x pclose" data-pm="close" aria-label="Cerrar">×</button><h2>Administrar maestros</h2><p>Busca al maestro, verifica su pago en tu Yappy y activa su plan. Los que avisaron que pagaron aparecen primero.</p><div id="adm">Cargando…</div></div>`;
  document.body.appendChild(m);loadAdm();
}
async function loadAdm(){
  const [u,p]=await Promise.all([
    sb.from('perfiles').select('id,nombre,correo,plan_tipo,plan_inicio,plan_fin,creado_en').order('creado_en',{ascending:false}),
    sb.from('pagos').select('id,usuario_id,plan,creado_en').eq('estado','pendiente')]);
  const el=$('#adm');if(!el)return;
  if(u.error||p.error){el.textContent='No se pudo cargar: '+(u.error||p.error).message;return}
  USERS=u.data;PEND={};
  p.data.forEach(x=>{(PEND[x.usuario_id]=PEND[x.usuario_id]||[]).push(x)});
  el.innerHTML=`<input id="uq" class="uq" placeholder="Buscar por nombre o correo" value="${esc(admQ)}"><div id="ul"></div>`;
  $('#uq').oninput=e=>{admQ=e.target.value;drawUsers()};
  drawUsers();
}
function drawUsers(){
  const q=admQ.toLowerCase(),now=Date.now();
  const rows=USERS.filter(u=>(u.nombre||'').toLowerCase().includes(q)||(u.correo||'').toLowerCase().includes(q))
    .sort((a,b)=>(PEND[b.id]?1:0)-(PEND[a.id]?1:0));
  $('#ul').innerHTML=rows.length?rows.map(u=>{
    const fin=u.plan_fin?Date.parse(u.plan_fin):0,act=fin>now,pe=PEND[u.id];
    const st=act?`<span class="chip ok">Pro ${u.plan_tipo} · hasta ${fdate(fin)}</span>`:(fin?`<span class="chip bad">Pro vencido el ${fdate(fin)}</span>`:`<span class="chip">Gratis</span>`);
    const av=pe?` <span class="chip warn">Avisó pago ${pe[pe.length-1].plan} · ${fdate(pe[pe.length-1].creado_en)}</span>`:'';
    return `<div class="prow"><div><b>${esc(u.nombre||'')}</b> · ${esc(u.correo||'')}<br>${st}${av}</div><button data-pm="uact" data-id="${u.id}" data-pl="mensual">Mensual</button><button data-pm="uact" data-id="${u.id}" data-pl="anual">Anual</button>${fin?`<button class="ghost" data-pm="quit" data-id="${u.id}">Quitar Pro</button>`:''}${pe?`<button class="ghost" data-pm="dis" data-id="${pe.map(x=>x.id).join(',')}">Descartar aviso</button>`:''}</div>`;
  }).join(''):'No hay resultados.';
}
document.addEventListener('click',async e=>{
  if(e.target.id=='pm'){closePlans();return}
  const b=e.target.closest('[data-pm]');if(!b)return;const k=b.dataset.pm;
  if(k=='close')closePlans();
  else if(k=='m')openPlans('','mensual');
  else if(k=='a')openPlans('','anual');
  else if(k=='back')openPlans('');
  else if(k=='paid'){const pl=b.dataset.pl;if(!S.pend){await sb.from('pagos').insert({plan:pl,monto:PLANS[pl].p,metodo:'yappy'});S.pend=1;badge()}openPlans('paid')}
  else if(k=='copy'){try{await navigator.clipboard.writeText(b.dataset.t);b.textContent='Copiado'}catch(e){}}
  else if(k=='uact'){
    const u=USERS.find(x=>x.id==b.dataset.id);
    if(!confirm('¿Activar Pro '+b.dataset.pl+' a '+(u?u.correo:'este maestro')+'?'))return;
    const {error}=await sb.rpc('admin_activar_plan',{p_usuario:b.dataset.id,p_plan:b.dataset.pl});
    if(error)alert('No se pudo completar la acción. Intenta de nuevo.');loadAdm();admBadge();
  }
  else if(k=='quit'){
    const u=USERS.find(x=>x.id==b.dataset.id);
    if(!confirm('¿Quitar el plan Pro a '+(u?u.correo:'este maestro')+'?'))return;
    const {error}=await sb.rpc('admin_quitar_plan',{p_usuario:b.dataset.id});
    if(error)alert('No se pudo completar la acción. Intenta de nuevo.');loadAdm();
  }
  else if(k=='dis'){for(const id of b.dataset.id.split(',')){const {error}=await sb.rpc('rechazar_pago',{p_id:id});if(error){alert('No se pudo completar la acción. Intenta de nuevo.');break}}loadAdm();admBadge()}
});
addEventListener('keydown',e=>{if(e.key=='Escape')closePlans()});
async function delAccount(){
  if(!confirm('Se eliminarán tu cuenta, tus grupos, estudiantes y notas. Esta acción no se puede deshacer. ¿Continuar?'))return;
  if((prompt('Para confirmar, escribe ELIMINAR')||'').trim()!=='ELIMINAR')return;
  const {error}=await sb.rpc('eliminar_mi_cuenta');
  if(error){alert('No se pudo eliminar la cuenta. Escríbenos y te ayudamos.');return}
  await sb.auth.signOut();UID=null;S=null;ADMIN=false;
  try{localStorage.clear()}catch(e){}
  home();
}
let lastDs=null;
const nm=s=>esc(s.n)+`<button class="x dsb" data-a="ds" data-id="${s.id}" title="Eliminar estudiante" aria-label="Eliminar a ${esc(s.n)}">×</button>`;
function toastDs(n){
  const o=$('#ts');if(o)o.remove();
  const t=document.createElement('div');t.id='ts';t.className='toast';t.setAttribute('role','status');
  t.innerHTML=`Estudiante «${esc(n)}» eliminado <button data-undost>Deshacer</button>`;
  document.body.appendChild(t);
  setTimeout(()=>{t.remove();if(lastDs&&lastDs.s.n===n)lastDs=null},7000);
}
document.addEventListener('click',e=>{
  const u=e.target.closest('[data-undost]');if(!u||!lastDs)return;
  const d=lastDs;d.g.st.splice(d.i,0,d.s);Object.assign(d.g.gr,d.gr);lastDs=null;
  save();render();const t=$('#ts');if(t)t.remove();
});
let lastDel=null,lp=null;
function closeMenu(){const m=$('#cm');if(m)m.remove()}
function openMenu(x,y,id){
  closeMenu();const g=S.groups.find(q=>q.id==id);if(!g)return;
  const m=document.createElement('div');m.id='cm';m.className='cm';m.setAttribute('role','menu');
  m.innerHTML=`<div class="cmt">${esc(g.n)} · ${esc(g.sub)}</div>${canDel(g)?'':'<div class="cmt">En el plan gratis los grupos no se pueden eliminar.</div>'}<button role="menuitem" data-del="${id}">Eliminar grupo${canDel(g)?'':' (solo Pro)'}</button>`;
  document.body.appendChild(m);
  m.style.left=Math.max(8,Math.min(x,innerWidth-m.offsetWidth-8))+'px';
  m.style.top=Math.max(8,Math.min(y,innerHeight-m.offsetHeight-8))+'px';
}
function toast(n){
  const o=$('#ts');if(o)o.remove();
  const t=document.createElement('div');t.id='ts';t.className='toast';t.setAttribute('role','status');
  t.innerHTML=`Grupo «${esc(n)}» eliminado <button data-undo>Deshacer</button>`;
  document.body.appendChild(t);setTimeout(()=>t.remove(),7000);
}
document.addEventListener('contextmenu',e=>{const c=e.target.closest('.gc');if(!c)return;e.preventDefault();openMenu(e.clientX,e.clientY,c.dataset.gid)});
document.addEventListener('touchstart',e=>{const c=e.target.closest('.gc');if(!c)return;const t=e.touches[0];lp=setTimeout(()=>openMenu(t.clientX,t.clientY,c.dataset.gid),550)},{passive:true});
['touchend','touchmove','touchcancel'].forEach(n=>document.addEventListener(n,()=>clearTimeout(lp),{passive:true}));
document.addEventListener('click',e=>{
  const d=e.target.closest('[data-del]'),u=e.target.closest('[data-undo]');
  if(d){
    const i=S.groups.findIndex(q=>q.id==d.dataset.del);if(i>-1&&!canDel(S.groups[i])){closeMenu();openPlans('delete');return}
    if(i>-1){lastDel={g:S.groups[i],i};queueDel(S.groups[i]);S.groups.splice(i,1);if(S.cur==lastDel.g.id)S.cur=S.groups[0]?S.groups[0].id:null;save();render();toast(lastDel.g.n)}
    closeMenu();return;
  }
  if(u&&lastDel){S.removed=(S.removed||[]).filter(x=>x!==lastDel.g);S.groups.splice(lastDel.i,0,lastDel.g);S.cur=lastDel.g.id;lastDel=null;save();render();const t=$('#ts');if(t)t.remove();return}
  if(!e.target.closest('#cm'))closeMenu();
});
addEventListener('keydown',e=>{if(e.key=='Escape')closeMenu()});
addEventListener('scroll',closeMenu,{passive:true});
sb.auth.onAuthStateChange(ev=>{if(ev=='PASSWORD_RECOVERY'){REC=true;resetView()}});
sb.auth.getSession().then(({data})=>{if(location.hash)history.replaceState(null,'',location.pathname+location.search);if(REC&&data.session){resetView();return}if(data.session)enter(data.session.user);else home()});
