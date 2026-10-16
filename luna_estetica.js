let patients = [];
let patientsLoaded = false;
let patientsLoadingPromise = null;

function goLanding(){
 hideAll();
 document.getElementById('landing').classList.remove('hidden');
 window.scrollTo({top:0,left:0,behavior:'auto'});
}
function hideAll(){['landing','patient','admin'].forEach(id=>document.getElementById(id).classList.add('hidden'))}
const APP_CONFIG = Object.freeze({
  // El frontend se comunica únicamente con el proxy de Cloudflare.
  API_URL: 'https://luna-estetica-api.chateurban.workers.dev',
  API_TIMEOUT_MS: 15000
});

async function enviarApi(accion, datos = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    APP_CONFIG.API_TIMEOUT_MS
  );

  try {
    const respuesta = await fetch(APP_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accion,
        ...datos
      }),
      signal: controller.signal
    });

    let resultado = null;

    try {
      resultado = await respuesta.json();
    } catch {
      throw new Error(
        'El servidor respondió con un formato inválido.'
      );
    }

    if (!respuesta.ok || !resultado?.ok) {
      throw new Error(
        resultado?.mensaje ||
        'La operación no pudo completarse.'
      );
    }

    return resultado;

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'La comunicación con el servidor excedió el tiempo de espera.'
      );
    }

    throw error;

  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizarFechaApi(valor) {
  if (!valor) return '';

  const texto = String(valor);

  // Apps Script serializa las fechas como ISO.
  // Para la UI solo necesitamos AAAA-MM-DD.
  if (texto.includes('T')) {
    return texto.split('T')[0];
  }

  return texto.slice(0, 10);
}


function calcularEdadDesdeIso(fechaIso) {
  if (!fechaIso) return '';

  const partes = fechaIso.split('-').map(Number);

  if (partes.length !== 3 || partes.some(Number.isNaN)) {
    return '';
  }

  const [anio, mes, dia] = partes;
  const hoy = new Date();

  let edad = hoy.getFullYear() - anio;

  const cumplio =
    (hoy.getMonth() + 1 > mes) ||
    (
      hoy.getMonth() + 1 === mes &&
      hoy.getDate() >= dia
    );

  if (!cumplio) edad--;

  return edad >= 0 ? `${edad} años` : '';
}


function formatearCelularUI(valor) {
  const celular = String(valor || '').replace(/\D/g, '');

  if (celular.length !== 9) {
    return String(valor || '');
  }

  return `${celular.slice(0, 3)} ${celular.slice(3, 6)} ${celular.slice(6)}`;
}


function mapearPacienteApi(item) {
  const fechaNacimiento =
    normalizarFechaApi(item.fechaNacimiento);

  return {
    idPaciente:
      String(item.idPaciente || '').trim(),

    name:
      `${item.nombre || ''} ${item.apellido || ''}`.trim(),

    firstName:
      String(item.nombre || '').trim(),

    lastName:
      String(item.apellido || '').trim(),

    dni:
      String(item.dni || '').trim(),

    cell:
      formatearCelularUI(item.celular),

    age:
      calcularEdadDesdeIso(fechaNacimiento),

    last:
      'Sin atenciones',

    birthDate:
      fechaNacimiento,

    district:
      String(item.distrito || '').trim() || 'No indicado',

    occupation:
      String(item.ocupacion || '').trim() || 'No indicado',

    branch:
      String(item.sede || '').trim() || 'No indicada',

    referral:
      String(item.comoNosConocio || '').trim() || 'No indicado',

    allergy:
      String(item.alergiasEnfermedades || '').trim() ||
      'Sin información registrada.',

    previousFaceProcedure:
      String(item.intervencionPrevia || '').trim() || 'No indicado',

    previousFaceProcedureDetails:
      String(item.detalleIntervencion || '').trim(),

    firstFacialCleaning:
      String(item.primeraLimpiezaFacial || '').trim() || 'No indicado',

    consentAccepted:
      item.consentimientoAceptado === true,

    consentVersion:
      String(item.versionConsentimiento || '').trim(),

    fechaRegistro:
      item.fechaRegistro || null,

    estado:
      String(item.estado || '').trim(),

    hasAttention:
      false,

    appointments:
      []
  };
}


async function cargarPacientesDesdeApi({ force = false } = {}) {
  if (patientsLoaded && !force) {
    return patients;
  }

  if (patientsLoadingPromise && !force) {
    return patientsLoadingPromise;
  }

  patientsLoadingPromise = (async () => {
    const resultado = await enviarApi('listarPacientes');

    const registros = Array.isArray(resultado?.pacientes)
      ? resultado.pacientes
      : [];

    patients = registros
      .filter(item =>
        String(item.estado || '').trim().toLowerCase() !== 'inactivo'
      )
      .map(mapearPacienteApi)
      .sort((a, b) => {
        const fa = new Date(a.fechaRegistro || 0).getTime();
        const fb = new Date(b.fechaRegistro || 0).getTime();
        return fb - fa;
      });

    patientsLoaded = true;
    refreshPatientLists();

    return patients;
  })();

  try {
    return await patientsLoadingPromise;
  } finally {
    patientsLoadingPromise = null;
  }
}

let selectedPatientBranch = '';

function showPatient(branch=''){
 selectedPatientBranch = branch || '';

 document.querySelectorAll('.branch-choice').forEach(btn=>{
   const txt=btn.textContent.trim();
   btn.classList.toggle('selected',
     (branch==='Sede Villasol' && txt==='Sede Villasol') ||
     (branch==='Sede 2' && txt==='Sede 2')
   );
 });

 resetPatientForm();
 hideAll();
 document.getElementById('patient').classList.remove('hidden');
 window.scrollTo({top:0,left:0,behavior:'auto'});
}

function resetPatientForm(){
  pStep = 1;

  ['patientName','patientLastName','dni','cel','patientOccupation','patientAllergy'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });

  ['patientDistrict','birthDay','birthMonth','birthYear'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });

  document.getElementById('ageField').value='';
  document.getElementById('consent').checked=false;

  const otherDistrictWrap=document.getElementById('otherDistrictWrap');
  const otherDistrict=document.getElementById('otherDistrict');
  if(otherDistrictWrap) otherDistrictWrap.classList.add('hidden');
  if(otherDistrict) otherDistrict.value='';

  [...document.querySelectorAll('#referralChips .chip')].forEach(b=>b.classList.remove('active'));

  const prevGroup=document.querySelector('.binary-options[data-group="previousFaceProcedure"]');
  if(prevGroup){
    prevGroup.querySelectorAll('.binary-option').forEach(b=>b.classList.toggle('active', b.dataset.value==='No'));
  }
  const previousWrap=document.getElementById('previousFaceProcedureDetailsWrap');
  const previousInput=document.getElementById('previousFaceProcedureDetails');
  if(previousWrap){
    previousWrap.classList.add('hidden');
    previousWrap.style.display='none';
  }
  if(previousInput) previousInput.value='';

  const firstGroup=document.querySelector('.binary-options[data-group="firstFacialCleaning"]');
  if(firstGroup){
    firstGroup.querySelectorAll('.binary-option').forEach(b=>b.classList.toggle('active', b.dataset.value==='Sí'));
  }
  const other=document.getElementById('otherReferral');
  if(other){
    other.classList.add('hidden');
    const otherInput=other.querySelector('input');
    if(otherInput) otherInput.value='';
  }

  updatePatient();
}
function selectBinaryOption(button){
  const group=button.closest('.binary-options');
  if(!group) return;
  group.querySelectorAll('.binary-option').forEach(b=>b.classList.remove('active'));
  button.classList.add('active');

  const groupName = group.dataset.group;
  if(groupName === 'previousFaceProcedure'){
    const wrap = document.getElementById('previousFaceProcedureDetailsWrap');
    const input = document.getElementById('previousFaceProcedureDetails');
    const isYes = button.dataset.value === 'Sí';

    if(wrap){
      if(isYes){
        wrap.classList.remove('hidden');
        wrap.style.display = '';
      } else {
        wrap.classList.add('hidden');
        wrap.style.display = 'none';
      }
    }
    if(!isYes && input) input.value = '';
    if(isYes) setTimeout(()=>input?.focus(), 0);
  }
}

function getBinaryValue(groupName){
  return document.querySelector(`.binary-options[data-group="${groupName}"] .binary-option.active`)?.dataset.value || '';
}

function toggleOtherDistrict(){
  const select=document.getElementById('patientDistrict');
  const wrap=document.getElementById('otherDistrictWrap');
  const input=document.getElementById('otherDistrict');
  const isOther=select?.value==='Otros';
  if(wrap) wrap.classList.toggle('hidden', !isOther);
  if(!isOther && input) input.value='';
  if(isOther) setTimeout(()=>input?.focus(),0);
}

function toggleTabletMenu(){
  const nav=document.querySelector('.sidebar .nav');
  const btn=document.getElementById('tabletMenuBtn');
  if(!nav || !btn) return;
  const open=nav.classList.toggle('tablet-open');
  btn.classList.toggle('open',open);
  btn.setAttribute('aria-expanded',open ? 'true' : 'false');
}

function closeTabletMenu(){
  const nav=document.querySelector('.sidebar .nav');
  const btn=document.getElementById('tabletMenuBtn');
  if(nav) nav.classList.remove('tablet-open');
  if(btn){
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded','false');
  }
}

function openMobileMore(){
  const menu=document.getElementById('mobileMoreMenu');
  if(!menu) return;
  menu.classList.remove('hidden');
  menu.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}
function closeMobileMore(){
  const menu=document.getElementById('mobileMoreMenu');
  if(!menu) return;
  menu.classList.add('hidden');
  menu.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
}

function showAdmin(page='home'){
 closeTabletMenu();
 hideAll();
 document.getElementById('admin').classList.remove('hidden');
 window.scrollTo({top:0,left:0,behavior:'auto'});
 document.querySelectorAll('.admin-page').forEach(e=>e.classList.add('hidden'));
 const id = page==='profile' ? 'profile'
          : page==='appointment' ? 'appointment'
          : page==='agenda' ? 'agenda'
          : page==='settings' ? 'settings'
          : 'adminHome';
 document.getElementById(id).classList.remove('hidden');
 if(page==='profile') renderSelectedPatientProfile();
 if(page==='appointment'){
   const p = patients.find(x => String(x.dni) === String(selectedPatientDni));
   const crumb = document.querySelector('#appointment .admin-top .muted');
   if(p && crumb) crumb.textContent = `${p.name} / Nueva atención`;
   resetAppointmentForm();
 }
 document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
 const key = page==='profile' ? 'patients'
           : page==='appointment' ? 'appointments'
           : page==='agenda' ? 'agenda'
           : page==='settings' ? 'settings'
           : 'home';
 const active=document.querySelector(`.nav button[data-page="${key}"]`);
 if(active)active.classList.add('active');
 if((page==='agenda'||page==='settings') && window.matchMedia('(max-width:700px)').matches){
   const more=document.querySelector('.nav .mobile-more-btn');
   if(more) more.classList.add('active');
 }
 closeMobileMore();
}
let pStep=1;
function updatePatient(){
 document.querySelectorAll('.step').forEach(e=>e.classList.toggle('active',+e.dataset.step===pStep));
 document.getElementById('progressLabel').textContent=`PASO ${pStep} DE 3`;
 document.getElementById('progressBar').style.width=(pStep*(100/3))+'%';
 document.getElementById('backBtn').classList.toggle('hidden',pStep===1||pStep===3);
 document.getElementById('nextBtn').textContent=pStep===2?'Finalizar registro':'Continuar';
 document.getElementById('nextBtn').classList.toggle('hidden',pStep===3);
}
async function patientNext(){
  if(pStep===1){
    const name=document.getElementById('patientName').value.trim();
    const lastName=document.getElementById('patientLastName').value.trim();
    const dni=document.getElementById('dni').value.replace(/\D/g,'');
    const cel=document.getElementById('cel').value.replace(/\D/g,'');
    const birthDay=document.getElementById('birthDay')?.value;
    const birthMonth=document.getElementById('birthMonth')?.value;
    const birthYear=document.getElementById('birthYear')?.value;
    const district=document.getElementById('patientDistrict')?.value;

    if(!name){toast('Ingresa tu nombre.');return}
    if(!lastName){toast('Ingresa tu apellido.');return}
    if(dni.length!==8){toast('Ingresa un DNI válido de 8 dígitos.');return}
    if(cel.length!==9 || !cel.startsWith('9')){toast('Ingresa un celular válido de 9 dígitos que comience con 9.');return}
    if(!birthDay || !birthMonth || !birthYear){toast('Selecciona tu fecha de nacimiento.');return}
    if(!district){toast('Selecciona tu distrito.');return}
    if(district==='Otros' && !document.getElementById('otherDistrict')?.value.trim()){
      toast('Escribe tu distrito.');
      return;
    }

    const birth = new Date(+birthYear, +birthMonth - 1, +birthDay);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const beforeBirthday = (today.getMonth() < birth.getMonth()) ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
    if(beforeBirthday) age--;
    if(age < 18){toast('Debes tener 18 años o más para registrarte.');return}
  }

  if(pStep===2){
    if(!document.getElementById('consent').checked){
      toast('Debes leer y aceptar el consentimiento para continuar.');
      return;
    }

    const registrado = await registerPatientFromForm();
    if(!registrado) return;
  }

  if(pStep<3){
    pStep++;
    updatePatient();
  }
}
function patientPrev(){if(pStep>1){pStep--;updatePatient()}}

async function registerPatientFromForm(){
  try{
    if(selectedPatientBranch !== 'Sede Villasol'){
      throw new Error('El registro conectado a la base de datos está habilitado por ahora solo para Sede Villasol.');
    }

    const nombre = document.getElementById('patientName')?.value.trim() || '';
    const apellido = document.getElementById('patientLastName')?.value.trim() || '';
    const dni = document.getElementById('dni')?.value.replace(/\D/g,'') || '';
    const celular = document.getElementById('cel')?.value.replace(/\D/g,'') || '';
    const dia = Number(document.getElementById('birthDay')?.value);
    const mes = Number(document.getElementById('birthMonth')?.value);
    const anio = Number(document.getElementById('birthYear')?.value);
    const fechaNacimiento = `${anio}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;

    const distritoSeleccionado = document.getElementById('patientDistrict')?.value || '';
    const distrito = distritoSeleccionado === 'Otros'
      ? document.getElementById('otherDistrict')?.value.trim() || 'Otros'
      : distritoSeleccionado;

    const referralButton = document.querySelector('#referralChips .chip.active');
    let comoNosConocio = referralButton ? referralButton.textContent.trim() : '';
    if(comoNosConocio === 'Otros'){
      comoNosConocio = document.querySelector('#otherReferral input')?.value.trim() || 'Otros';
    }

    const pacienteApi = {
      nombre,
      apellido,
      dni,
      celular,
      fechaNacimiento,
      distrito,
      ocupacion: document.getElementById('patientOccupation')?.value.trim() || '',
      intervencionPrevia: getBinaryValue('previousFaceProcedure'),
      detalleIntervencion: document.getElementById('previousFaceProcedureDetails')?.value.trim() || '',
      primeraLimpiezaFacial: getBinaryValue('firstFacialCleaning'),
      alergiasEnfermedades: document.getElementById('patientAllergy')?.value.trim() || '',
      comoNosConocio,
      consentimientoAceptado: document.getElementById('consent')?.checked === true
    };

    await enviarApi('registrarPaciente', { paciente: pacienteApi });

    // Sheets es la fuente de verdad: recargamos el listado real.
    await cargarPacientesDesdeApi({ force: true });

    const successText = document.querySelector('.step[data-step="3"] .success .muted');
    if(successText){
      successText.textContent = `${nombre} ${apellido}, tu información fue registrada correctamente.`;
    }

    return true;
  }catch(error){
    console.error('Error al registrar paciente:', error);
    toast(error.message || 'No se pudo registrar al paciente.');
    return false;
  }
}

function refreshPatientLists(){
  const recent = document.getElementById('recentPatients');
  if(recent) recent.innerHTML = patients.map(patientHtml).join('');

  const q = document.getElementById('searchInput')?.value.trim();
  if(q) renderSearch();

  renderUpcomingBirthdays();
}

function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),2500)}

const refs=['TikTok','Instagram','Facebook','Google Maps','Recomendación','Otros'];
const refEl=document.getElementById('referralChips');
refs.forEach(r=>{
  const b=document.createElement('button');
  b.className='chip';
  b.type='button';
  b.textContent=r;
  b.onclick=()=>{
    [...refEl.children].forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById('otherReferral').classList.toggle('hidden',r!=='Otros');
  };
  refEl.appendChild(b);
});

let selectedPatientDni = '';

function patientHtml(p){
  const safeDni = String(p.dni).replace(/'/g,"");
  return `<div class="patient-row card">
    <div class="avatar">${(p.name||'?')[0]}</div>
    <div><strong>${p.name}</strong><div class="meta">DNI ${p.dni} &nbsp;·&nbsp; ${p.cell} &nbsp;·&nbsp; ${p.age}</div></div>
    <div><div class="eyebrow">ÚLTIMA ATENCIÓN</div><strong>${p.last}</strong></div>
    <button class="btn light" type="button" onclick="viewPatient('${safeDni}')">Ver ficha</button>
  </div>`;
}

function viewPatient(dni){
  selectedPatientDni = String(dni);
  closeAllPatientsModal();
  renderSelectedPatientProfile();
  showAdmin('profile');
}

function formatBirthDate(iso){
  if(!iso) return 'No indicada';
  const [y,m,d] = iso.split('-').map(Number);
  if(!y || !m || !d) return iso;
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${String(d).padStart(2,'0')} ${months[m-1]} ${y}`;
}

function renderSelectedPatientProfile(){
  const p = patients.find(x => String(x.dni) === String(selectedPatientDni));
  if(!p) return;

  const parts = (p.name || '').trim().split(/\s+/);
  const firstName = p.firstName || parts.shift() || '';
  const lastName = p.lastName || parts.join(' ') || '';
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'P';

  const setText = (id,val) => {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
  };

  setText('profileBreadcrumbName', p.name);
  setText('profileAvatar', initials);
  setText('profileFullName', p.name);
  setText('profileMeta', `DNI ${p.dni} · ${p.cell} · Edad: ${p.age}`);
  setText('profileLastAttention', p.hasAttention ? p.last : 'Sin atenciones');
  setText('profilePatientCode', `PAC-${String(p.dni).slice(-6).padStart(6,'0')}`);
  setText('profileName', firstName);
  setText('profileLastName', lastName);
  setText('profileDni', p.dni);
  setText('profileCell', p.cell);
  setText('profileBirthDate', formatBirthDate(p.birthDate));
  setText('profileAge', p.age);
  setText('profileDistrict', p.district || 'No indicado');
  setText('profileOccupation', p.occupation || 'No indicado');
  setText('profileBranch', p.branch || 'No indicada');
  setText('profileReferral', p.referral || 'No indicado');
  setText('profileAllergy', p.allergy || 'Sin información registrada.');
  setText('profilePreviousProcedure', p.previousFaceProcedure || 'No indicado');
  setText('profileFirstFacialCleaning', p.firstFacialCleaning || 'No indicado');
  setText('profileConsent', p.consentAccepted === true ? 'He leído y acepto' : (p.consentAccepted === false ? 'No aceptado' : 'No indicado'));

  const procedureDetailsItem = document.getElementById('profilePreviousProcedureDetailsItem');
  const hasProcedureDetails = (p.previousFaceProcedure === 'Sí') && String(p.previousFaceProcedureDetails || '').trim();
  if(procedureDetailsItem){
    procedureDetailsItem.classList.toggle('hidden', !hasProcedureDetails);
  }
  setText('profilePreviousProcedureDetails', hasProcedureDetails ? p.previousFaceProcedureDetails : 'No indicado');

  const evolution = document.getElementById('profileEvolution');
  const diagnosisContent = document.getElementById('profileDiagnosisContent');
  const recommendationsContent = document.getElementById('profileRecommendationsContent');
  const historyContent = document.getElementById('profileHistoryContent');

  const appts = Array.isArray(p.appointments) ? p.appointments : [];

  if(appts.length){
    renderPatientAppointments(p, appts, evolution, diagnosisContent, recommendationsContent, historyContent);
  }else if(!p.hasAttention){
    if(evolution) evolution.innerHTML = `
      <div class="panel card">
        <h3>Historial de atenciones</h3>
        <div class="empty">Este paciente todavía no tiene atenciones registradas.</div>
      </div>`;
    if(diagnosisContent) diagnosisContent.innerHTML = `<div class="panel card"><h3>Histórico de diagnósticos</h3><div class="empty">Sin diagnósticos registrados.</div></div>`;
    if(recommendationsContent) recommendationsContent.innerHTML = `<div class="panel card"><h3>Recomendaciones</h3><div class="empty">Sin recomendaciones registradas.</div></div>`;
    if(historyContent) historyContent.innerHTML = `<div class="panel card"><h3>Historial</h3><div class="empty">Sin atenciones registradas.</div></div>`;
  }else{
    if(evolution && !evolution.dataset.defaultHtml) evolution.dataset.defaultHtml = evolution.innerHTML;
    if(diagnosisContent && !diagnosisContent.dataset.defaultHtml) diagnosisContent.dataset.defaultHtml = diagnosisContent.innerHTML;
    if(recommendationsContent && !recommendationsContent.dataset.defaultHtml) recommendationsContent.dataset.defaultHtml = recommendationsContent.innerHTML;
    if(historyContent && !historyContent.dataset.defaultHtml) historyContent.dataset.defaultHtml = historyContent.innerHTML;

    if(evolution?.dataset.defaultHtml) evolution.innerHTML = evolution.dataset.defaultHtml;
    if(diagnosisContent?.dataset.defaultHtml) diagnosisContent.innerHTML = diagnosisContent.dataset.defaultHtml;
    if(recommendationsContent?.dataset.defaultHtml) recommendationsContent.innerHTML = recommendationsContent.dataset.defaultHtml;
    if(historyContent?.dataset.defaultHtml) historyContent.innerHTML = historyContent.dataset.defaultHtml;
  }
}

function renderPatientAppointments(p, appts, evolution, diagnosisContent, recommendationsContent, historyContent){
  const dateLabel = iso => formatBirthDate(iso);

  if(evolution){
    evolution.innerHTML = `
      <div class="panel card">
        <h3>Evolución reciente</h3>
        <p class="muted">Diagnósticos registrados por atención</p>
        ${appts.slice(0,4).map(a=>`
          <div class="timeline-item">
            <div class="eyebrow">${esc(dateLabel(a.date)).toUpperCase()}</div>
            ${a.diagnoses?.length
              ? `<div class="chips" style="margin-top:10px">${a.diagnoses.map(d=>`<span class="chip">${esc(d)}</span>`).join('')}</div>`
              : `<div class="muted" style="margin-top:8px">Sin diagnósticos registrados.</div>`}
          </div>`).join('')}
      </div>
      <div class="panel card">
        <h3>Últimas atenciones</h3>
        ${appts.slice(0,4).map(a=>{
          const treatmentNames=(a.treatments||[]).map(t=>t.name).filter(Boolean);
          return `<div class="timeline-item">
            <strong>${esc(treatmentNames.join(', ') || 'Atención')}</strong>
            <div class="muted">${esc(dateLabel(a.date))} · ${esc(a.totalText || 'S/ 0.00')} · ${esc(a.specialist || '')}</div>
          </div>`;
        }).join('')}
      </div>`;
  }

  if(diagnosisContent){
    diagnosisContent.innerHTML = `
      <div class="panel card">
        <h3>Histórico de diagnósticos</h3>
        <p class="muted">Cada diagnóstico permanece asociado a su atención.</p>
        ${appts.map(a=>`
          <div class="timeline-item">
            <strong>${esc(dateLabel(a.date))}</strong>
            ${a.diagnoses?.length
              ? `<div class="chips" style="margin-top:10px">${a.diagnoses.map(d=>`<span class="chip">${esc(d)}</span>`).join('')}</div>`
              : `<div class="muted" style="margin-top:8px">Sin diagnósticos registrados.</div>`}
          </div>`).join('')}
      </div>`;
  }

  if(recommendationsContent){
    recommendationsContent.innerHTML = `
      <div class="panel card">
        <h3>Recomendaciones</h3>
        ${appts.map(a=>`
          <div class="timeline-item">
            <div class="eyebrow">${esc(dateLabel(a.date)).toUpperCase()}</div>
            ${a.recommendation ? `<strong>Recomendación</strong><p>${esc(a.recommendation)}</p>` : ''}
            ${a.routine ? `<strong>Rutina / indicaciones</strong><p>${esc(a.routine)}</p>` : ''}
            ${!a.recommendation && !a.routine ? `<div class="muted">Sin recomendaciones registradas.</div>` : ''}
          </div>`).join('')}
      </div>`;
  }

  if(historyContent){
    historyContent.innerHTML = `
      <div class="panel card">
        <div class="history-row head"><div>FECHA</div><div>TRATAMIENTO</div><div>ESPECIALISTA</div><div>MONTO</div><div>DETALLE</div></div>
        ${appts.map(a=>{
          const treatmentNames=(a.treatments||[]).map(t=>t.name).filter(Boolean).join(', ') || 'Atención';
          return `<div class="history-row">
            <div>${esc(dateLabel(a.date))}</div>
            <div><strong>${esc(treatmentNames)}</strong></div>
            <div>${esc(a.specialist || '—')}</div>
            <div>${esc(a.totalText || 'S/ 0.00')}</div>
            <button class="btn light" type="button" onclick="showAppointmentDetail(${a.id})">Ver</button>
          </div>`;
        }).join('')}
        <div class="mobile-history">
          ${appts.map(a=>{
            const treatmentNames=(a.treatments||[]).map(t=>t.name).filter(Boolean).join(', ') || 'Atención';
            return `<div class="card" style="padding:18px">
              <div class="eyebrow">${esc(dateLabel(a.date)).toUpperCase()}</div>
              <h3>${esc(treatmentNames)}</h3>
              <div class="muted">${esc(a.specialist || '—')} · Total ${esc(a.totalText || 'S/ 0.00')}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }
}

function showAppointmentDetail(id){
  const p=patients.find(x=>String(x.dni)===String(selectedPatientDni));
  let a=p?.appointments?.find(x=>String(x.id)===String(id));

  // Fallback para registros demo estáticos.
  if(!a){
    const fallback={
      1001:{id:1001,date:'2026-09-10',branch:'Sede 1',specialist:'Brenda Ramírez',diagnoses:['Piel mixta','Manchas'],routine:'Limpiador suave, sérum hidratante y protector solar FPS 50.',observations:'Buena tolerancia al procedimiento.',treatments:[{name:'Hydra Facial',price:79}],products:[{name:'Sérum hidratante',qty:1,price:49}],payment:'Yape',discount:0,totalText:'S/ 128.00'},
      1002:{id:1002,date:'2026-06-15',branch:'Sede 1',specialist:'Valeria Torres',diagnoses:['Piel acneica','Poros abiertos'],routine:'Niacinamida por las noches, hidratación y protector solar.',observations:'',treatments:[{name:'Limpieza profunda',price:95}],products:[],payment:'Tarjeta',discount:0,totalText:'S/ 95.00'},
      1003:{id:1003,date:'2026-03-08',branch:'Sede 1',specialist:'Brenda Ramírez',diagnoses:['Piel sensible'],routine:'Hidratación y protector solar.',observations:'',treatments:[{name:'Peeling facial',price:110}],products:[],payment:'Efectivo',discount:0,totalText:'S/ 110.00'}
    };
    a=fallback[id];
  }

  if(!a){
    toast('No se encontró el detalle de esta atención.');
    return;
  }

  const treatments=(a.treatments||[]).map(t=>`${esc(t.name)}${t.price!=null ? ` · S/ ${Number(t.price).toFixed(2)}` : ''}`).join('<br>') || 'Sin tratamientos';
  const products=(a.products||[]).map(x=>`${esc(x.name)}${x.qty ? ` x${x.qty}` : ''}`).join('<br>') || 'Sin productos';
  const diagnoses=(a.diagnoses||[]).map(esc).join(', ') || 'Sin diagnósticos';
  const next=a.nextRecommendation ? esc(a.nextRecommendation) : 'No registrada';

  const content=document.getElementById('appointmentDetailContent');
  if(content){
    content.innerHTML=`
      <div class="prototype-detail-grid">
        <div class="prototype-detail-item"><div class="k">FECHA</div><div class="v">${esc(formatBirthDate(a.date))}</div></div>
        <div class="prototype-detail-item"><div class="k">ESPECIALISTA</div><div class="v">${esc(a.specialist || '—')}</div></div>
        <div class="prototype-detail-item"><div class="k">SEDE</div><div class="v">${esc(a.branch || '—')}</div></div>
        <div class="prototype-detail-item"><div class="k">MEDIO DE PAGO</div><div class="v">${esc(a.payment || '—')}</div></div>
        <div class="prototype-detail-item prototype-detail-item--wide"><div class="k">DIAGNÓSTICOS</div><div class="v">${diagnoses}</div></div>
        <div class="prototype-detail-item prototype-detail-item--wide"><div class="k">RUTINA / INDICACIONES</div><div class="v">${esc(a.routine || 'Sin indicaciones')}</div></div>
        <div class="prototype-detail-item prototype-detail-item--wide"><div class="k">OBSERVACIONES</div><div class="v">${esc(a.observations || 'Sin observaciones')}</div></div>
        <div class="prototype-detail-item"><div class="k">TRATAMIENTOS</div><div class="v">${treatments}</div></div>
        <div class="prototype-detail-item"><div class="k">PRODUCTOS</div><div class="v">${products}</div></div>
        <div class="prototype-detail-item"><div class="k">TOTAL</div><div class="v">${esc(a.totalText || 'S/ 0.00')}</div></div>
        <div class="prototype-detail-item"><div class="k">PRÓXIMA CITA</div><div class="v">${next}</div></div>
      </div>`;
  }

  document.getElementById('appointmentDetailModal')?.classList.remove('hidden');
  document.body.style.overflow='hidden';
}

function closeAppointmentDetailModal(){
  document.getElementById('appointmentDetailModal')?.classList.add('hidden');
  document.body.style.overflow='';
}

document.getElementById('recentPatients').innerHTML=patients.map(patientHtml).join('');
function openPatientEditModal(){
  const p=patients.find(x=>String(x.dni)===String(selectedPatientDni));
  if(!p){toast('No se encontró al paciente.');return}

  document.getElementById('editPatientFirstName').value=p.firstName || '';
  document.getElementById('editPatientLastName').value=p.lastName || '';
  document.getElementById('editPatientDni').value=p.dni || '';
  document.getElementById('editPatientCell').value=String(p.cell || '').replace(/\D/g,'');
  document.getElementById('editPatientDistrict').value=p.district || '';
  document.getElementById('editPatientOccupation').value=p.occupation || '';
  document.getElementById('editPatientBranch').value=p.branch || '';
  document.getElementById('editPatientReferral').value=p.referral || '';
  document.getElementById('editPatientAllergy').value=p.allergy || '';

  document.getElementById('patientEditModal')?.classList.remove('hidden');
  document.body.style.overflow='hidden';
}

function closePatientEditModal(){
  document.getElementById('patientEditModal')?.classList.add('hidden');
  document.body.style.overflow='';
}

function savePatientEdit(){
  const p=patients.find(x=>String(x.dni)===String(selectedPatientDni));
  if(!p){toast('No se encontró al paciente.');return}

  const firstName=document.getElementById('editPatientFirstName').value.trim();
  const lastName=document.getElementById('editPatientLastName').value.trim();
  const dni=document.getElementById('editPatientDni').value.replace(/\D/g,'');
  const cell=document.getElementById('editPatientCell').value.replace(/\D/g,'');

  if(!firstName || !lastName){toast('Completa nombre y apellido.');return}
  if(dni.length!==8){toast('El DNI debe tener 8 dígitos.');return}
  if(cell.length!==9){toast('El celular debe tener 9 dígitos.');return}

  const duplicate=patients.find(x=>x!==p && String(x.dni)===dni);
  if(duplicate){toast('Ya existe otro paciente con ese DNI.');return}

  p.firstName=firstName;
  p.lastName=lastName;
  p.name=`${firstName} ${lastName}`;
  p.dni=dni;
  p.cell=`${cell.slice(0,3)} ${cell.slice(3,6)} ${cell.slice(6)}`;
  p.district=document.getElementById('editPatientDistrict').value.trim() || 'No indicado';
  p.occupation=document.getElementById('editPatientOccupation').value.trim() || 'No indicado';
  p.branch=document.getElementById('editPatientBranch').value.trim() || 'No indicada';
  p.referral=document.getElementById('editPatientReferral').value.trim() || 'No indicado';
  p.allergy=document.getElementById('editPatientAllergy').value.trim() || 'Sin información registrada.';

  selectedPatientDni=dni;
  refreshPatientLists();
  renderSelectedPatientProfile();
  closePatientEditModal();
  toast('Datos del paciente actualizados.');
}

function openAllPatientsModal(){
  const el=document.getElementById('allPatientsList');
  if(el){
    el.innerHTML=patients.map(patientHtml).join('');
  }
  document.getElementById('allPatientsModal')?.classList.remove('hidden');
  document.body.style.overflow='hidden';
}

function closeAllPatientsModal(){
  document.getElementById('allPatientsModal')?.classList.add('hidden');
  document.body.style.overflow='';
}

function renderSearch(){
 const q=document.getElementById('searchInput').value.toLowerCase().trim();
 const el=document.getElementById('searchResults'); if(!q){el.innerHTML='';return}
 const norm=s=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 const nq=norm(q);
 const found=patients.filter(p=>norm(`${p.name} ${p.dni} ${p.cell}`).includes(nq));
 el.innerHTML=found.length?found.map(patientHtml).join(''):'<div class="empty">No encontramos pacientes con esa búsqueda.</div>';
}
function tab(id,btn){document.querySelectorAll('.tab-pane').forEach(e=>e.classList.remove('active'));document.getElementById(id).classList.add('active');document.querySelectorAll('.tabs button').forEach(e=>e.classList.remove('active'));btn.classList.add('active')}

const diagnoses=['Piel normal','Piel seca','Piel grasa','Piel mixta','Piel acneica','Secuelas de acné','Piel sensible','Melasma','Rosácea','Manchas','Inflamación','Poros abiertos','Puntos negros','Deshidratada','Comedogénico','Arrugas','Embarazo','Acné hormonal'];
const diagEl=document.getElementById('diagnosisChips');
diagnoses.forEach(d=>{
  const b=document.createElement('button');
  b.className='chip';
  b.type='button';
  b.textContent=d;
  b.onclick=()=>b.classList.toggle('active');
  diagEl.appendChild(b);
});

let treatments=[], products=[];
function renderTreatments(){const el=document.getElementById('treatments');el.innerHTML=treatments.map((t,i)=>`<div class="line-item"><div><label>TRATAMIENTO</label><select onchange="treatments[${i}].name=this.value"><option ${t.name==='Hydra Facial'?'selected':''}>Hydra Facial</option><option>Limpieza profunda</option><option>Peeling facial</option></select></div><div><label>PRECIO</label><input type="number" value="${t.price}" oninput="treatments[${i}].price=+this.value;calcTotal()"/></div><button class="remove" onclick="treatments.splice(${i},1);renderTreatments();calcTotal()">×</button></div>`).join('')}
function addTreatment(){treatments.push({name:'Hydra Facial',price:79});renderTreatments();calcTotal()}
function renderProducts(){const el=document.getElementById('products');el.innerHTML=products.map((p,i)=>`<div class="product-item"><div><label>PRODUCTO</label><select><option>${p.name}</option><option>Protector solar FPS 50</option><option>Limpiador facial</option></select></div><div><label>CANT.</label><input type="number" min="1" value="${p.qty}" oninput="products[${i}].qty=+this.value;calcTotal()"/></div><div><label>P. UNIT.</label><input type="number" value="${p.price}" oninput="products[${i}].price=+this.value;calcTotal()"/></div><div><label>SUBTOTAL</label><input disabled value="S/ ${(p.qty*p.price).toFixed(2)}"/></div><button class="remove" onclick="products.splice(${i},1);renderProducts();calcTotal()">×</button></div>`).join('')}
function addProduct(){products.push({name:'Sérum hidratante',qty:1,price:49});renderProducts();calcTotal()}
function calcTotal(){const t=treatments.reduce((a,b)=>a+(+b.price||0),0),p=products.reduce((a,b)=>a+(+b.qty||0)*(+b.price||0),0),d=+document.getElementById('discount').value||0,total=Math.max(0,t+p-d);document.getElementById('sumTreat').textContent=`S/ ${t.toFixed(2)}`;document.getElementById('sumProd').textContent=`S/ ${p.toFixed(2)}`;document.getElementById('sumDisc').textContent=`- S/ ${d.toFixed(2)}`;document.getElementById('grandTotal').textContent=`S/ ${total.toFixed(2)}`;renderProducts()}
function setNextMode(m){document.getElementById('dateMode').classList.toggle('active',m==='date');document.getElementById('approxMode').classList.toggle('active',m==='approx');document.getElementById('nextDate').classList.toggle('hidden',m!=='date');document.getElementById('nextApprox').classList.toggle('hidden',m!=='approx')}
function esc(v){
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));
}

function getSelectedDiagnoses(){
  return [...document.querySelectorAll('#diagnosisChips .chip.active')]
    .map(b=>b.textContent.trim());
}

function resetAppointmentForm(){
  const p=patients.find(x=>String(x.dni)===String(selectedPatientDni));
  const lastAppointment = Array.isArray(p?.appointments) && p.appointments.length ? p.appointments[0] : null;
  const isFirstTime = !lastAppointment;

  const contextNote=document.getElementById('appointmentContextNote');
  if(contextNote){
    contextNote.textContent = isFirstTime
      ? 'Paciente primerizo: la atención inicia completamente limpia.'
      : 'Paciente con historial: se muestran como referencia el último diagnóstico, recomendación y rutina. Puedes modificarlos para esta nueva atención.';
  }

  // Limpiar siempre los datos propios de la nueva atención/transacción.
  document.querySelectorAll('#diagnosisChips .chip').forEach(b=>b.classList.remove('active'));

  ['appointmentOtherDiagnosis','appointmentRoutine',
   'appointmentObservations','appointmentNextDate','appointmentNextApprox'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });

  const payment=document.getElementById('appointmentPayment');
  if(payment) payment.value='';

  const discount=document.getElementById('discount');
  if(discount) discount.value='0';

  treatments=[];
  products=[];
  renderTreatments();
  renderProducts();
  calcTotal();
  setNextMode('date');

  // Datos operativos que sí pueden heredarse del paciente.
  const branch=document.getElementById('appointmentBranch');
  if(branch && p?.branch && [...branch.options].some(o=>o.value===p.branch)){
    branch.value=p.branch;
  }

  const specialist=document.getElementById('appointmentSpecialist');
  if(specialist && selectedStaff){
    const opt=[...specialist.options].find(o=>o.textContent.trim()===selectedStaff);
    if(opt) specialist.value=opt.value;
  }

  // Paciente recurrente: conservar referencia clínica de la última atención.
  // No se copian pagos, tratamientos ni productos porque pertenecen a una atención nueva.
  if(!isFirstTime){
    const previousDiagnoses = Array.isArray(lastAppointment.diagnoses) ? lastAppointment.diagnoses : [];
    document.querySelectorAll('#diagnosisChips .chip').forEach(b=>{
      if(previousDiagnoses.includes(b.textContent.trim())){
        b.classList.add('active');
      }
    });

    const routine=document.getElementById('appointmentRoutine');
    if(routine) routine.value=lastAppointment.routine || '';
  }
}

function saveAppointment(){
  const p=patients.find(x=>String(x.dni)===String(selectedPatientDni));
  if(!p){toast('No se encontró al paciente.');return}

  const diagnosesSelected=getSelectedDiagnoses();
  const other=document.getElementById('appointmentOtherDiagnosis')?.value.trim() || '';
  if(other) diagnosesSelected.push(other);

  const date=document.getElementById('appointmentDate')?.value || '';
  const branch=document.getElementById('appointmentBranch')?.value || '';
  const specialistSelect=document.getElementById('appointmentSpecialist');
  const specialist=specialistSelect?.options[specialistSelect.selectedIndex]?.text || '';
  const routine=document.getElementById('appointmentRoutine')?.value.trim() || '';
  const observations=document.getElementById('appointmentObservations')?.value.trim() || '';
  const payment=document.getElementById('appointmentPayment')?.value || '';
  const discount=+document.getElementById('discount')?.value || 0;
  const totalText=document.getElementById('grandTotal')?.textContent || 'S/ 0.00';
  const nextMode=document.getElementById('dateMode')?.classList.contains('active') ? 'date' : 'approx';
  const nextRecommendation=nextMode==='date'
    ? (document.getElementById('appointmentNextDate')?.value || '')
    : (document.getElementById('appointmentNextApprox')?.value.trim() || '');

  const appointment={
    id: Date.now(),
    date,
    branch,
    specialist,
    diagnoses: diagnosesSelected,
    routine,
    observations,
    treatments: treatments.map(x=>({...x})),
    products: products.map(x=>({...x})),
    payment,
    discount,
    totalText,
    nextMode,
    nextRecommendation
  };

  if(!Array.isArray(p.appointments)) p.appointments=[];
  p.appointments.unshift(appointment);
  p.hasAttention=true;
  p.last=date ? formatDisplayDateShort(date) : 'Atención registrada';

  refreshPatientLists();
  renderSelectedPatientProfile();

  toast('Atención registrada correctamente.');
  setTimeout(()=>showAdmin('profile'),700);
}

function formatDisplayDateShort(iso){
  if(!iso) return '';
  const [y,m,d]=iso.split('-').map(Number);
  const months=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${String(d).padStart(2,'0')} ${months[m-1]} ${y}`;
}

const monthNames=['Mes','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function fillBirthSelectors(){
  const day=document.getElementById('birthDay');
  const month=document.getElementById('birthMonth');
  const year=document.getElementById('birthYear');
  if(!day || !month || !year) return;

  day.innerHTML = '<option value="">Día</option>' + Array.from({length:31},(_,i)=>`<option value="${i+1}">${String(i+1).padStart(2,'0')}</option>`).join('');
  month.innerHTML = monthNames.map((m,i)=> i===0 ? '<option value="">Mes</option>' : `<option value="${i}">${m}</option>`).join('');

  const currentYear = new Date().getFullYear();
  const maxYear = currentYear - 18;
  const minYear = 1940;
  let yearOptions = '<option value="">Año</option>';
  for(let y=maxYear; y>=minYear; y--){
    yearOptions += `<option value="${y}">${y}</option>`;
  }
  year.innerHTML = yearOptions;

  day.value = '';
  month.value = '';
  year.value = '';

  [day,month,year].forEach(el=>el.addEventListener('change',updateAgeFromBirth));
  updateAgeFromBirth();
}
function updateAgeFromBirth(){
  const d = +document.getElementById('birthDay')?.value;
  const m = +document.getElementById('birthMonth')?.value;
  const y = +document.getElementById('birthYear')?.value;
  const ageField = document.getElementById('ageField');
  if(!ageField) return;
  if(!d || !m || !y){
    ageField.value = '';
    return;
  }
  const today = new Date();
  let age = today.getFullYear() - y;
  const hasHadBirthday = (today.getMonth()+1 > m) || ((today.getMonth()+1 === m) && (today.getDate() >= d));
  if(!hasHadBirthday) age--;
  ageField.value = age + ' años';
}

fillBirthSelectors();

function showSettingsTab(tab, el){
  document.querySelectorAll('.settings-panel').forEach(p=>{
    p.classList.add('hidden');
    p.classList.remove('active');
  });
  const target = document.getElementById('settings-' + tab);
  if(target){
    target.classList.remove('hidden');
    target.classList.add('active');
  }
  document.querySelectorAll('.settings-tab').forEach(b=>b.classList.remove('active'));
  if(el) el.classList.add('active');
}


function getUpcomingBirthdays(list){
  const today = new Date();
  return list.map(p => {
    const birth = new Date(p.birthDate + 'T00:00:00');
    const nextBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    if(nextBirthday < new Date(today.getFullYear(), today.getMonth(), today.getDate())){
      nextBirthday.setFullYear(today.getFullYear() + 1);
    }
    const diffMs = nextBirthday - new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysLeft = Math.round(diffMs / (1000*60*60*24));
    const turning = nextBirthday.getFullYear() - birth.getFullYear();
    return {...p, nextBirthday, daysLeft, turning};
  }).filter(p => p.daysLeft >= 0 && p.daysLeft <= 14)
    .sort((a,b) => a.daysLeft - b.daysLeft);
}

function renderUpcomingBirthdays(){
  const el = document.getElementById('upcomingBirthdays');
  if(!el) return;
  const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const upcoming = getUpcomingBirthdays(patients);
  if(!upcoming.length){
    el.innerHTML = '<div class="card empty-birthday">No hay cumpleaños en los próximos 14 días.</div>';
    return;
  }
  el.innerHTML = upcoming.map(p => {
    const d = p.nextBirthday.getDate();
    const m = months[p.nextBirthday.getMonth()];
    const badge = p.daysLeft === 0 ? 'Hoy' : p.daysLeft === 1 ? 'Mañana' : 'En ' + p.daysLeft + ' días';
    return `
      <div class="birthday-card card">
        <div class="birthday-top">
          <div>
            <div class="birthday-date">${String(d).padStart(2,'0')}</div>
            <div class="birthday-month">${m}</div>
          </div>
          <div class="birthday-badge">${badge}</div>
        </div>
        <div class="birthday-name">${p.name}</div>
        <div class="muted">Cumplirá ${p.turning} años</div>
        <div class="birthday-meta">
          <div>DNI ${p.dni}</div>
          <div>${p.cell}</div>
        </div>
        <div class="birthday-actions">
          <button class="btn light" type="button" onclick="viewPatient('${String(p.dni).replace(/'/g,"")}')">Ver ficha</button>
        </div>
      </div>
    `;
  }).join('');
}


let selectedStaff = null;

/*
  Especialistas:
  La fuente de verdad es Google Sheets.
  El frontend recibe los registros a través de:
  GitHub Pages → Cloudflare Worker → Apps Script → Google Sheets.
*/
let specialists = [];
let specialistsLoaded = false;
let specialistsLoadingPromise = null;

async function cargarEspecialistasDesdeApi({ force = false } = {}) {
  if (specialistsLoaded && !force) {
    return specialists;
  }

  if (specialistsLoadingPromise && !force) {
    return specialistsLoadingPromise;
  }

  specialistsLoadingPromise = (async () => {
    const resultado = await enviarApi('listarEspecialistas');

    const registros = Array.isArray(resultado?.especialistas)
      ? resultado.especialistas
      : [];

    specialists = registros.map(item => ({
      id: String(item.idEspecialista || '').trim(),
      name: String(item.nombre || '').trim(),
      specialty: String(item.especialidad || '').trim(),
      active: String(item.estado || '').trim().toLowerCase() === 'activo'
    }));

    specialistsLoaded = true;

    renderStaffOptions();
    renderAppointmentSpecialists();
    renderSpecialistsSettings();

    return specialists;
  })();

  try {
    return await specialistsLoadingPromise;
  } finally {
    specialistsLoadingPromise = null;
  }
}


let diagnostics = [
  { id: 1, name: 'Piel seca', category: 'Tipo de piel', active: true },
  { id: 2, name: 'Piel mixta', category: 'Tipo de piel', active: true },
  { id: 3, name: 'Rosácea', category: 'Condición', active: true },
  { id: 4, name: 'Manchas', category: 'Condición', active: true }
];

let treatmentsCatalog = [
  { id: 1, name: 'Hydra Facial', price: 79, active: true },
  { id: 2, name: 'Limpieza profunda', price: 95, active: true },
  { id: 3, name: 'Peeling facial', price: 110, active: true }
];

let productsCatalog = [
  { id: 1, name: 'Sérum hidratante', price: 49, active: true },
  { id: 2, name: 'Protector solar FPS 50', price: 65, active: true }
];

let branchesCatalog = ['Sede 1', 'Sede 2'];
let paymentMethodsCatalog = ['Efectivo', 'Yape', 'Plin', 'Tarjeta'];
let appointmentStatusesCatalog = ['En agenda', 'Confirmada', 'Pendiente', 'Cancelada'];
let consentVersion = 'Consentimiento v1.0';
let consentText = 'He sido informado(a) sobre el procedimiento, sus posibles reacciones y cuidados posteriores. Acepto realizarme el tratamiento de forma voluntaria.';

let currentCatalogType = null;
let specialistEditId = null;
let catalogEditId = null;
let generalEditType = null;
let generalEditIndex = null;

function renderStaffOptions(){
  const box = document.getElementById('staffOptions');
  if(!box) return;

  const activeSpecialists = specialists.filter(s => s.active);

  if(!activeSpecialists.length){
    box.innerHTML = `
      <div class="muted" style="padding:12px 0">
        No hay especialistas activos disponibles.
      </div>`;
    return;
  }

  box.innerHTML = activeSpecialists.map(s =>
    `<button type="button" onclick="selectStaff('${String(s.name).replace(/'/g, "\'")}')">${esc(s.name)}</button>`
  ).join('');
}

async function showStaffSelector(){
  const modal = document.getElementById('staffSelector');
  const box = document.getElementById('staffOptions');

  modal?.classList.remove('hidden');

  if(box){
    box.innerHTML = `
      <div class="muted" style="padding:12px 0">
        Cargando especialistas...
      </div>`;
  }

  try{
    await cargarEspecialistasDesdeApi();
    renderStaffOptions();
  }catch(error){
    console.error('Error al cargar especialistas:', error);

    if(box){
      box.innerHTML = `
        <div class="muted" style="padding:12px 0">
          No se pudieron cargar los especialistas.
        </div>`;
    }

    toast(
      error.message ||
      'No se pudieron cargar los especialistas.'
    );
  }
}

function closeStaffSelector(){
  document.getElementById('staffSelector')?.classList.add('hidden');
}

function selectStaff(name){
  selectedStaff = name;
  closeStaffSelector();
  showAdmin('home');
}

function renderAppointmentSpecialists(){
  const select = document.getElementById('appointmentSpecialist');
  if(!select) return;

  const activeSpecialists = specialists.filter(s => s.active);

  if(!activeSpecialists.length){
    select.innerHTML =
      '<option value="">Sin especialistas disponibles</option>';
    return;
  }

  select.innerHTML = activeSpecialists
    .map(s =>
      `<option value="${esc(s.id)}">${esc(s.name)}</option>`
    )
    .join('');
}

function renderSpecialistsSettings(){
  const list = document.getElementById('specialistsSettingsList');
  if(!list) return;

  if(!specialists.length){
    list.innerHTML =
      '<div class="empty">No hay especialistas registrados.</div>';
    return;
  }

  list.innerHTML = specialists.map(s => `
    <div class="settings-list__row">
      <div>${esc(s.name)}</div>
      <div>${esc(s.specialty || '—')}</div>
      <div><span class="status-pill">${s.active ? 'Activa' : 'Inactiva'}</span></div>
      <div>
        <button
          class="btn light"
          type="button"
          onclick="editSpecialist('${String(s.id).replace(/'/g, "\'")}')">
          Editar
        </button>
      </div>
    </div>
  `).join('');
}

function renderDiagnosticsSettings(){
  const list = document.getElementById('diagnosticsSettingsList');
  if(!list) return;
  list.innerHTML = diagnostics.map(d => `
    <div class="settings-list__row">
      <div>${d.name}</div>
      <div>${d.category}</div>
      <div><span class="status-pill">${d.active ? 'Activo' : 'Inactivo'}</span></div>
      <div><button class="btn light" type="button" onclick="openCatalogModal('diagnostic', ${d.id})">Editar</button></div>
    </div>
  `).join('');
}

function renderTreatmentsSettings(){
  const list = document.getElementById('treatmentsSettingsList');
  if(!list) return;
  list.innerHTML = treatmentsCatalog.map(t => `
    <div class="settings-list__row">
      <div>${t.name}</div>
      <div>S/${t.price}</div>
      <div><span class="status-pill">${t.active ? 'Activo' : 'Inactivo'}</span></div>
      <div><button class="btn light" type="button" onclick="openCatalogModal('treatment', ${t.id})">Editar</button></div>
    </div>
  `).join('');
}

function renderProductsSettings(){
  const list = document.getElementById('productsSettingsList');
  if(!list) return;
  list.innerHTML = productsCatalog.map(p => `
    <div class="settings-list__row">
      <div>${p.name}</div>
      <div>S/${p.price}</div>
      <div><span class="status-pill">${p.active ? 'Activo' : 'Inactivo'}</span></div>
      <div><button class="btn light" type="button" onclick="openCatalogModal('product', ${p.id})">Editar</button></div>
    </div>
  `).join('');
}

function renderAttentionDiagnostics(){
  const box = document.getElementById('attentionDiagnosticChips');
  if(!box) return;
  box.innerHTML = diagnostics
    .filter(d => d.active)
    .map(d => `<button class="chip${['Piel mixta','Manchas'].includes(d.name) ? ' active' : ''}" type="button">${d.name}</button>`)
    .join('');
}

function renderAttentionCatalogs(){
  const tSelect = document.getElementById('attentionTreatmentSelect');
  const pSelect = document.getElementById('attentionProductSelect');
  const tPrice = document.getElementById('attentionTreatmentPrice');
  const pPrice = document.getElementById('attentionProductPrice');

  if(tSelect){
    const activeT = treatmentsCatalog.filter(t => t.active);
    tSelect.innerHTML = activeT.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    if(activeT.length && tPrice) tPrice.value = activeT[0].price;
    tSelect.onchange = function(){
      const selected = activeT.find(t => String(t.id) === this.value);
      if(selected && tPrice) tPrice.value = selected.price;
    };
  }

  if(pSelect){
    const activeP = productsCatalog.filter(p => p.active);
    pSelect.innerHTML = activeP.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    if(activeP.length && pPrice) pPrice.value = activeP[0].price;
    pSelect.onchange = function(){
      const selected = activeP.find(p => String(p.id) === this.value);
      if(selected && pPrice) pPrice.value = selected.price;
    };
  }
}

function renderGeneralSettings(){
  const branches = document.getElementById('branchesList');
  const payments = document.getElementById('paymentMethodsList');
  const statuses = document.getElementById('statusesList');
  const consentBox = document.getElementById('consentVersionBox');

  if(branches){
    branches.innerHTML = branchesCatalog.map((item, i) => `
      <div class="settings-mini-row">
        <span>${item}</span>
        <button class="btn btn-inline-edit" type="button" onclick="openSimpleListModal('branch', ${i})">Editar</button>
      </div>
    `).join('');
  }

  if(payments){
    payments.innerHTML = paymentMethodsCatalog.map((item, i) => `
      <div class="settings-mini-row">
        <span>${item}</span>
        <button class="btn btn-inline-edit" type="button" onclick="openSimpleListModal('payment', ${i})">Editar</button>
      </div>
    `).join('');
  }

  if(statuses){
    statuses.innerHTML = appointmentStatusesCatalog.map((item, i) => `
      <div class="settings-mini-row">
        <span>${item}</span>
        <button class="btn btn-inline-edit" type="button" onclick="openSimpleListModal('status', ${i})">Editar</button>
      </div>
    `).join('');
  }

  if(consentBox){
    consentBox.textContent = 'Versión actual: ' + consentVersion;
  }
}

function showGeneralSaved(){
  alert('Configuración general guardada correctamente.');
}

function openSimpleListModal(type, index = null){
  generalEditType = type;
  generalEditIndex = index;
  const cfg = {
    branch: { title: index === null ? 'Nueva sede' : 'Editar sede', label: 'SEDE', placeholder: 'Ej. Sede 3', source: branchesCatalog },
    payment: { title: index === null ? 'Nuevo medio de pago' : 'Editar medio de pago', label: 'MEDIO DE PAGO', placeholder: 'Ej. Transferencia', source: paymentMethodsCatalog },
    status: { title: index === null ? 'Nuevo estado de cita' : 'Editar estado de cita', label: 'ESTADO', placeholder: 'Ej. Reprogramada', source: appointmentStatusesCatalog }
  }[type];

  document.getElementById('generalModalTitle').textContent = cfg.title;
  document.getElementById('generalModalLabel').textContent = cfg.label;
  const input = document.getElementById('generalModalInput');
  input.placeholder = cfg.placeholder;
  input.value = index === null ? '' : (cfg.source[index] || '');
  document.getElementById('generalItemModal').classList.remove('hidden');
  setTimeout(() => input.focus(), 0);
}

function closeSimpleListModal(){
  document.getElementById('generalItemModal')?.classList.add('hidden');
}

function saveSimpleListItem(){
  const input = document.getElementById('generalModalInput');
  const value = String(input?.value || '').trim();
  if(!value){
    alert('Completa el dato.');
    input?.focus();
    return;
  }

  const source = {
    branch: branchesCatalog,
    payment: paymentMethodsCatalog,
    status: appointmentStatusesCatalog
  }[generalEditType];

  if(generalEditIndex === null || generalEditIndex === undefined){
    source.push(value);
  } else {
    source[generalEditIndex] = value;
  }

  renderGeneralSettings();
  closeSimpleListModal();
}

function openConsentModal(){
  document.getElementById('consentVersionInput').value = consentVersion;
  document.getElementById('consentTextInput').value = consentText;
  document.getElementById('consentModal').classList.remove('hidden');
}

function closeConsentModal(){
  document.getElementById('consentModal')?.classList.add('hidden');
}

function saveConsent(){
  const version = String(document.getElementById('consentVersionInput')?.value || '').trim();
  const text = String(document.getElementById('consentTextInput')?.value || '').trim();
  if(!version || !text){
    alert('Completa la versión y el texto del consentimiento.');
    return;
  }
  consentVersion = version;
  consentText = text;
  renderGeneralSettings();
  closeConsentModal();
}

function openCatalogModal(type, id = null){
  currentCatalogType = type;
  catalogEditId = id;
  const title = document.getElementById('catalogModalTitle');
  const eyebrow = document.getElementById('catalogModalEyebrow');
  const nameLabel = document.getElementById('catalogNameLabel');
  const field2Label = document.getElementById('catalogField2Label');
  const nameInput = document.getElementById('catalogName');
  const field2Input = document.getElementById('catalogField2');
  const statusInput = document.getElementById('catalogStatus');
  const modal = document.getElementById('catalogItemModal');

  const config = {
    diagnostic: { eyebrow: 'EVALUACIÓN', title: id ? 'Editar diagnóstico' : 'Nuevo diagnóstico', label1: 'DIAGNÓSTICO', label2: 'CATEGORÍA', placeholder1: 'Ej. Acné hormonal', placeholder2: 'Ej. Condición', source: diagnostics },
    treatment: { eyebrow: 'SERVICIOS', title: id ? 'Editar tratamiento' : 'Nuevo tratamiento', label1: 'TRATAMIENTO', label2: 'PRECIO', placeholder1: 'Ej. Dermaplaning', placeholder2: 'Ej. 120', source: treatmentsCatalog },
    product: { eyebrow: 'VENTA', title: id ? 'Editar producto' : 'Nuevo producto', label1: 'PRODUCTO', label2: 'PRECIO', placeholder1: 'Ej. Gel limpiador', placeholder2: 'Ej. 55', source: productsCatalog }
  }[type];

  eyebrow.textContent = config.eyebrow;
  title.textContent = config.title;
  nameLabel.textContent = config.label1;
  field2Label.textContent = config.label2;
  nameInput.placeholder = config.placeholder1;
  field2Input.placeholder = config.placeholder2;

  if(id){
    const item = config.source.find(x => x.id === id);
    nameInput.value = item?.name || '';
    field2Input.value = type === 'diagnostic' ? (item?.category || '') : (item?.price ?? '');
    statusInput.value = item?.active ? 'active' : 'inactive';
  } else {
    nameInput.value = '';
    field2Input.value = '';
    statusInput.value = 'active';
  }

  modal.classList.remove('hidden');
  setTimeout(() => nameInput.focus(), 0);
}

function closeCatalogModal(){
  document.getElementById('catalogItemModal')?.classList.add('hidden');
}

function saveCatalogItem(){
  const name = String(document.getElementById('catalogName')?.value || '').trim();
  const field2 = String(document.getElementById('catalogField2')?.value || '').trim();
  const active = document.getElementById('catalogStatus')?.value === 'active';

  if(!name){
    alert('Completa el nombre del registro.');
    document.getElementById('catalogName')?.focus();
    return;
  }

  if(currentCatalogType === 'diagnostic'){
    if(catalogEditId){
      const item = diagnostics.find(x => x.id === catalogEditId);
      if(item){
        item.name = name;
        item.category = field2 || 'General';
        item.active = active;
      }
    }else{
      diagnostics.push({
        id: diagnostics.length ? Math.max(...diagnostics.map(x => x.id)) + 1 : 1,
        name,
        category: field2 || 'General',
        active
      });
    }
    renderDiagnosticsSettings();
    renderAttentionDiagnostics();
  }

  if(currentCatalogType === 'treatment'){
    const price = Number(field2 || 0);
    if(!price){
      alert('Ingresa un precio válido para el tratamiento.');
      document.getElementById('catalogField2')?.focus();
      return;
    }
    if(catalogEditId){
      const item = treatmentsCatalog.find(x => x.id === catalogEditId);
      if(item){
        item.name = name;
        item.price = price;
        item.active = active;
      }
    }else{
      treatmentsCatalog.push({
        id: treatmentsCatalog.length ? Math.max(...treatmentsCatalog.map(x => x.id)) + 1 : 1,
        name,
        price,
        active
      });
    }
    renderTreatmentsSettings();
    renderAttentionCatalogs();
  }

  if(currentCatalogType === 'product'){
    const price = Number(field2 || 0);
    if(!price){
      alert('Ingresa un precio válido para el producto.');
      document.getElementById('catalogField2')?.focus();
      return;
    }
    if(catalogEditId){
      const item = productsCatalog.find(x => x.id === catalogEditId);
      if(item){
        item.name = name;
        item.price = price;
        item.active = active;
      }
    }else{
      productsCatalog.push({
        id: productsCatalog.length ? Math.max(...productsCatalog.map(x => x.id)) + 1 : 1,
        name,
        price,
        active
      });
    }
    renderProductsSettings();
    renderAttentionCatalogs();
  }

  catalogEditId = null;
  closeCatalogModal();
}

function openAddSpecialistModal(id = null){
  specialistEditId = id;
  const modal = document.getElementById('addSpecialistModal');
  if(!modal) return;
  const nameInput = document.getElementById('newSpecialistName');
  const specInput = document.getElementById('newSpecialistSpecialty');
  const statusInput = document.getElementById('newSpecialistStatus');
  const title = modal.querySelector('h3');

  if(id){
    const item = specialists.find(s => String(s.id) === String(id));
    title.textContent = 'Editar especialista';
    nameInput.value = item?.name || '';
    specInput.value = item?.specialty || '';
    statusInput.value = item?.active ? 'active' : 'inactive';
  }else{
    title.textContent = 'Nueva especialista';
    nameInput.value = '';
    specInput.value = '';
    statusInput.value = 'active';
  }

  modal.classList.remove('hidden');
  setTimeout(() => nameInput?.focus(), 0);
}

function closeAddSpecialistModal(){
  document.getElementById('addSpecialistModal')?.classList.add('hidden');
}

async function saveSpecialist(){
  const name = String(
    document.getElementById('newSpecialistName')?.value || ''
  ).trim();

  const specialty = String(
    document.getElementById('newSpecialistSpecialty')?.value || ''
  ).trim();

  const active =
    document.getElementById('newSpecialistStatus')?.value === 'active';

  if(!name){
    alert('Ingresa el nombre de la especialista.');
    document.getElementById('newSpecialistName')?.focus();
    return;
  }

  if(!specialty){
    alert('Ingresa la especialidad.');
    document.getElementById('newSpecialistSpecialty')?.focus();
    return;
  }

  const especialistaApi = {
    idEspecialista:
      specialistEditId
        ? String(specialistEditId)
        : '',

    nombre:
      name,

    especialidad:
      specialty,

    estado:
      active
        ? 'Activo'
        : 'Inactivo'
  };

  try{
    await enviarApi(
      'guardarEspecialista',
      {
        especialista:
          especialistaApi
      }
    );

    // Google Sheets es la fuente de verdad.
    // Se recarga el catálogo completo después de crear o editar.
    await cargarEspecialistasDesdeApi({
      force: true
    });

    specialistEditId = null;

    closeAddSpecialistModal();

    toast(
      especialistaApi.idEspecialista
        ? 'Especialista actualizado correctamente.'
        : 'Especialista registrado correctamente.'
    );

  }catch(error){
    console.error(
      'Error al guardar especialista:',
      error
    );

    toast(
      error.message ||
      'No se pudo guardar la especialista.'
    );
  }
}

function editSpecialist(id){
  openAddSpecialistModal(id);
}

renderTreatments();
renderProducts();
calcTotal();
updatePatient();
renderUpcomingBirthdays();
renderAppointmentSpecialists();
renderSpecialistsSettings();
renderDiagnosticsSettings();
renderTreatmentsSettings();
renderProductsSettings();
renderAttentionDiagnostics();
renderAttentionCatalogs();
renderGeneralSettings();
showAdmin('home');
goLanding();

cargarEspecialistasDesdeApi().catch(error => {
  console.warn(
    'No se pudieron precargar los especialistas:',
    error
  );
});

cargarPacientesDesdeApi().catch(error => {
  console.warn(
    'No se pudieron precargar los pacientes:',
    error
  );
});
