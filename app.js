// ================= Firebase (CDN v10) =================
const firebaseConfig = {
  apiKey: "AIzaSyBPczYHDmL57Sc5T1lFxfNqcxkyI2u-lBg",
  authDomain: "plantilla-acta-asamble-jpusap.firebaseapp.com",
  databaseURL: "https://plantilla-acta-asamble-jpusap-default-rtdb.firebaseio.com",
  projectId: "plantilla-acta-asamble-jpusap",
  storageBucket: "plantilla-acta-asamble-jpusap.firebasestorage.app",
  messagingSenderId: "349067080310",
  appId: "1:349067080310:web:d04ea32c2d0c2092bbe557",
  measurementId: "G-EJDFJHCX1W"
};
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getDatabase, ref, onValue, push, set, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);
try{ isSupported().then(s=>s&&getAnalytics(app)); }catch(_){}

// ====== Config adjuntos RTDB (DataURL) ======
const MAX_FILE_MB = 4;  // puedes aumentar si lo necesitas (ojo límites RTDB)
const ALLOWED = ["application/pdf","image/png","image/jpeg","image/jpg",
  "application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

// ====== Helpers ======
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const escapeHTML = (t="") => t.replace(/[&<>'"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
const fmtFechaTexto = (f,h) => {
  if(!f) return "";
  const d=new Date(f+"T"+(h||"00:00")); const dia=d.getDate(); const mes=months[d.getMonth()]; const anio=d.getFullYear();
  const [hh,mm]=(h||"00:00").split(":"); return `Siendo las ${hh}:${mm} horas del día ${dia} de ${mes} del año ${anio}`;
};
const setErr=(el,on)=>{ if(!el) return; el.classList.toggle("error", !!on); if(on) el.scrollIntoView({behavior:"smooth",block:"center"}); }
const sortByNombre = arr => [...arr].sort((a,b)=> (a.nombre||"").localeCompare(b.nombre||"", "es", {sensitivity:"base"}));

// ====== DOM ======
const listaDirEl=$("#listaDirigentes"), buscarDirEl=$("#buscarDir");
const presidenteSel=$("#presidente"), secretarioSel=$("#secretario");
const puntosWrap=$("#puntosWrap");
const btnAddPunto=$("#btnAddPunto"), btnClearPuntos=$("#btnClearPuntos");
const btnGenerar=$("#btnGenerar"), btnReset=$("#btnReset"), btnPrint=$("#btnPrint"), preview=$("#preview");
const btnGuardarNuevo=$("#btnGuardarNuevo"), btnGuardarCambios=$("#btnGuardarCambios");
const historialActasEl=$("#historialActas");

// Locks
$("#toggleLockAsoc").onclick = ()=> toggleLock($("#asociacion"), "#toggleLockAsoc");
$("#toggleLockCiudad").onclick = ()=> toggleLock($("#ciudad"), "#toggleLockCiudad");
$("#toggleLockDistrito").onclick = ()=> toggleLock($("#distrito"), "#toggleLockDistrito");
$("#toggleLockDepto").onclick = ()=> toggleLock($("#departamento"), "#toggleLockDepto");
function toggleLock(input, btnSel){ const btn=$(btnSel); input.disabled = !input.disabled; btn.textContent = input.disabled ? "🔒" : "🔓"; }

// ====== Modo de reunión (Asamblea / Interna) ======
const claseSel = $("#claseReunion");
const rowConv = $("#rowConv");
const esInterna = () => claseSel.value === "interna";

// ====== Dirigentes / Asistentes ======
let DIRIGENTES_CACHE=[]; let filtro="";
function getAsistentesSeleccionados(){
  return $$(".chk-asistente:checked").map(ch=>({
    id: ch.value, nombre: ch.dataset.nombre, dni: ch.dataset.dni, cargo: ch.dataset.cargo
  }));
}
function asistentesOptionsHTML(){
  const as=getAsistentesSeleccionados();
  return `<option value="">— Traer de asistentes (opcional) —</option>` + as.map(a=>`<option value="${a.id}">${escapeHTML(a.nombre)}</option>`).join("");
}
function renderDirigentes(){
  const selectedIds = new Set($$(".chk-asistente:checked").map(c=>c.value));
  const q=filtro.trim().toLowerCase(); listaDirEl.innerHTML="";
  DIRIGENTES_CACHE
    .filter(d=>!q || (d.nombre?.toLowerCase().includes(q) || (d.cargo||"").toLowerCase().includes(q)))
    .sort((a,b)=>a.nombre.localeCompare(b.nombre))
    .forEach(d=>{
      const lab=document.createElement("label"); lab.className="chip";
      lab.innerHTML=`
        <input type="checkbox" class="chk-asistente" value="${d.id}" ${selectedIds.has(d.id)?"checked":""}
          data-nombre="${escapeHTML(d.nombre||"")}" data-dni="${escapeHTML(d.dni||"")}" data-cargo="${escapeHTML(d.cargo||"")}">
        <span><strong>${escapeHTML(d.nombre||"(sin nombre)")}</strong>${d.cargo?` — ${escapeHTML(d.cargo)}`:""}${d.dni?` · DNI ${escapeHTML(d.dni)}`:""}</span>
        <button class="mini edit-dir" data-id="${d.id}" title="Editar">✎</button>
      `;
      listaDirEl.appendChild(lab);
    });
  updateRolesOptions(); refreshPeopleOptionsAll();
}
function updateRolesOptions(){
  const as=getAsistentesSeleccionados(), opts=as.map(a=>`<option value="${a.id}">${escapeHTML(a.nombre)}</option>`).join("");
  const p=presidenteSel.value,s=secretarioSel.value;
  presidenteSel.innerHTML=`<option value="">— Seleccionar —</option>`+opts;
  secretarioSel.innerHTML=`<option value="">— Seleccionar —</option>`+opts;
  if(as.find(a=>a.id===p)) presidenteSel.value=p; if(as.find(a=>a.id===s)) secretarioSel.value=s;
}
onValue(ref(db,"dirigentes"),snap=>{
  const val=snap.val()||{}; DIRIGENTES_CACHE=Object.entries(val).map(([id,v])=>({id,...v})); renderDirigentes();
});
buscarDirEl.oninput=e=>{filtro=e.target.value; renderDirigentes();}
listaDirEl.addEventListener("change",e=>{ if(e.target.matches(".chk-asistente")){ updateRolesOptions(); refreshPeopleOptionsAll(); }});

// Modal crear/editar dirigente
const modalBack=$("#modalBack"), btnNuevoDir=$("#btnNuevoDir"), closeModal=$("#closeModal"), btnGuardarDir=$("#btnGuardarDir");
const ndNombre=$("#ndNombre"), ndDni=$("#ndDni"), ndCargo=$("#ndCargo"), mdlTitle=$("#mdlTitle"); let editingId=null;
function openModal(){ modalBack.style.display="grid"; ndNombre.focus(); }
function closeModalFn(){ modalBack.style.display="none"; ndNombre.value=ndDni.value=ndCargo.value=""; editingId=null; mdlTitle.textContent="Añadir nuevo dirigente"; btnGuardarDir.textContent="Guardar dirigente"; }
btnNuevoDir.onclick=()=>{editingId=null; openModal(); }
closeModal.onclick=closeModalFn; modalBack.onclick=e=>{ if(e.target===modalBack) closeModalFn(); }
listaDirEl.onclick=e=>{
  const btn=e.target.closest(".edit-dir"); if(!btn) return;
  const d=DIRIGENTES_CACHE.find(x=>x.id===btn.dataset.id); editingId=d.id;
  mdlTitle.textContent="Editar dirigente"; btnGuardarDir.textContent="Actualizar";
  ndNombre.value=d?.nombre||""; ndDni.value=d?.dni||""; ndCargo.value=d?.cargo||""; openModal();
}
btnGuardarDir.onclick=async()=>{
  const nombre=ndNombre.value.trim(); if(!nombre){alert("Ingresa el nombre.");ndNombre.focus();return;}
  const dni=ndDni.value.trim(); const cargo=ndCargo.value.trim();
  if(editingId){ await update(ref(db,`dirigentes/${editingId}`),{nombre,dni,cargo}); }
  else{ const nodo=push(ref(db,"dirigentes")); await set(nodo,{nombre,dni,cargo}); }
  closeModalFn();
};

// ====== Órdenes del día ======
let PUNTO_SEQ=0;
function puntoTemplate(id){
  return `
  <div class="punto" data-id="${id}">
    <div class="punto-h">
      <strong>Orden del día <span class="pt-num">${id}</span>: <span class="pt-titulo">(sin título)</span></strong>
      <div class="btn-row"><button class="btn outline btn-toggle">Abrir / Cerrar</button><button class="btn outline btn-del">Eliminar</button></div>
    </div>
    <div class="punto-b">
      <div class="row-3">
        <div>
          <label class="lab">Título del punto</label>
          <input class="inp-titulo" type="text" placeholder="Ej: Limpieza de la urbanización">
        </div>
        <div>
          <label class="lab">Creado por</label>
          <select class="sel-creador">
            <option value="Junta Directiva">Junta Directiva</option>
            <option value="Vecino">Vecino</option>
          </select>
        </div>
        <div>
          <label class="lab">N.º (opcional)</label>
          <input class="inp-num" type="text" placeholder="Automático">
        </div>
      </div>

      <div class="row vec-row" style="margin-top:8px; display:none">
        <div>
          <label class="lab lbl-vec-1">Vecino: Nombre y apellidos</label>
          <input class="vec-nombre" type="text" placeholder="Nombre completo">
        </div>
        <div>
          <label class="lab lbl-vec-2">DNI — Padrón</label>
          <input class="vec-datos" type="text" placeholder="DNI — Padrón">
        </div>
      </div>

      <div class="sep"></div>

      <label class="lab">Secciones de esta orden del día</label>
      <div class="choice-row">
        <label><input type="checkbox" class="chk-interv"> Intervenciones</label>
        <label><input type="checkbox" class="chk-prop"> Propuestas</label>
        <label><input type="checkbox" class="chk-vot"> Votación (independiente)</label>
        <label><input type="checkbox" class="chk-aplazar"> <span class="aplazar-label">Aplazar a la siguiente asamblea</span></label>
      </div>

      <!-- Intervenciones -->
      <div class="sec-interv" style="display:none">
        <h3 class="sub">Intervenciones</h3>
        <div class="btn-row" style="margin-bottom:8px">
          <button class="btn btn-add-interv">+ Añadir intervención</button>
        </div>
        <div class="tbl-wrap">
          <table class="tbl-interv">
            <thead>
              <tr>
                <th style="width:220px">Traer de asistentes (opcional)</th>
                <th>Nombre</th>
                <th style="width:140px">DNI</th>
                <th style="width:110px" class="col-padron">Padrón</th>
                <th style="width:140px">Rol</th>
                <th>Contenido</th>
                <th style="width:70px">Acción</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <!-- Propuestas -->
      <div class="sec-prop" style="display:none">
        <h3 class="sub">Propuestas</h3>
        <div class="btn-row" style="margin-bottom:8px">
          <button class="btn btn-add-prop">+ Añadir propuesta</button>
        </div>
        <div class="tbl-wrap">
          <table class="tbl-prop">
            <thead>
              <tr>
                <th>Propuesta</th>
                <th style="width:170px">¿Pasar a votación?</th>
                <th style="width:70px">Acción</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <!-- Adjuntos -->
      <div class="sep"></div>
      <h3 class="sub">Adjuntos del punto</h3>
      <div class="adj-wrap">
        <input type="file" class="file-adj" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" hidden>
        <div class="btn-row">
          <button class="btn outline btn-adj">📎 Adjuntar documento</button>
        </div>
        <ul class="adj-list"><li class="muted">Sin adjuntos.</li></ul>
      </div>

      <!-- Votación independiente -->
      <div class="sec-vot" style="display:none">
        <h3 class="sub">Votación</h3>
        <label class="lab">Pregunta de la votación</label>
        <input class="vt-pregunta" type="text" placeholder="¿Cuál es la pregunta que se vota?">
        <div class="row">
          <div><label class="lab">A favor</label><input class="vt-favor" type="number" min="0" value="0"></div>
          <div><label class="lab">En contra</label><input class="vt-contra" type="number" min="0" value="0"></div>
        </div>
        <div class="row">
          <div><label class="lab">Abstenciones</label><input class="vt-abst" type="number" min="0" value="0"></div>
          <div>
            <label class="lab">Decisión final</label>
            <select class="sel-decision">
              <option value="En debate">En debate</option>
              <option value="Aprobado">Aprobado</option>
              <option value="Rechazado">Rechazado</option>
              <option value="Pospuesto">Pospuesto</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Aplazar -->
      <div class="sec-aplazar" style="display:none; margin-top:8px">
        <p class="muted info-aplazo"><em>Este punto se propone aplazar a la siguiente asamblea.</em></p>
      </div>

      <div class="sep"></div>
      <h3 class="sub">Notas de la discusión</h3>
      <textarea class="txt-notas big" placeholder="Opiniones de vecinos/miembros y del presidente/encargado..."></textarea>
    </div>
  </div>`;
}
function addPunto(){
  const id=++PUNTO_SEQ; const div=document.createElement("div"); div.innerHTML=puntoTemplate(id); const el=div.firstElementChild;
  el._adjuntos = []; // adjuntos DataURL
  puntosWrap.appendChild(el); el.classList.add("open");
  wirePunto(el); refreshPeopleOptions(el);
  applyClaseToUI();
}
function clearPuntos(){ puntosWrap.innerHTML=""; PUNTO_SEQ=0; }
btnAddPunto.onclick=addPunto;
btnClearPuntos.onclick=()=>{ if(confirm("¿Eliminar todas las órdenes del día?")) clearPuntos(); };

function updateAdjList(el){
  const listEl = el.querySelector(".adj-list");
  const adj = el._adjuntos || [];
  listEl.innerHTML = adj.length
    ? adj.map(a=>{
        const href = a.url || a.dataUrl;
        const sizeKb = a.size ? ` — ${Math.round(a.size/1024)} KB` : "";
        return `<li><a href="${href}" target="_blank" rel="noopener" ${a.name?`download="${escapeHTML(a.name)}"`:""}>Abrir adjunto: ${escapeHTML(a.name||"archivo")}${sizeKb}</a></li>`;
      }).join("")
    : `<li class="muted">Sin adjuntos.</li>`;
}

function wirePunto(el){
  const hdr=el.querySelector(".punto-h"), titleSpan=el.querySelector(".pt-titulo"), inpTitulo=el.querySelector(".inp-titulo");
  const numSpan=el.querySelector(".pt-num"), inpNum=el.querySelector(".inp-num");
  hdr.querySelector(".btn-toggle").onclick=()=> el.classList.toggle("open");
  hdr.querySelector(".btn-del").onclick=()=>{ if(confirm("¿Eliminar esta orden del día?")) el.remove(); };
  inpTitulo.oninput=()=> titleSpan.textContent = inpTitulo.value.trim()||"(sin título)";
  inpNum.oninput=()=> numSpan.textContent = inpNum.value.trim() || el.dataset.id;

  // Opciones "Creado por" dinámicas y etiquetas
  const selCreador=el.querySelector(".sel-creador"), vecRow=el.querySelector(".vec-row");
  function setCreatorOptions(sel){
    if(esInterna()){
      sel.innerHTML=`<option value="Junta Directiva">Junta Directiva</option><option value="Miembro JD">Miembro de JD</option>`;
    }else{
      sel.innerHTML=`<option value="Junta Directiva">Junta Directiva</option><option value="Vecino">Vecino</option>`;
    }
  }
  function setVecLabels(){
    const lbl1 = el.querySelector(".lbl-vec-1");
    const lbl2 = el.querySelector(".lbl-vec-2");
    if(esInterna()){ lbl1.textContent="Miembro de JD: Nombre y apellidos"; lbl2.textContent="Cargo / Área"; }
    else{ lbl1.textContent="Vecino: Nombre y apellidos"; lbl2.textContent="DNI — Padrón"; }
  }
  function togglePadronColumn(){
    const th = el.querySelector("th.col-padron");
    if(th) th.style.display = esInterna() ? "none" : "";
    el.querySelectorAll(".int-padron")?.forEach(inp => inp.parentElement.style.display = esInterna() ? "none" : "");
  }
  function setAplazarLabels(){
    const label = el.querySelector(".aplazar-label");
    const p = el.querySelector(".info-aplazo");
    if(esInterna()){ label.textContent="Aplazar a la siguiente sesión"; p.innerHTML=`<em>Este punto se propone aplazar a la siguiente sesión.</em>`; }
    else{ label.textContent="Aplazar a la siguiente asamblea"; p.innerHTML=`<em>Este punto se propone aplazar a la siguiente asamblea.</em>`; }
  }
  setCreatorOptions(selCreador); setVecLabels(); togglePadronColumn(); setAplazarLabels();
  selCreador.onchange = ()=>{
    const v = selCreador.value;
    if(esInterna()) vecRow.style.display = (v==="Miembro JD") ? "grid" : "none";
    else vecRow.style.display = (v==="Vecino") ? "grid" : "none";
  };

  // switches secciones
  const chkI=el.querySelector(".chk-interv"), chkP=el.querySelector(".chk-prop"),
        chkV=el.querySelector(".chk-vot"), chkA=el.querySelector(".chk-aplazar");
  const secI=el.querySelector(".sec-interv"), secP=el.querySelector(".sec-prop"),
        secV=el.querySelector(".sec-vot"), secA=el.querySelector(".sec-aplazar");
  const toggle = (chk, sec)=> chk.onchange = ()=> sec.style.display = chk.checked ? "block" : "none";
  toggle(chkI,secI); toggle(chkP,secP); toggle(chkV,secV); toggle(chkA,secA);

  // tablas
  const tbodyI=el.querySelector(".tbl-interv tbody");
  el.querySelector(".btn-add-interv").onclick=()=> addIntervRow(tbodyI);
  const tbodyP=el.querySelector(".tbl-prop tbody");
  el.querySelector(".btn-add-prop").onclick=()=> addPropRow(tbodyP);

  // Adjuntos (DataURL)
  const btnAdj = el.querySelector(".btn-adj");
  const fileAdj = el.querySelector(".file-adj");
  btnAdj.onclick = ()=> fileAdj.click();
  fileAdj.onchange = async ()=>{
    const f = fileAdj.files[0]; if(!f) return;
    if(f.size > MAX_FILE_MB*1024*1024){ alert(`Máximo ${MAX_FILE_MB} MB por archivo`); fileAdj.value=""; return; }
    if(ALLOWED.length && f.type && !ALLOWED.includes(f.type)){
      if(!confirm(`Tipo ${f.type||"desconocido"}: puede que el navegador no lo abra. ¿Subir igual?`)){
        fileAdj.value=""; return;
      }
    }
    btnAdj.disabled = true; btnAdj.textContent="Subiendo… 0%";
    const reader = new FileReader();
    reader.onprogress = (e)=> { if(e.lengthComputable){ btnAdj.textContent = `Subiendo… ${Math.round((e.loaded/e.total)*100)}%`; } };
    reader.onerror = ()=> { alert("No se pudo leer el archivo."); btnAdj.disabled=false; btnAdj.textContent="📎 Adjuntar documento"; fileAdj.value=""; };
    reader.onload = ()=>{
      (el._adjuntos ||= []).push({ name:f.name, type:f.type, size:f.size, dataUrl: reader.result });
      updateAdjList(el);
      btnAdj.disabled=false; btnAdj.textContent="📎 Adjuntar documento"; fileAdj.value="";
    };
    reader.readAsDataURL(f);
  };
  updateAdjList(el);

  // borrar filas
  el.addEventListener("click", e=>{ if(e.target.closest(".btn-del-row")) e.target.closest("tr").remove(); });
}
function addIntervRow(tbody){
  const tr=document.createElement("tr");
  tr.innerHTML=`
    <td><select class="sel-asistente">${asistentesOptionsHTML()}</select></td>
    <td><input type="text" class="int-nombre" placeholder="Nombre completo"></td>
    <td><input type="text" class="int-dni" placeholder="DNI"></td>
    <td><input type="text" class="int-padron" placeholder="Padrón"></td>
    <td>
      <select class="int-rol">
        <option value="Vecino">Vecino</option>
        <option value="Presidente">Presidente</option>
        <option value="Secretario">Secretario</option>
        <option value="Directivo">Directivo</option>
        <option value="Invitado">Invitado</option>
      </select>
    </td>
    <td><textarea class="int-contenido big" placeholder="Contenido / opinión"></textarea></td>
    <td><button class="btn outline btn-del-row">✖</button></td>`;
  tbody.appendChild(tr);
  tr.querySelector(".sel-asistente").onchange = ()=>{
    const id = tr.querySelector(".sel-asistente").value;
    if(!id) return; const as = getAsistentesSeleccionados().find(a=>a.id===id);
    if(as){ tr.querySelector(".int-nombre").value = as.nombre||""; tr.querySelector(".int-dni").value = as.dni||""; }
  };
}
function addPropRow(tbody){
  const tr=document.createElement("tr");
  tr.innerHTML=`
    <td><textarea class="prop-text big" placeholder="Escribe la propuesta para esta orden del día"></textarea></td>
    <td>
      <label style="display:flex;gap:6px;align-items:center">
        <input type="checkbox" class="prop-votar"> Pasar a votación
      </label>
      <div class="mini-vote" style="display:none; margin-top:8px">
        <div class="row">
          <div><label class="lab">A favor</label><input class="pv-favor" type="number" min="0" value="0"></div>
          <div><label class="lab">En contra</label><input class="pv-contra" type="number" min="0" value="0"></div>
        </div>
        <div class="row" style="margin-top:8px">
          <div><label class="lab">Abstenciones</label><input class="pv-abst" type="number" min="0" value="0"></div>
          <div>
            <label class="lab">Decisión final</label>
            <select class="pv-decision">
              <option value="En debate">En debate</option>
              <option value="Aprobado">Aprobado</option>
              <option value="Rechazado">Rechazado</option>
              <option value="Pospuesto">Pospuesto</option>
            </select>
          </div>
        </div>
      </div>
    </td>
    <td><button class="btn outline btn-del-row">✖</button></td>`;
  tbody.appendChild(tr);
  const chk = tr.querySelector(".prop-votar"), box=tr.querySelector(".mini-vote");
  chk.onchange = ()=> box.style.display = chk.checked ? "block" : "none";
}
function refreshPeopleOptions(scope){ (scope||document).querySelectorAll("select.sel-asistente").forEach(sel=>{ const prev=sel.value; sel.innerHTML=asistentesOptionsHTML(); if([...sel.options].some(o=>o.value===prev)) sel.value=prev; }); }
function refreshPeopleOptionsAll(){ refreshPeopleOptions(document); }

// ====== Generación / Validación ======
btnPrint.onclick = ()=> window.print();
let currentActaId = null;
let nextNumeroSugerido = 1;

// N.º único
let ACTA_NUM_INDEX = new Map();
const normalizeNum = (n)=> String(n||"").trim().toUpperCase();
const numeroDisponible = (n)=>{
  const k = normalizeNum(n);
  const id = ACTA_NUM_INDEX.get(k);
  return !k || !id || id === currentActaId;
};
function markNumeroStatus(){
  const input = $("#numeroActa");
  const ok = numeroDisponible(input.value);
  setErr(input, !ok);
  input.title = ok ? "" : "Este número ya existe en otra acta";
}
$("#numeroActa").addEventListener("input", markNumeroStatus);

function resetUI(){
  ["lugar","fecha","hora","convocatoria","numeroActa"].forEach(id=>$("#"+id).value="");
  $("#tipo").value="EXTRAORDINARIA";
  claseSel.value = "asamblea"; applyClaseToUI();
  $$(".chk-asistente").forEach(ch=>ch.checked=false);
  presidenteSel.innerHTML=secretarioSel.innerHTML=`<option value="">— Seleccionar —</option>`;
  clearPuntos();
  currentActaId=null; btnGuardarCambios.disabled = true;
  if(nextNumeroSugerido) $("#numeroActa").value = String(nextNumeroSugerido);
  preview.innerHTML=`<h1>ACTA DE REUNIÓN DE LA JUNTA DIRECTIVA</h1><p class="muted">Completa el formulario y pulsa <strong>“Generar Acta”</strong> para ver aquí la versión final.</p>`;
  markNumeroStatus();
}
btnReset.onclick = ()=>{ if(confirm("¿Reiniciar todo?")) resetUI(); };

function collectPuntos(){
  const puntos=[];
  $$("#puntosWrap .punto").forEach(p=>{
    const titulo=p.querySelector(".inp-titulo");
    const inpNum=p.querySelector(".inp-num");
    const selC=p.querySelector(".sel-creador");
    const vecNom=p.querySelector(".vec-nombre");
    const vecDat=p.querySelector(".vec-datos");

    const showI=p.querySelector(".chk-interv").checked;
    const showP=p.querySelector(".chk-prop").checked;
    const showV=p.querySelector(".chk-vot").checked;
    const aplazar=p.querySelector(".chk-aplazar").checked;
    const notas=p.querySelector(".txt-notas").value.trim();

    const interv = showI ? [...p.querySelectorAll(".tbl-interv tbody tr")].map(tr=>{
      return {
        nombre: tr.querySelector(".int-nombre").value.trim(),
        dni: tr.querySelector(".int-dni").value.trim(),
        padron: tr.querySelector(".int-padron").value.trim(),
        rol: tr.querySelector(".int-rol").value,
        contenido: tr.querySelector(".int-contenido").value.trim()
      };
    }).filter(x=>x.nombre || x.contenido) : [];

    const props = showP ? [...p.querySelectorAll(".tbl-prop tbody tr")].map(tr=>{
      const votar = tr.querySelector(".prop-votar").checked;
      return {
        texto: tr.querySelector(".prop-text").value.trim(),
        votar,
        voto: votar ? {
          favor: +tr.querySelector(".pv-favor").value||0,
          contra: +tr.querySelector(".pv-contra").value||0,
          abst: +tr.querySelector(".pv-abst").value||0,
          decision: tr.querySelector(".pv-decision").value
        } : null
      };
    }).filter(x=>x.texto) : [];

    const votInd = showV ? {
      pregunta: p.querySelector(".vt-pregunta").value.trim(),
      favor: +p.querySelector(".vt-favor").value||0,
      contra: +p.querySelector(".vt-contra").value||0,
      abst: +p.querySelector(".vt-abst").value||0,
      decision: p.querySelector(".sel-decision").value
    } : null;

    puntos.push({
      titulo: titulo.value.trim(),
      num: inpNum.value.trim(),
      creador: selC.value,
      vecino:{nombre:vecNom.value.trim(), datos:vecDat.value.trim()},
      intervenciones:interv, propuestas:props, votacion:votInd, aplazar, notas,
      adjuntos: p._adjuntos || [],
      _els:{titulo, selC, vecNom, vecDat, votPregunta: p.querySelector(".vt-pregunta")}
    });
  });
  return puntos;
}

function validarCamposTop(){
  let ok=true;
  const lugar=$("#lugar"), fecha=$("#fecha"), hora=$("#hora"), nro=$("#numeroActa"), conv=$("#convocatoria");
  [lugar,fecha,hora,nro].forEach(el=>setErr(el, !el.value.trim() && (ok=false)));
  setErr(conv, !esInterna() && !conv.value.trim() && (ok=false));
  return ok;
}
function validarPuntos(puntos){
  let ok=true;
  for(const p of puntos){
    setErr(p._els.titulo, !p.titulo && (ok=false));
    setErr(p._els.selC, !p.creador && (ok=false));
    if(esInterna()){
      if(p.creador==="Miembro JD"){
        setErr(p._els.vecNom, !p.vecino.nombre && (ok=false));
        setErr(p._els.vecDat, !p.vecino.datos && (ok=false));
      }else{ setErr(p._els.vecNom,false); setErr(p._els.vecDat,false); }
    }else{
      if(p.creador==="Vecino"){
        setErr(p._els.vecNom, !p.vecino.nombre && (ok=false));
        setErr(p._els.vecDat, !p.vecino.datos && (ok=false));
      }else{ setErr(p._els.vecNom,false); setErr(p._els.vecDat,false); }
    }
    if(p.votacion){ setErr(p._els.votPregunta, !p.votacion.pregunta && (ok=false)); }
  }
  return ok;
}

// HTML helpers para preview
function tablaAsistentesHTML(asist){
  const filas = asist.map(a=>`
    <tr>
      <td>${escapeHTML(a.nombre)}</td>
      <td>${escapeHTML(a.dni||"")}</td>
      <td>${escapeHTML(a.cargo||"")}</td>
      <td></td>
    </tr>`).join("");
  return `<div class="table"><table>
    <thead><tr><th>Nombre y Apellidos</th><th>DNI</th><th>Cargo o Secretaría</th><th>Firma</th></tr></thead>
    <tbody>${filas || `<tr><td colspan="4"><em>Sin asistentes seleccionados.</em></td></tr>`}</tbody>
  </table></div>`;
}
function firmasAsistentesHTML(asist){
  if(!asist.length) return "";
  const items = asist.map(a=>`<div class="item">${escapeHTML(a.nombre)}</div>`).join("");
  return `<h3>Firmas de los asistentes</h3><div class="firmas-grid">${items}</div>`;
}
function renderPunto(p, idx, esInt=false){
  const numMostrar = p.num || idx;
  const creadorLine = (()=>{
    if(esInt){
      if(p.creador==="Miembro JD"){
        const nom = p.vecino?.nombre ? `: ${escapeHTML(p.vecino.nombre)}` : "";
        const cargo = p.vecino?.datos ? ` — ${escapeHTML(p.vecino.datos)}` : "";
        return `Propuesto por miembro de la Junta Directiva${nom}${cargo}`;
      }
      return `Propuesto por la Junta Directiva`;
    }else{
      return p.creador === "Vecino"
        ? `Propuesto por vecino: ${escapeHTML(p.vecino.nombre||"-")} — ${escapeHTML(p.vecino.datos||"")}`
        : `Propuesto por la Junta Directiva`;
    }
  })();

  const intervHTML = p.intervenciones?.length
    ? `<div class="table" style="margin-top:8px"><table>
        <thead><tr><th>Nombre</th><th style="width:140px">DNI</th>${esInt?"":"<th style='width:110px'>Padrón</th>"}<th style="width:140px">Rol</th><th>Contenido</th></tr></thead>
        <tbody>${p.intervenciones.map(i=>`<tr>
          <td>${escapeHTML(i.nombre||"")}</td>
          <td>${escapeHTML(i.dni||"")}</td>
          ${esInt?"":`<td>${escapeHTML(i.padron||"")}</td>`}
          <td>${escapeHTML(i.rol||"")}</td>
          <td>${escapeHTML(i.contenido||"")}</td>
        </tr>`).join("")}</tbody>
       </table></div>` : ``;

  const propsHTML = p.propuestas?.length
    ? `<div class="table" style="margin-top:8px"><table>
         <thead><tr><th>Propuesta</th><th style="width:250px">Votación (si aplica)</th></tr></thead>
         <tbody>${p.propuestas.map(pr=>{
            const v = pr.votar && pr.voto ? `A favor ${pr.voto.favor}, En contra ${pr.voto.contra}, Abstenciones ${pr.voto.abst}. <strong>${escapeHTML(pr.voto.decision)}</strong>` : `<em>—</em>`;
            return `<tr><td>${escapeHTML(pr.texto)}</td><td>${v}</td></tr>`;
         }).join("")}</tbody>
       </table></div>` : ``;

  const adjHTML = p.adjuntos?.length
    ? `<h4 style="margin:10px 0 4px">Adjuntos</h4><ul class="adj-list">${
        p.adjuntos.map(a=>{
          const href = a.url || a.dataUrl;
          const sizeKb = a.size ? ` — ${Math.round(a.size/1024)} KB` : "";
          return `<li><a href="${href}" target="_blank" rel="noopener" ${a.name?`download="${escapeHTML(a.name)}"`:""}>Abrir adjunto: ${escapeHTML(a.name||"archivo")}${sizeKb}</a></li>`;
        }).join("")
      }</ul>` : ``;

  const votIndHTML = p.votacion
    ? `<p><strong>Votación:</strong> ${escapeHTML(p.votacion.pregunta)}<br>
        A favor ${p.votacion.favor}, En contra ${p.votacion.contra}, Abstenciones ${p.votacion.abst}. <strong>Decisión:</strong> ${escapeHTML(p.votacion.decision)}.</p>`
    : ``;

  const aplazoHTML = p.aplazar ? `<p><em>Este punto se aplaza para la siguiente ${esInt?"sesión":"asamblea"}.</em></p>` : ``;
  const notasHTML  = p.notas ? `<p><strong>Notas de la discusión:</strong> ${escapeHTML(p.notas)}</p>` : ``;

  return `
    <h3>${numMostrar}. ${escapeHTML(p.titulo||"(sin título)")} — <small>${creadorLine}</small></h3>
    ${intervHTML}
    ${propsHTML}
    ${adjHTML}
    ${votIndHTML}
    ${aplazoHTML}
    ${notasHTML}
  `;
}

async function autoGuardar(data){
  if(currentActaId){
    await update(ref(db,`actas/${currentActaId}`), { ...data, updatedAt: Date.now() });
  }else{
    const nodo = push(ref(db,"actas"));
    await set(nodo, { ...data, createdAt: Date.now(), updatedAt: Date.now() });
    currentActaId = nodo.key;
    btnGuardarCambios.disabled = false;
  }
}

btnGenerar.onclick = async ()=>{
  if(!$("#numeroActa").value.trim() && nextNumeroSugerido) $("#numeroActa").value = String(nextNumeroSugerido);

  const asociacion=$("#asociacion").value.trim();
  const clase = claseSel.value;
  const tipo=$("#tipo").value.trim();
  const ciudad=$("#ciudad").value.trim();
  const distrito=$("#distrito").value.trim();
  const departamento=$("#departamento").value.trim();
  const lugar=$("#lugar").value.trim();
  const fecha=$("#fecha").value;
  const hora=$("#hora").value;
  const convocatoria=$("#convocatoria").value;
  const numero = $("#numeroActa").value.trim();

  const asistentes=getAsistentesSeleccionados();
  const presId=presidenteSel.value, secId=secretarioSel.value;
  const pres=asistentes.find(a=>a.id===presId), sec=asistentes.find(a=>a.id===secId);

  const puntos = collectPuntos();

  const okTop = validarCamposTop();
  const okPts = validarPuntos(puntos);
  if(!okTop || !okPts){ alert("Faltan campos por completar. Los verás marcados en rojo."); return; }

  // N.º único
  if(!numeroDisponible(numero)){
    setErr($("#numeroActa"), true);
    alert(`El N.º ${numero} ya existe en otra acta. Cambia el número para poder guardar.`);
    return;
  }

  // Guardar/actualizar automáticamente
  const dataToSave = {
    numero, asociacion, claseReunion: clase, tipo, ciudad, distrito, departamento, lugar, fecha, hora, convocatoria,
    asistentes, presidenteId:presId, secretarioId:secId,
    puntos: puntos.map(p=>({titulo:p.titulo, num:p.num, creador:p.creador, vecino:p.vecino,
      intervenciones:p.intervenciones, propuestas:p.propuestas, adjuntos:p.adjuntos,
      votacion:p.votacion, aplazar:p.aplazar, notas:p.notas}))
  };
  await autoGuardar(dataToSave);

  // Vista previa
  const esInt = esInterna();
  const tipoTexto = esInt ? "REUNIÓN INTERNA" : `REUNIÓN ${tipo}`;
  const h1 = `ACTA N.º ${escapeHTML(numero)} — ${tipoTexto} DE LA JUNTA DIRECTIVA DE LA ASOCIACIÓN “${escapeHTML(asociacion)}”`;
  const cab = `En la ciudad de ${escapeHTML(ciudad)}, distrito de ${escapeHTML(distrito)}, departamento de ${escapeHTML(departamento)}.`;
  const intro = `${fmtFechaTexto(fecha,hora)} en el ${escapeHTML(lugar)}, ciudad de Lima. Se llevó a cabo la reunión de la Junta Directiva de la Asociación “${escapeHTML(asociacion)}”.`;
  const lineaConv = esInt ? "" : `<p><strong>La reunión se inició en la ${escapeHTML(convocatoria)} convocatoria.</strong></p>`;

  const asistOrdenados = sortByNombre(asistentes);
  const asistentesHTML = tablaAsistentesHTML(asistOrdenados);

  const lineaInicia = `
    <p>La reunión fue iniciada por el(la) señor(a) <span class="dotted">${escapeHTML(pres?.nombre||"")}</span>, actuó como <span class="dotted">Presidente</span>, y el(la) señor(a) <span class="dotted">${escapeHTML(sec?.nombre||"")}</span>, actuó como <span class="dotted">Secretario</span>, titulares de ambos cargos.</p>
  `;

  const agendaHTML = puntos.length ? puntos.map((p,idx)=>renderPunto(p, idx+1, esInt)).join("") : `<p class="muted"><em>Sin órdenes del día.</em></p>`;
  const firmasHTML = `
    <div class="sig-grid">
      <div class="sig">______________________________<br>Presidente: ${escapeHTML(pres?.nombre||"")}</div>
      <div class="sig">______________________________<br>Secretario(a): ${escapeHTML(sec?.nombre||"")}</div>
    </div>
    ${firmasAsistentesHTML(asistOrdenados)}
    <p style="margin-top:10px"><small>Documento generado automáticamente por el Sistema Automatizado de Actas.</small></p>
  `;

  preview.innerHTML = `
    <h1>${h1}</h1>
    <p><strong>Lugar:</strong> ${cab}</p>
    <p>${intro}</p>
    ${lineaConv}
    <h3>Asistentes</h3>
    ${asistentesHTML}
    ${lineaInicia}
    <h3>Agenda</h3>
    ${agendaHTML}
    ${firmasHTML}
  `;
};

// Guardar manual (nuevo) y limpiar
function actaFromUI(){
  const numero=$("#numeroActa").value.trim() || String(nextNumeroSugerido);
  const asociacion=$("#asociacion").value.trim();
  const tipo=$("#tipo").value.trim();
  const clase = claseSel.value;
  const ciudad=$("#ciudad").value.trim();
  const distrito=$("#distrito").value.trim();
  const departamento=$("#departamento").value.trim();
  const lugar=$("#lugar").value.trim();
  const fecha=$("#fecha").value;
  const hora=$("#hora").value;
  const convocatoria=$("#convocatoria").value;
  const asistentes=getAsistentesSeleccionados();
  const presId=presidenteSel.value, secId=secretarioSel.value;
  const puntos=collectPuntos().map(p=>({
    titulo:p.titulo, num:p.num, creador:p.creador, vecino:p.vecino, intervenciones:p.intervenciones,
    propuestas:p.propuestas, adjuntos:p.adjuntos, votacion:p.votacion, aplazar:p.aplazar, notas:p.notas
  }));
  return { numero, asociacion, claseReunion: clase, tipo, ciudad, distrito, departamento, lugar, fecha, hora, convocatoria,
    asistentes, presidenteId:presId, secretarioId:secId, puntos };
}
btnGuardarNuevo.onclick = async ()=>{
  const data = actaFromUI();
  if(!numeroDisponible(data.numero)){
    setErr($("#numeroActa"), true);
    alert(`El N.º ${data.numero} ya existe en otra acta. Cambia el número para poder guardar.`);
    return;
  }
  const nodo = push(ref(db,"actas")); await set(nodo, { ...data, createdAt: Date.now(), updatedAt: Date.now() });
  alert("Acta guardada."); resetUI();
};
btnGuardarCambios.onclick = async ()=>{
  if(!currentActaId){ alert("Primero carga o genera un acta."); return; }
  const data = actaFromUI();
  if(!numeroDisponible(data.numero)){
    setErr($("#numeroActa"), true);
    alert(`El N.º ${data.numero} ya existe en otra acta. Cambia el número para poder guardar.`);
    return;
  }
  await update(ref(db,`actas/${currentActaId}`), { ...data, updatedAt: Date.now() });
  alert("Cambios guardados."); resetUI();
};

// Historial (Editar) + índice de números + sugerencia
onValue(ref(db,"actas"), (snap)=>{
  const val = snap.val() || {};
  const arr = Object.entries(val).map(([id,v])=>({id, ...v}))
    .sort((a,b)=> (b.updatedAt||0)-(a.updatedAt||0));

  // índice de N.º
  ACTA_NUM_INDEX.clear();
  arr.forEach(a=>{
    const k = normalizeNum(a.numero);
    if(k) ACTA_NUM_INDEX.set(k, a.id);
  });

  if(!arr.length){ 
    historialActasEl.innerHTML = `<li class="muted">Aún no hay actas guardadas.</li>`;
    nextNumeroSugerido = 1;
  } else {
    historialActasEl.innerHTML = arr.slice(0,40).map(a=>{
      const tag = a.claseReunion==="interna" ? "[Interna] " : "";
      const fecha = a.fecha || "(sin fecha)";
      const lugar = a.lugar || "(sin lugar)";
      const n = a.numero ? `${tag}N.º ${escapeHTML(String(a.numero))} — ` : `${tag}`;
      return `<li>
        <span class="meta">${n}${fecha} — ${escapeHTML(lugar)}</span>
        <button class="btn outline btn-editar-acta" data-id="${a.id}">Editar</button>
      </li>`;
    }).join("");

    const nums = arr.map(a=>parseInt(a.numero,10)).filter(n=>!isNaN(n));
    nextNumeroSugerido = (nums.length ? Math.max(...nums) : 0) + 1;
  }

  if(!currentActaId && !$("#numeroActa").value) $("#numeroActa").value = String(nextNumeroSugerido);
  markNumeroStatus();
});

// Cargar acta para editar
historialActasEl.addEventListener("click", (e)=>{
  const btn = e.target.closest(".btn-editar-acta"); if(!btn) return;
  const id = btn.dataset.id;
  onValue(ref(db,`actas/${id}`), (snap)=>{
    const a = snap.val(); if(!a) return;
    currentActaId = id; btnGuardarCambios.disabled = true; // se habilita tras generar o editar
    window.scrollTo({top:0,behavior:"smooth"});

    $("#numeroActa").value = a.numero || "";
    $("#asociacion").value = a.asociacion||"";
    claseSel.value = a.claseReunion || "asamblea";
    $("#tipo").value = a.tipo||"EXTRAORDINARIA";
    $("#ciudad").value = a.ciudad||"";
    $("#distrito").value = a.distrito||"";
    $("#departamento").value = a.departamento||"";
    $("#lugar").value = a.lugar||"";
    $("#fecha").value = a.fecha||"";
    $("#hora").value = a.hora||"";
    $("#convocatoria").value = a.convocatoria||"";
    applyClaseToUI();

    $$(".chk-asistente").forEach(ch=> ch.checked = (a.asistentes||[]).some(x=>x.id===ch.value));
    renderDirigentes();
    presidenteSel.value = a.presidenteId||"";
    secretarioSel.value = a.secretarioId||"";

    clearPuntos();
    (a.puntos||[]).forEach(p=>{
      addPunto();
      const el = puntosWrap.lastElementChild;
      el.querySelector(".inp-titulo").value = p.titulo||"";
      el.querySelector(".pt-titulo").textContent = p.titulo||"(sin título)";
      el.querySelector(".inp-num").value = p.num||"";
      el.querySelector(".pt-num").textContent = p.num||el.dataset.id;

      // creador y datos
      const sel = el.querySelector(".sel-creador");
      if(esInterna()){ sel.innerHTML=`<option value="Junta Directiva">Junta Directiva</option><option value="Miembro JD">Miembro de JD</option>`; }
      else{ sel.innerHTML=`<option value="Junta Directiva">Junta Directiva</option><option value="Vecino">Vecino</option>`; }
      sel.value = p.creador || "Junta Directiva";
      const vecRow = el.querySelector(".vec-row");
      if(esInterna()) vecRow.style.display = (sel.value==="Miembro JD") ? "grid" : "none";
      else vecRow.style.display = (sel.value==="Vecino") ? "grid" : "none";
      const lbl1 = el.querySelector(".lbl-vec-1"), lbl2 = el.querySelector(".lbl-vec-2");
      if(esInterna()){ lbl1.textContent="Miembro de JD: Nombre y apellidos"; lbl2.textContent="Cargo / Área"; }
      else{ lbl1.textContent="Vecino: Nombre y apellidos"; lbl2.textContent="DNI — Padrón"; }
      el.querySelector(".vec-nombre").value = p.vecino?.nombre||"";
      el.querySelector(".vec-datos").value  = p.vecino?.datos||"";

      // Intervenciones
      if(p.intervenciones?.length){ el.querySelector(".chk-interv").checked=true; el.querySelector(".sec-interv").style.display="block";
        const tbody = el.querySelector(".tbl-interv tbody");
        p.intervenciones.forEach(i=>{
          addIntervRow(tbody);
          const tr=tbody.lastElementChild;
          tr.querySelector(".int-nombre").value=i.nombre||"";
          tr.querySelector(".int-dni").value=i.dni||"";
          tr.querySelector(".int-padron").value=i.padron||"";
          tr.querySelector(".int-rol").value=i.rol||"Vecino";
          tr.querySelector(".int-contenido").value=i.contenido||"";
        });
      }
      // Propuestas
      if(p.propuestas?.length){ el.querySelector(".chk-prop").checked=true; el.querySelector(".sec-prop").style.display="block";
        const tbody = el.querySelector(".tbl-prop tbody");
        p.propuestas.forEach(pr=>{
          addPropRow(tbody);
          const tr=tbody.lastElementChild;
          tr.querySelector(".prop-text").value = pr.texto||"";
          if(pr.votar && pr.voto){
            tr.querySelector(".prop-votar").checked = true;
            tr.querySelector(".mini-vote").style.display="block";
            tr.querySelector(".pv-favor").value = pr.voto.favor||0;
            tr.querySelector(".pv-contra").value = pr.voto.contra||0;
            tr.querySelector(".pv-abst").value = pr.voto.abst||0;
            tr.querySelector(".pv-decision").value = pr.voto.decision||"En debate";
          }
        });
      }
      // Adjuntos
      el._adjuntos = p.adjuntos || [];
      updateAdjList(el);

      // Votación independiente
      if(p.votacion){ el.querySelector(".chk-vot").checked=true; el.querySelector(".sec-vot").style.display="block";
        el.querySelector(".vt-pregunta").value = p.votacion.pregunta||"";
        el.querySelector(".vt-favor").value = p.votacion.favor||0;
        el.querySelector(".vt-contra").value = p.votacion.contra||0;
        el.querySelector(".vt-abst").value = p.votacion.abst||0;
        el.querySelector(".sel-decision").value = p.votacion.decision||"En debate";
      }
      if(p.aplazar){ el.querySelector(".chk-aplazar").checked=true; el.querySelector(".sec-aplazar").style.display="block"; }
      el.querySelector(".txt-notas").value = p.notas||"";
    });
    markNumeroStatus();
  }, { onlyOnce:true });
});

// ====== Sincronización de UI según clase ======
function applyClaseToUI(){
  rowConv.style.display = esInterna() ? "none" : "";
  $$("#puntosWrap .punto").forEach(el=>{
    const sel = el.querySelector(".sel-creador");
    const prev = sel.value;
    if(esInterna()){
      sel.innerHTML = `<option value="Junta Directiva">Junta Directiva</option><option value="Miembro JD">Miembro de JD</option>`;
    }else{
      sel.innerHTML = `<option value="Junta Directiva">Junta Directiva</option><option value="Vecino">Vecino</option>`;
    }
    if([...sel.options].some(o=>o.value===prev)) sel.value=prev;

    const lbl1 = el.querySelector(".lbl-vec-1"), lbl2 = el.querySelector(".lbl-vec-2");
    if(lbl1&&lbl2){
      if(esInterna()){ lbl1.textContent="Miembro de JD: Nombre y apellidos"; lbl2.textContent="Cargo / Área"; }
      else { lbl1.textContent="Vecino: Nombre y apellidos"; lbl2.textContent="DNI — Padrón"; }
    }
    const th = el.querySelector("th.col-padron");
    if(th) th.style.display = esInterna() ? "none" : "";
    el.querySelectorAll("td .int-padron")?.forEach(inp => inp.parentElement.style.display = esInterna() ? "none" : "");

    const lab = el.querySelector(".aplazar-label");
    const p = el.querySelector(".info-aplazo");
    if(lab && p){
      if(esInterna()){ lab.textContent="Aplazar a la siguiente sesión"; p.innerHTML=`<em>Este punto se propone aplazar a la siguiente sesión.</em>`; }
      else { lab.textContent="Aplazar a la siguiente asamblea"; p.innerHTML=`<em>Este punto se propone aplazar a la siguiente asamblea.</em>`; }
    }

    // Mostrar/ocultar fila extra
    const vecRow = el.querySelector(".vec-row");
    const v = sel.value;
    if(esInterna()) vecRow.style.display = (v==="Miembro JD") ? "grid" : "none";
    else vecRow.style.display = (v==="Vecino") ? "grid" : "none";
  });
}
claseSel.addEventListener("change", applyClaseToUI);
applyClaseToUI();

