// --- IndexedDB ---
const db = new Dexie('JJBankAccountsDB');
db.version(2).stores({
  accounts: '++id, bank, description, holder, holder2, currentBalance, note, color, accountNumber, isValueAccount',
  returns: '++id, accountId, amount, date, returnType, note'
}).upgrade(tx => tx.accounts.toCollection().modify(acc => {
  if (acc.isValueAccount === undefined) acc.isValueAccount = false;
}));

// --- UTILS ---
const today = () => new Date().toISOString().split('T')[0];
const isDateValidAndNotFuture = d => d && new Date(d) <= new Date().setHours(23,59,59,999);
const formatDate = d => {
  const [y,m,day] = d.split('-');
  return `${day}-${m}-${y}`;
};
const formatCurrency = v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(v);
const formatNumber   = v => new Intl.NumberFormat('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
const formatIBAN = raw => raw ? raw.toUpperCase().replace(/\s/g,'').replace(/(.{4})/g,'$1 ').trim() : '';
const saveCustomOrder = arr => localStorage.setItem('accountOrder', JSON.stringify(arr));
const loadCustomOrder = () => JSON.parse(localStorage.getItem('accountOrder')||'[]');

// --- TOAST (reutilizable) ---
let toastEl;
function showToast(msg){
  if(toastEl) { toastEl.textContent=msg; toastEl.style.opacity=1; }
  else {
    toastEl=document.createElement('div'); toastEl.id='toast-notification';
    document.body.appendChild(toastEl);
  }
  Object.assign(toastEl.style,{
    position:'fixed',bottom:'20px',left:'50%',transform:'translateX(-50%)',
    background:'var(--toast-bg)',color:'white',padding:'14px 22px',borderRadius:'10px',
    fontWeight:'bold',fontSize:'1.05rem',boxShadow:'0 4px 12px rgba(0,0,0,.2)',
    zIndex:'10000',maxWidth:'90%',textAlign:'center',pointerEvents:'none',whiteSpace:'nowrap'
  });
  clearTimeout(toastEl._t);
  toastEl._t=setTimeout(()=>toastEl.style.opacity='0',3000);
}

// --- CONFIRM (no oculta modal principal) ---
function showConfirm(msg,onOk){
  const overlay=document.createElement('div'); overlay.className='modal-overlay';
  overlay.innerHTML=`
    <div class="modal-content" style="max-width:350px">
      <div class="modal-body" style="text-align:center;padding:24px">
        <p>${msg}</p>
        <div class="modal-actions" style="margin-top:20px;justify-content:center">
          <button id="cfNo" class="btn-delete">No</button>
          <button id="cfYes" class="btn-primary">Sí</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay); overlay.style.display='flex';
  overlay.querySelector('#cfYes').onclick=()=>{overlay.remove(); onOk();};
  overlay.querySelector('#cfNo').onclick=()=>overlay.remove();
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
}

// --- MODAL GENÉRICO ---
function openModal(title,content){
  let overlay=document.getElementById('modalOverlay');
  if(!overlay){
    overlay=document.createElement('div'); overlay.id='modalOverlay'; overlay.className='modal-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML=`
    <div class="modal-content">
      <div class="modal-header"><h3>${title}</h3><button class="close-modal" aria-label="Cerrar">&times;</button></div>
      <div class="modal-body">${content}</div>
    </div>`;
  overlay.style.display='flex';
  overlay.querySelector('.close-modal').onclick=()=>overlay.style.display='none';
  overlay.onclick=e=>{if(e.target===overlay)overlay.style.display='none';};
}

// --- LISTAR CUENTAS (MODAL) ---
async function showAccountList(){
  const accounts=await db.accounts.toArray();
  if(!accounts.length){openModal('Cuentas','<p>No hay cuentas. Añade una desde el menú.</p>');return;}
  let html='<h3>Cuentas</h3>';
  accounts.forEach(acc=>{
    const border=acc.isValueAccount&&acc.color?`border:2px solid ${acc.color}`:acc.color?`border-left:4px solid ${acc.color}`:'';
    const num=acc.accountNumber?acc.isValueAccount?acc.accountNumber.toUpperCase():formatIBAN(acc.accountNumber):'';
    html+=`
      <div class="asset-item ${acc.isValueAccount?'value-account':''}" style="${border}">
        <strong style="${acc.color?`color:${acc.color}`:''}">${acc.bank}</strong> ${acc.description?`(${acc.description})`:''}<br>
        ${num?`Nº: ${num}<button class="btn-copy" data-number="${acc.accountNumber}" aria-label="Copiar">📋</button><br>`:''}
        Titular: ${acc.holder}${acc.holder2?` / ${acc.holder2}`:''}<br>
        Saldo: ${formatCurrency(acc.currentBalance)}<br>
        ${acc.isValueAccount?'<small>Cuenta de Valores</small><br>':''}
        ${acc.note?`<small>Nota: ${acc.note}</small>`:''}
        <div class="modal-actions">
          <button class="btn-edit" data-id="${acc.id}" aria-label="Editar">Editar</button>
          <button class="btn-delete" data-id="${acc.id}" aria-label="Eliminar">Eliminar</button>
        </div>
      </div>`;
  });
  openModal('Cuentas',html);
  const body=document.querySelector('#modalOverlay .modal-body');
  body.onclick=async e=>{
    if(e.target.classList.contains('btn-delete')){
      const id=parseInt(e.target.dataset.id);
      showConfirm('¿Eliminar esta cuenta?',async()=>{await db.accounts.delete(id);showAccountList();});
    }
    if(e.target.classList.contains('btn-edit')){
      const acc=await db.accounts.get(parseInt(e.target.dataset.id));
      if(acc)openEditAccountForm(acc);
    }
    if(e.target.classList.contains('btn-copy')){
      const n=e.target.dataset.number;
      navigator.clipboard.writeText(n).then(()=>showToast('✅ Copiado'));
    }
  };
}

// --- RENDER RESUMEN ---
async function renderAccountsSummary(){
  const totals=document.getElementById('summary-totals');
  const container=document.getElementById('summary-by-bank');
  if(!totals||!container)return;
  try{
    const accounts=await db.accounts.toArray();
    if(!accounts.length){totals.innerHTML='<p>No hay cuentas. Añade una desde el menú.</p>';container.innerHTML='';return;}

    const customOrder=loadCustomOrder();
    const ordered=[...accounts].sort((a,b)=>{
      const ai=customOrder.indexOf(a.id),bi=customOrder.indexOf(b.id);
      if(ai===-1&&bi===-1)return 0;if(ai===-1)return 1;if(bi===-1)return -1;
      return ai-bi;
    });

    let sumAcc=0,sumVal=0;
    accounts.forEach(a=>a.isValueAccount?sumVal+=a.currentBalance||0:sumAcc+=a.currentBalance||0);
    totals.innerHTML=`
      <div class="summary-card">
        <div class="dividend-line"><strong>Saldo (Cuentas):</strong> <strong>${formatCurrency(sumAcc)}</strong></div>
        <div class="dividend-line"><strong>Saldo (Valores):</strong> <strong>${formatCurrency(sumVal)}</strong></div>
        <hr style="border:none;border-top:1px solid var(--border-color);margin:8px 0;">
        <div class="dividend-line"><strong>Total:</strong> <strong>${formatCurrency(sumAcc+sumVal)}</strong></div>
      </div>`;

    const returns=await db.returns.toArray();
    let html='';

    const divs=returns.filter(r=>r.returnType==='dividend');
    const ints=returns.filter(r=>r.returnType==='interest');

    if(divs.length){
      const byYear={};
      divs.forEach(r=>{const y=new Date(r.date).getFullYear();byYear[y]=(byYear[y]||0)+r.amount;});
      html+=`<div class="summary-card returns-section"><div class="group-title">Dividendos</div>
        <div class="dividend-line"><strong>Total:</strong> <strong>${formatCurrency(divs.reduce((s,r)=>s+r.amount,0))}</strong></div>`;
      if(Object.keys(byYear).length){
        html+=`<div class="dividends-by-year">`;
        Object.keys(byYear).sort((a,b)=>b-a).forEach(y=>html+=`<div class="dividend-line"><strong>${y}:</strong> <strong>${formatCurrency(byYear[y])}</strong></div>`);
        html+=`</div>`;
      }
      html+=`<div style="display:flex;align-items:center;gap:10px;margin-top:12px">
        <button id="toggleDividendosDetail" class="btn-primary" style="padding:10px;font-size:.95rem;width:auto">Ver detalle</button>
        <select id="filterYearDividendos" class="year-filter"><option value="">Todos</option>${[...new Set(divs.map(r=>new Date(r.date).getFullYear()))].sort((a,b)=>b-a).map(y=>`<option value="${y}">${y}</option>`).join('')}</select>
      </div><div id="DividendosDetail" style="display:none;margin-top:12px"><div id="filteredDetailDividendos"></div></div></div>`;
    }

    if(ints.length){
      const byYear={};
      ints.forEach(r=>{const y=new Date(r.date).getFullYear();byYear[y]=(byYear[y]||0)+r.amount;});
      html+=`<div class="summary-card returns-section"><div class="group-title">Intereses</div>
        <div class="dividend-line"><strong>Total:</strong> <strong>${formatCurrency(ints.reduce((s,r)=>s+r.amount,0))}</strong></div>`;
      if(Object.keys(byYear).length){
        html+=`<div class="dividends-by-year">`;
        Object.keys(byYear).sort((a,b)=>b-a).forEach(y=>html+=`<div class="dividend-line"><strong>${y}:</strong> <strong>${formatCurrency(byYear[y])}</strong></div>`);
        html+=`</div>`;
      }
      html+=`<div style="display:flex;align-items:center;gap:10px;margin-top:12px">
        <button id="toggleInteresesDetail" class="btn-primary" style="padding:10px;font-size:.95rem;width:auto">Ver detalle</button>
        <select id="filterYearIntereses" class="year-filter"><option value="">Todos</option>${[...new Set(ints.map(r=>new Date(r.date).getFullYear()))].sort((a,b)=>b-a).map(y=>`<option value="${y}">${y}</option>`).join('')}</select>
      </div><div id="InteresesDetail" style="display:none;margin-top:12px"><div id="filteredDetailIntereses"></div></div></div>`;
    }

    html+=`<div class="summary-card accounts-section"><div class="group-title">Cuentas</div><div id="account-list" class="account-list">`;
    ordered.forEach(acc=>{
      const holderLine=acc.holder2?`${acc.holder}<span style="font-size:1rem"> / ${acc.holder2}</span>`:acc.holder;
      const colorStyle=acc.color?`color:${acc.color}`:'';
      const borderStyle=acc.isValueAccount&&acc.color?`border:2px solid ${acc.color}`:acc.color?`border-left:4px solid ${acc.color}`:'';
      const num=acc.accountNumber?acc.isValueAccount?acc.accountNumber.toUpperCase():formatIBAN(acc.accountNumber):'';
      html+=`<div class="asset-item ${acc.isValueAccount?'value-account':''}" style="${borderStyle}" data-id="${acc.id}" draggable="true">
        <strong style="${colorStyle}">${acc.bank}</strong> ${acc.description?`(${acc.description})`:''}<br>
        ${num?`Nº: ${num}<button class="btn-copy" data-number="${acc.accountNumber}" aria-label="Copiar">📋</button><br>`:''}
        Titular: ${holderLine}<br>Saldo: ${formatCurrency(acc.currentBalance)}<br>
        ${acc.isValueAccount?'<small>Cuenta de Valores</small><br>':''}
        ${acc.note?`<small>Nota: ${acc.note}</small>`:''}
      </div>`;
    });
    html+=`</div></div>`;
    container.innerHTML=html;

    // drag & drop
    const list=document.getElementById('account-list');
    if(list){
      list.addEventListener('dragstart',e=>{if(e.target.classList.contains('asset-item')){e.target.classList.add('dragging');e.dataTransfer.setData('text/plain',e.target.dataset.id);}});
      list.addEventListener('dragover',e=>e.preventDefault());
      list.addEventListener('drop',e=>{
        e.preventDefault();const dragging=document.querySelector('.dragging'),target=e.target.closest('.asset-item');
        if(target&&target!==dragging){const rect=target.getBoundingClientRect(),next=rect.y+rect.height/2<e.clientY?target.nextSibling:target;list.insertBefore(dragging,next);saveCustomOrder(Array.from(list.children).map(el=>parseInt(el.dataset.id)));}
      });
      list.addEventListener('dragend',e=>e.target.classList.remove('dragging'));
    }

    // toggles y filtros
    const toggle=(btnId,detailId,filterId,arr)=>{
      const btn=document.getElementById(btnId),detail=document.getElementById(detailId),filter=document.getElementById(filterId);
      if(!btn||!detail)return;
      btn.onclick=()=>{const v=detail.style.display==='block';detail.style.display=v?'none':'block';btn.textContent=v?'Ver detalle':'Ocultar detalle';if(!v)updateDetail(filterId,detailId,arr);};
      if(filter)filter.onchange=()=>updateDetail(filterId,detailId,arr);
    };
    const updateDetail=(selId,divId,arr)=>{
      const y=document.getElementById(selId).value,div=document.getElementById(divId),map={};
      ordered.forEach(a=>map[a.id]=a);
      const filt=y?arr.filter(r=>new Date(r.date).getFullYear().toString()===y):arr;
      const byAcc={};
      filt.forEach(r=>byAcc[r.accountId]=(byAcc[r.accountId]||0)+r.amount);
      div.innerHTML=Object.entries(byAcc).map(([id,amt])=>{
        const a=map[id];if(!a)return'';return`<div class="dividend-line"><strong>${a.bank}${a.description?` (${a.description})`:''}:</strong> ${formatCurrency(amt)}</div>`;
      }).join('');
    };
    toggle('toggleDividendosDetail','DividendosDetail','filterYearDividendos',divs);
    toggle('toggleInteresesDetail','InteresesDetail','filterYearIntereses',ints);

    // copy buttons
    container.querySelectorAll('.btn-copy').forEach(btn=>btn.onclick=e=>{navigator.clipboard.writeText(e.target.dataset.number).then(()=>showToast('✅ Copiado'));});

  }catch(err){console.error(err);totals.innerHTML='<p style="color:red">Error al cargar cuentas.</p>';}
}

document.addEventListener('DOMContentLoaded',()=>db.open().catch(()=>showToast('Error DB')).then(()=>renderAccountsSummary));
// --- FORMULARIOS DE RENDIMIENTOS ---
// --- FUNCIÓN RECUPERADA Y ACTUALIZADA ---
async function showAddReturnForm() {
  const accounts = await db.accounts.toArray();
  if (accounts.length === 0) {
    showToast('Añade una cuenta primero.');
    return;
  }
  const options = accounts.map(a => {
    const display = a.bank + (a.description ? ` (${a.description})` : '');
    return `<option value="${a.id}">${display}</option>`;
  }).join('');
  const form = `
    <div class="form-group">
      <label>Cuenta:</label>
      <select id="returnAccount">${options}</select>
    </div>
    <div class="form-group">
      <label>Tipo de rendimiento:</label>
      <select id="returnType">
        <option value="interest">Interés</option>
        <option value="dividend">Dividendo</option>
      </select>
    </div>
    <div class="form-group">
      <label>Importe (€):</label>
      <input type="text" id="returnAmount" placeholder="0,00" required />
    </div>
    <div class="form-group">
      <label>Fecha:</label>
      <input type="date" id="returnDate" value="${today()}" required />
    </div>
    <div class="form-group">
      <label>Nota (opcional):</label>
      <input type="text" id="returnNote" placeholder="Ej: Dividendo BBVA, Interés trimestral..." />
    </div>
    <button id="btnSaveReturn" class="btn-primary">Añadir Rendimiento</button>
  `;
  openModal('Añadir Rendimiento', form);

  // Lógica para el input de importe (sin formateo visual)
  const amountInput = document.getElementById('returnAmount');
  amountInput.addEventListener('input', (e) => {
    // Permitir solo números, comas y puntos
    let value = e.target.value.replace(/[^\d,.]/g, '');
    // Si tiene más de una coma, dejar solo la primera
    const parts = value.split(',');
    if (parts.length > 2) {
      value = parts[0] + ',' + parts.slice(1).join('');
    }
    // Formatear visualmente (opcional, pero no cambiar el valor real)
    const [integer, decimal] = value.split(',');
    if (integer) {
      const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      value = decimal ? formattedInteger + ',' + decimal : formattedInteger;
    }
    // No cambiamos el valor del input, solo lo mostramos formateado
    e.target.value = value;
  });

  document.getElementById('btnSaveReturn').onclick = async () => {
    let amountStr = amountInput.value.trim();
    if (amountStr === '') {
      showToast('El importe no puede estar vacío.');
      return;
    }
    // Convertir de nuevo a número con coma como decimal
    amountStr = amountStr.replace(/\./g, '').replace(',', '.');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      showToast('Importe inválido.');
      return;
    }
    const accountId = parseInt(document.getElementById('returnAccount').value);
    const returnType = document.getElementById('returnType').value;
    const date = document.getElementById('returnDate').value;
    const note = document.getElementById('returnNote').value.trim() || null;

    if (!isDateValidAndNotFuture(date)) {
      showToast('La fecha no puede ser futura.');
      return;
    }

    await db.returns.add({ accountId, amount, date, returnType, note });
    document.getElementById('modalOverlay').style.display = 'none';
    renderAccountsSummary();
    showToast('✅ Rendimiento añadido correctamente.');
  };
}

// --- FUNCIÓN RECUPERADA Y ACTUALIZADA ---
async function showReturnsList() {
  const returns = await db.returns.reverse().toArray();
  const accounts = await db.accounts.toArray();
  const accMap = {};
  accounts.forEach(a => accMap[a.id] = a);
  if (returns.length === 0) {
    openModal('Rendimientos', '<p>No hay rendimientos.</p>');
    return;
  }
  let html = '<h3>Rendimientos</h3>';
  returns.forEach(r => {
    const acc = accMap[r.accountId];
    const displayName = acc ? `${acc.bank}${acc.description ? ` (${acc.description})` : ''}` : 'Cuenta eliminada';
    const typeLabel = r.returnType === 'dividend' ? 'Dividendo' : 'Interés';
    html += `
      <div class="asset-item">
        <strong>${displayName}</strong><br>
        ${typeLabel}: ${formatCurrency(r.amount)} el ${formatDate(r.date)}${r.note ? ` - ${r.note}` : ''}
        <div class="modal-actions">
          <button class="btn-edit" data-id="${r.id}">Editar</button>
          <button class="btn-delete" data-id="${r.id}">Eliminar</button>
        </div>
      </div>
    `;
  });
  openModal('Rendimientos', html);
  document.querySelector('#modalOverlay .modal-body').onclick = async (e) => {
    if (e.target.classList.contains('btn-delete')) {
      const id = parseInt(e.target.dataset.id);
      showConfirm('¿Eliminar este rendimiento?', async () => {
        await db.returns.delete(id);
        showReturnsList();
      });
    }
    if (e.target.classList.contains('btn-edit')) {
      const id = parseInt(e.target.dataset.id);
      const ret = await db.returns.get(id);
      if (!ret) return;
      const accounts = await db.accounts.toArray();
      const options = accounts.map(a => {
        const display = a.bank + (a.description ? ` (${a.description})` : '');
        return `<option value="${a.id}" ${a.id === ret.accountId ? 'selected' : ''}>${display}</option>`;
      }).join('');
      // Formatear importe para mostrarlo en el input
      const formattedAmount = formatNumber(ret.amount);

      const form = `
        <div class="form-group">
          <label>Cuenta:</label>
          <select id="editReturnAccount">${options}</select>
        </div>
        <div class="form-group">
          <label>Tipo:</label>
          <select id="editReturnType">
            <option value="interest" ${ret.returnType === 'interest' ? 'selected' : ''}>Interés</option>
            <option value="dividend" ${ret.returnType === 'dividend' ? 'selected' : ''}>Dividendo</option>
          </select>
        </div>
        <div class="form-group">
          <label>Importe (€):</label>
          <input type="text" id="editReturnAmount" value="${formattedAmount}" required />
        </div>
        <div class="form-group">
          <label>Fecha:</label>
          <input type="date" id="editReturnDate" value="${ret.date}" required />
        </div>
        <div class="form-group">
          <label>Nota:</label>
          <input type="text" id="editReturnNote" value="${ret.note || ''}" />
        </div>
        <button id="btnUpdateReturn" class="btn-primary">Guardar</button>
      `;
      openModal('Editar Rendimiento', form);

      // Lógica para el input de importe con formato en edición
      const editAmountInput = document.getElementById('editReturnAmount');
      editAmountInput.addEventListener('input', (e) => {
        // Permitir solo números, comas y puntos
        let value = e.target.value.replace(/[^\d,.]/g, '');
        // Si tiene más de una coma, dejar solo la primera
        const parts = value.split(',');
        if (parts.length > 2) {
          value = parts[0] + ',' + parts.slice(1).join('');
        }
        // Formatear visualmente (opcional, pero no cambiar el valor real)
        const [integer, decimal] = value.split(',');
        if (integer) {
          const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
          value = decimal ? formattedInteger + ',' + decimal : formattedInteger;
        }
        // No cambiamos el valor del input, solo lo mostramos formateado
        e.target.value = value;
      });

      document.getElementById('btnUpdateReturn').onclick = async () => {
        let amountStr = editAmountInput.value.trim();
        if (amountStr === '') {
          showToast('El importe no puede estar vacío.');
          return;
        }
        // Convertir de nuevo a número con coma como decimal
        amountStr = amountStr.replace(/\./g, '').replace(',', '.');
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
          showToast('Importe inválido.');
          return;
        }
        const accountId = parseInt(document.getElementById('editReturnAccount').value);
        const returnType = document.getElementById('editReturnType').value;
        const date = document.getElementById('editReturnDate').value;
        const note = document.getElementById('editReturnNote').value.trim() || null;
        if (!isDateValidAndNotFuture(date)) {
          showToast('Fecha inválida.');
          return;
        }
        await db.returns.update(id, { accountId, amount, date, returnType, note });
        document.getElementById('modalOverlay').style.display = 'none';
        showReturnsList();
      };
    }
  };
}
// --- TEMA ---
function getCurrentTheme() {
  return localStorage.getItem('theme') || 'light';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#1a1a1a' : '#1a73e8');
}

// --- MENÚ DRAWER ---
function initMenu() {
  function openDrawer() {
    let drawer = document.getElementById('mainDrawer');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'mainDrawer';
      drawer.className = 'main-drawer';
      const currentTheme = getCurrentTheme();
      const themeLabel = currentTheme === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro';
      drawer.innerHTML = `
        <div class="drawer-content">
          <div class="drawer-header">
            <h3>Menú</h3>
            <button class="close-drawer">&times;</button>
          </div>
          <ul class="drawer-menu">
            <li><button data-action="add-account"><span>➕ Añadir Cuenta</span></button></li>
            <li><button data-action="view-accounts"><span>🏦 Cuentas</span></button></li>
            <li><button data-action="add-return"><span>💰 Añadir Rendimiento</span></button></li>
            <li><button data-action="view-returns"><span>📊 Rendimientos</span></button></li>
            <li><button data-action="import-export"><span>📤 Exportar / Importar</span></button></li>
            <li><button data-action="theme-toggle"><span>${themeLabel}</span></button></li>
            <li><button data-action="help"><span>ℹ️ Ayuda</span></button></li>
          </ul>
        </div>
      `;
      document.body.appendChild(drawer);
      drawer.querySelector('.close-drawer').onclick = () => drawer.style.display = 'none';
      drawer.onclick = (e) => { if (e.target === drawer) drawer.style.display = 'none'; };
      drawer.querySelectorAll('[data-action]').forEach(btn => {
        btn.onclick = () => {
          drawer.style.display = 'none';
          const a = btn.dataset.action;
          if (a === 'add-account') showAddAccountForm();
          else if (a === 'view-accounts') showAccountList();
          else if (a === 'add-return') showAddReturnForm();
          else if (a === 'view-returns') showReturnsList();
          else if (a === 'import-export') showImportExport();
          else if (a === 'theme-toggle') {
            const newTheme = getCurrentTheme() === 'light' ? 'dark' : 'light';
            setTheme(newTheme);
            initMenu(); // Actualiza el texto del botón
          }
          else if (a === 'help') showHelp();
        };
      });
    }
    drawer.style.display = 'flex';
  }
  document.getElementById('menuToggle')?.addEventListener('click', openDrawer);
}

// --- IMPORT/EXPORT ---
function showImportExport() {
  const content = `
    <h3>Exportar / Importar Datos</h3>
    <p class="modal-section"><button id="btnExport" class="btn-primary">Exportar a JSON</button></p>
    <p class="modal-section"><button id="btnImport" class="btn-primary">Importar desde JSON</button></p>
    <p class="modal-note">⚠️ Importar reemplazará todos tus datos actuales.</p>
  `;
  openModal('Exportar / Importar', content);
  document.getElementById('btnExport').onclick = async () => {
    const accounts = await db.accounts.toArray();
    const returns = await db.returns.toArray();
    const data = { accounts, returns };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jj-bank-accounts-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    document.getElementById('modalOverlay').style.display = 'none';
  };
  document.getElementById('btnImport').onclick = async () => {
    showConfirm('⚠️ Esto borrará todos tus datos actuales. ¿Continuar?', async () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          await db.transaction('rw', db.accounts, db.returns, async () => {
            await db.accounts.clear();
            await db.returns.clear();
            if (Array.isArray(data.accounts)) await db.accounts.bulkAdd(data.accounts);
            if (Array.isArray(data.returns)) await db.returns.bulkAdd(data.returns);
          });
          document.getElementById('modalOverlay').style.display = 'none';
          renderAccountsSummary();
          showToast('✅ Datos importados correctamente.');
        } catch (err) {
          console.error('Error en importación:', err);
          showToast('❌ Error: archivo no válido.');
        } finally {
          if (input.parentNode) input.parentNode.removeChild(input);
        }
      };
      document.body.appendChild(input);
      input.click();
    });
  };
}

// --- AYUDA ---
function showHelp() {
  const content = `
    <h3>Ayuda - JJ Bank Accounts</h3>
    <p><strong>Versión: 1.0</strong></p>
    <p>Aplicación PWA para gestionar tus cuentas bancarias y sus rendimientos.</p>
    <h4>✅ Funcionalidades</h4>
    <ul>
      <li>🏦 Gestión de cuentas (titular, saldo, entidad, número)</li>
      <li>🏷️ Identificación de cuentas de valores</li>
      <li>🎨 Asignación de color a tarjetas</li>
      <li>🔄 Reordenar cuentas con arrastrar y soltar</li>
      <li>💰 Registro de rendimientos: intereses y dividendos</li>
      <li>📊 Rendimientos con desglose anual visible</li>
      <li>📊 Dividendos mostrados en bruto</li>
      <li>📊 Separación de saldos: Cuentas y Valores</li>
      <li>🔄 Sin movimientos: solo rendimientos con fecha</li>
      <li>📤 Exportar a JSON</li>
      <li>🌙 Tema claro/oscuro</li>
    </ul>
    <h4>🔒 Privacidad</h4>
    <p>Tus datos <strong>se guardan solo en tu dispositivo</strong>.</p>
  `;
  openModal('Ayuda', content);
}

// --- INICIO (actualizado para usar funciones de Parte 3) ---
document.addEventListener('DOMContentLoaded', () => {
  db.open().catch(err => {
    console.error('IndexedDB error:', err);
    const el = document.getElementById('summary-totals');
    if (el) el.innerHTML = '<p style="color:red">Error de base de datos.</p>';
  }).then(() => {
    renderAccountsSummary();
  });
  setTheme(getCurrentTheme()); // Llamada a la función en Parte 3
  initMenu(); // Llamada a la función en Parte 3
});
