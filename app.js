// --- IndexedDB ---
const db = new Dexie('JJBankAccountsDB');
db.version(2).stores({ // Versión actualizada para añadir isValueAccount
  accounts: '++id, bank, description, holder, holder2, currentBalance, note, color, accountNumber, isValueAccount',
  returns: '++id, accountId, amount, date, returnType, note'
}).upgrade(tx => {
  // Migrar cuentas antiguas: añadir isValueAccount como false
  return tx.accounts.toCollection().modify(acc => {
    if (acc.isValueAccount === undefined) {
      acc.isValueAccount = false;
    }
  });
});

// --- UTILIDADES ---
function today() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function isDateValidAndNotFuture(dateString) {
  if (!dateString) return false;
  const inputDate = new Date(dateString);
  const todayStart = new Date();
  todayStart.setHours(23, 59, 59, 999); // Fin del día de hoy
  return inputDate <= todayStart;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(value);
}

function formatNumber(value) {
  // Cambio aquí: formato numérico con punto para miles y coma para decimales
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(value).replace(/\./g, '#TEMP_DOT#').replace(',', '.').replace(/#TEMP_DOT#/g, ',');
}

// --- FORMATO IBAN ---
function formatIBAN(input) {
  if (!input) return '';
  const cleaned = input.toUpperCase().replace(/\s/g, '');
  if (cleaned.length < 4) return cleaned;
  let formatted = cleaned.substring(0, 4);
  for (let i = 4; i < cleaned.length; i += 4) {
    formatted += ' ' + cleaned.substring(i, i + 4);
  }
  return formatted;
}

// --- ORDEN CUSTOM ---
function saveCustomOrder(symbolList) {
  localStorage.setItem('accountOrder', JSON.stringify(symbolList));
}

function loadCustomOrder() {
  return JSON.parse(localStorage.getItem('accountOrder') || '[]');
}

function showToast(message) {
  const existing = document.getElementById('toast-notification');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--toast-bg);
    color: white;
    padding: 14px 22px;
    border-radius: 10px;
    font-weight: bold;
    font-size: 1.05rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    max-width: 90%;
    text-align: center;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 500);
  }, 3000);
}

function showConfirm(message, onConfirm) {
  const mainOverlay = document.getElementById('modalOverlay');
  if (mainOverlay) mainOverlay.style.display = 'none';
  const overlay = document.createElement('div');
  overlay.id = 'confirmOverlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width: 350px;">
      <div class="modal-body" style="text-align: center; padding: 24px;">
        <p>${message}</p>
        <div class="modal-actions" style="margin-top: 20px; justify-content: center;">
          <button id="confirmNo" class="btn-delete" style="width: auto; padding: 10px 16px;">No</button>
          <button id="confirmYes" class="btn-primary" style="width: auto; padding: 10px 16px; margin-left: 8px;">Sí</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.style.display = 'flex';
  const btnYes = document.getElementById('confirmYes');
  const btnNo = document.getElementById('confirmNo');
  const cleanup = () => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };
  btnYes.onclick = () => {
    cleanup();
    onConfirm();
  };
  btnNo.onclick = cleanup;
  overlay.onclick = (e) => {
    if (e.target === overlay) cleanup();
  };
}

function openModal(title, content) {
  let overlay = document.getElementById('modalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modalOverlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="close-modal">&times;</button>
      </div>
      <div class="modal-body">${content}</div>
    </div>
  `;
  overlay.style.display = 'flex';
  document.querySelector('.close-modal').onclick = () => overlay.style.display = 'none';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };
}

// --- RENDER RESUMEN ---
async function renderAccountsSummary() {
  const summaryTotals = document.getElementById('summary-totals');
  const summaryContainer = document.getElementById('summary-by-bank');
  if (!summaryTotals || !summaryContainer) return;

  try {
    const accounts = await db.accounts.toArray();
    if (accounts.length === 0) {
      summaryTotals.innerHTML = '<p>No hay cuentas. Añade una desde el menú.</p>';
      summaryContainer.innerHTML = '';
      return;
    }

    // Cargar orden personalizado
    const customOrder = loadCustomOrder();
    const orderedAccounts = [...accounts].sort((a, b) => {
      const aIndex = customOrder.indexOf(a.id);
      const bIndex = customOrder.indexOf(b.id);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    // Calcular totales
    let totalBalanceAccounts = 0;
    let totalBalanceValues = 0;
    for (const acc of accounts) {
      if (acc.isValueAccount) {
        totalBalanceValues += acc.currentBalance || 0;
      } else {
        totalBalanceAccounts += acc.currentBalance || 0;
      }
    }

    summaryTotals.innerHTML = `
      <div class="summary-card">
        <div class="dividend-line"><strong>Saldo (Cuentas):</strong> <strong>${formatCurrency(totalBalanceAccounts)}</strong></div>
        <div class="dividend-line"><strong>Saldo (Valores):</strong> <strong>${formatCurrency(totalBalanceValues)}</strong></div>
        <hr style="border: none; border-top: 1px solid var(--border-color); margin: 8px 0;">
        <div class="dividend-line"><strong>Total:</strong> <strong>${formatCurrency(totalBalanceAccounts + totalBalanceValues)}</strong></div>
      </div>
    `;

    const returns = await db.returns.toArray();
    let fullHtml = '';

    if (returns.length > 0) {
      const dividends = returns.filter(r => r.returnType === 'dividend');
      const interests = returns.filter(r => r.returnType === 'interest');

      const processType = (list, title, isDividend = false) => {
        if (list.length === 0) return '';
        let totalBruto = list.reduce((sum, r) => sum + r.amount, 0);
        let html = `<div class="summary-card returns-section"><div class="group-title">${title}</div>`;
        html += `<div class="dividend-line"><strong>Total:</strong> <strong>${formatCurrency(totalBruto)}`;
        if (isDividend) {
          // No se muestra neto
        }
        html += `</strong></div>`;

        // Por año (siempre visible)
        const byYear = {};
        for (const r of list) {
          const year = new Date(r.date).getFullYear();
          if (!byYear[year]) byYear[year] = 0;
          byYear[year] += r.amount;
        }
        if (Object.keys(byYear).length > 0) { // Mostrar siempre si hay años
          html += `<div class="dividends-by-year">`;
          const sortedYears = Object.keys(byYear).sort((a, b) => b - a);
          for (const year of sortedYears) {
            const bruto = byYear[year];
            html += `<div class="dividend-line"><strong>${year}:</strong> <strong>${formatCurrency(bruto)}`;
            if (isDividend) {
              // No se muestra neto
            }
            html += `</strong></div>`;
          }
          html += `</div>`;
        }

        // Botón detalle con filtro por año
        html += `
          <button id="toggle${title.replace(/\s+/g, '')}Detail" class="btn-primary" style="margin-top:12px; padding:10px; font-size:0.95rem; width:auto;">
            Ver detalle
          </button>
          <div id="${title.replace(/\s+/g, '')}Detail" style="display:none; margin-top:12px;">
            <label for="filterYear${title.replace(/\s+/g, '')}">Filtrar por año:</label>
            <select id="filterYear${title.replace(/\s+/g, '')}" class="year-filter" style="margin-bottom: 10px;">
              <option value="">Todos los años</option>
        `;
        const allYears = [...new Set(list.map(r => new Date(r.date).getFullYear()))].sort((a, b) => b - a);
        for (const year of allYears) {
            html += `<option value="${year}">${year}</option>`;
        }
        html += `
            </select>
            <div id="filteredDetail${title.replace(/\s+/g, '')}"></div>
          </div>
        `;
        return html;
      };

      fullHtml += processType(dividends, 'Dividendos', true); // Cambiado aquí
      fullHtml += processType(interests, 'Intereses', false); // Cambiado aquí
    }

    // --- LISTADO DE CUENTAS ---
    fullHtml += `<div class="group-title">Cuentas</div>`;
    fullHtml += `<div id="account-list" class="account-list">`; // Contenedor para drag & drop
    for (const acc of orderedAccounts) {
      const holderLine = acc.holder2 ? `${acc.holder}<span style="font-size: 1rem;"> / ${acc.holder2}</span>` : acc.holder; // Titular 2 mismo tamaño
      const colorStyle = acc.color ? `color: ${acc.color};` : ''; // Color en el texto principal
      const borderColorStyle = acc.color ? `border-left: 4px solid ${acc.color};` : '';
      const isValueAccountClass = acc.isValueAccount ? ' value-account' : ''; // Clase para borde completo
      const accountNumberDisplay = acc.accountNumber ? (acc.isValueAccount ? acc.accountNumber.toUpperCase() : formatIBAN(acc.accountNumber)) : '';
      fullHtml += `
        <div class="asset-item${isValueAccountClass}" style="${borderColorStyle}" data-id="${acc.id}" draggable="true">
          <strong style="${colorStyle}">${acc.bank}</strong> ${acc.description ? `(${acc.description})` : ''}<br>
          ${accountNumberDisplay ? `Nº: ${accountNumberDisplay} <button class="btn-copy" data-number="${acc.accountNumber}" style="margin-left:8px; padding:2px 6px; font-size:0.8rem;">📋</button><br>` : ''}
          Titular: ${holderLine}<br>
          Saldo: ${formatCurrency(acc.currentBalance)}<br>
          ${acc.note ? `<small>Nota: ${acc.note}</small>` : ''}
        </div>
      `;
    }
    fullHtml += `</div>`;

    summaryContainer.innerHTML = fullHtml;

    // --- LÓGICA DE DRAG & DROP ---
    const list = document.getElementById('account-list');
    if (list) {
      list.addEventListener('dragstart', e => {
        if (e.target.classList.contains('asset-item')) {
          e.target.classList.add('dragging');
          e.dataTransfer.setData('text/plain', e.target.dataset.id);
          e.dataTransfer.effectAllowed = 'move';
        }
      });
      list.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      list.addEventListener('dragenter', e => {
        e.preventDefault();
      });
      list.addEventListener('drop', e => {
        e.preventDefault();
        const dragging = document.querySelector('.dragging');
        if (dragging) {
          const target = e.target.closest('.asset-item');
          if (target && target !== dragging) {
            const rect = target.getBoundingClientRect();
            const next = rect.y + rect.height / 2 < e.clientY ? target.nextSibling : target;
            list.insertBefore(dragging, next);
            const ids = Array.from(list.children).map(el => parseInt(el.dataset.id));
            saveCustomOrder(ids);
          }
        }
      });
      list.addEventListener('dragend', e => {
        e.target.classList.remove('dragging');
      });
    }

    // --- LÓGICA DE COPIAR AL PORTAPAPELES ---
    document.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const number = e.target.dataset.number;
        if (number) {
          navigator.clipboard.writeText(number).then(() => {
            showToast('✅ Nº de cuenta copiado.');
          }).catch(err => {
            console.error('Error al copiar:', err);
            showToast('❌ Error al copiar.');
          });
        }
      });
    });

    // --- TOGGLES DETALLE Y FILTRO ---
    const toggleDivBtn = document.getElementById('toggleDividendosDetail');
    if (toggleDivBtn) {
      toggleDivBtn.onclick = function() {
        const detail = document.getElementById('DividendosDetail');
        const isVisible = detail.style.display === 'block';
        detail.style.display = isVisible ? 'none' : 'block';
        this.textContent = isVisible ? 'Ver detalle' : 'Ocultar detalle';
        if (!isVisible) { // Si se está mostrando, cargar el detalle filtrado por año
            const yearSelect = document.getElementById('filterYearDividendos');
            if (yearSelect) updateDetailByYear('Dividendos', 'filterYearDividendos', 'filteredDetailDividendos');
        }
      };
    }

    const toggleIntBtn = document.getElementById('toggleInteresesDetail');
    if (toggleIntBtn) {
      toggleIntBtn.onclick = function() {
        const detail = document.getElementById('InteresesDetail');
        const isVisible = detail.style.display === 'block';
        detail.style.display = isVisible ? 'none' : 'block';
        this.textContent = isVisible ? 'Ver detalle' : 'Ocultar detalle';
        if (!isVisible) { // Si se está mostrando, cargar el detalle filtrado por año
            const yearSelect = document.getElementById('filterYearIntereses');
            if (yearSelect) updateDetailByYear('Intereses', 'filterYearIntereses', 'filteredDetailIntereses');
        }
      };
    }

    // Lógica de filtro por año
    function updateDetailByYear(title, selectId, detailId) {
        const yearSelect = document.getElementById(selectId);
        const detailDiv = document.getElementById(detailId);
        if (!yearSelect || !detailDiv) return;

        const selectedYear = yearSelect.value;
        const allReturns = title === 'Dividendos' ? dividends : interests;
        const accounts = orderedAccounts; // Usar la lista ordenada de cuentas
        const accountMap = {};
        accounts.forEach(a => accountMap[a.id] = a);

        let html = '';
        const filteredReturns = selectedYear ? allReturns.filter(r => new Date(r.date).getFullYear().toString() === selectedYear) : allReturns;
        const byAccount = {};
        for (const r of filteredReturns) {
          if (!byAccount[r.accountId]) byAccount[r.accountId] = 0;
          byAccount[r.accountId] += r.amount;
        }
        for (const accId in byAccount) {
          const acc = accountMap[accId];
          if (!acc) continue;
          const displayName = acc.bank + (acc.description ? ` (${acc.description})` : '');
          const amount = byAccount[accId];
          // CORRECCIÓN: Detalle de cuentas sin negrita
          html += `<div class="dividend-line"><strong>${displayName}:</strong> ${formatCurrency(amount)}`;
          if (title === 'Dividendos') {
            // No se muestra neto
          }
          html += `</div>`;
        }
        detailDiv.innerHTML = html;
    }

    // Eventos de cambio para los selects de filtro
    const yearSelectDiv = document.getElementById('filterYearDividendos');
    if (yearSelectDiv) {
        yearSelectDiv.onchange = () => updateDetailByYear('Dividendos', 'filterYearDividendos', 'filteredDetailDividendos');
    }
    const yearSelectInt = document.getElementById('filterYearIntereses');
    if (yearSelectInt) {
        yearSelectInt.onchange = () => updateDetailByYear('Intereses', 'filterYearIntereses', 'filteredDetailIntereses');
    }


  } catch (err) {
    console.error('Error en renderAccountsSummary:', err);
    summaryTotals.innerHTML = '<p style="color:red">Error al cargar cuentas.</p>';
    if (summaryContainer) summaryContainer.innerHTML = '';
  }
}

// --- FUNCIÓN ACTUALIZADA ---
async function showAccountList() {
  const accounts = await db.accounts.toArray();
  if (accounts.length === 0) {
    openModal('Cuentas', '<p>No hay cuentas. Añade una desde el menú.</p>');
    return;
  }
  let html = '<h3>Cuentas</h3>';
  accounts.forEach(acc => {
    const colorStyle = acc.color ? `color: ${acc.color};` : ''; // Color en modal también
    const borderColorStyle = acc.color ? `border-left: 4px solid ${acc.color};` : '';
    const accountNumberDisplay = acc.accountNumber ? (acc.isValueAccount ? acc.accountNumber.toUpperCase() : formatIBAN(acc.accountNumber)) : '';
    html += `
      <div class="asset-item" style="${borderColorStyle}">
        <strong style="${colorStyle}">${acc.bank}</strong> ${acc.description ? `(${acc.description})` : ''}<br>
        ${accountNumberDisplay ? `Nº: ${accountNumberDisplay}<br>` : ''}
        Titular: ${acc.holder}${acc.holder2 ? ` / ${acc.holder2}` : ''}<br>
        Saldo: ${formatCurrency(acc.currentBalance)}<br>
        ${acc.isValueAccount ? '<small>Cuenta de Valores</small><br>' : ''}
        ${acc.note ? `<small>Nota: ${acc.note}</small>` : ''}
        <div class="modal-actions">
          <button class="btn-edit" data-id="${acc.id}">Editar</button>
          <button class="btn-delete" data-id="${acc.id}">Eliminar</button>
        </div>
      </div>
    `;
  });
  openModal('Cuentas', html);
  document.querySelector('#modalOverlay .modal-body').onclick = async (e) => {
    if (e.target.classList.contains('btn-delete')) {
      const id = parseInt(e.target.dataset.id);
      showConfirm('¿Eliminar esta cuenta? (Los rendimientos asociados no se borrarán)', async () => {
        await db.accounts.delete(id); // Solo se borra la cuenta
        showAccountList(); // Actualiza la lista
      });
    }
    if (e.target.classList.contains('btn-edit')) {
      const id = parseInt(e.target.dataset.id);
      const acc = await db.accounts.get(id);
      if (!acc) return;
      openEditAccountForm(acc);
    }
  };
}
// --- FORMULARIOS DE CUENTAS ---
async function showAddAccountForm() {
  // Obtener entidades existentes para datalist
  const allAccounts = await db.accounts.toArray();
  const banks = [...new Set(allAccounts.map(a => a.bank))];
  const bankOptions = banks.map(b => `<option value="${b}">`).join('');

  // Obtener titulares existentes para datalist (común)
  const holders = [...new Set([
    ...allAccounts.map(a => a.holder),
    ...allAccounts.map(a => a.holder2).filter(h => h)
  ])];
  const holderOptions = holders.map(h => `<option value="${h}">`).join('');

  const form = `
    <div class="form-group">
      <label>Entidad:</label>
      <input type="text" id="bank" list="banks" placeholder="Ej: BBVA, Santander..." required />
      <datalist id="banks">${bankOptions}</datalist>
    </div>
    <div class="form-group">
      <label>Descripción:</label>
      <input type="text" id="description" placeholder="Ej: Cuenta nómina, Ahorros..." />
    </div>
    <div class="form-group">
      <label>Cuenta de Valores</label>
      <label id="isValueAccountLabel" class="value-account-toggle" style="display: inline-block; padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; user-select: none; background-color: #f0f0f0; color: #333;">
        <input type="checkbox" id="isValueAccount" style="display: none;">
        <span>🏷️ No</span>
      </label>
    </div>
    <div class="form-group">
      <label>Nº de Cuenta (IBAN):</label>
      <input type="text" id="accountNumber" placeholder="Ej: ES12 1234 5678 9012 3456 7890" required />
    </div>
    <div class="form-group">
      <label>Titular principal:</label>
      <input type="text" id="holder" list="holders" required />
      <datalist id="holders">${holderOptions}</datalist>
    </div>
    <div class="form-group">
      <label>Segundo titular:</label>
      <input type="text" id="holder2" list="holders" />
      <datalist id="holders">${holderOptions}</datalist>
    </div>
    <div class="form-group">
      <label>Saldo actual (€):</label>
      <input type="text" id="currentBalance" placeholder="0,00" required />
    </div>
    <div class="form-group">
      <label>Color de tarjeta:</label>
      <input type="color" id="color" value="#1a73e8" list="colorPalette">
      <datalist id="colorPalette">
        <option value="#091891"></option> <!-- BBVA -->
        <option value="#fb6405"></option> <!-- ING -->
        <option value="#04ac94"></option> <!-- N26 -->
        <option value="#eb0404"></option> <!-- Santander -->
        <option value="#21da60"></option> <!-- Trade Republic -->
        <option value="#1496d2"></option> <!-- Revolut -->
        <option value="#b3dded"></option> <!-- azul grisáceo -->
        <option value="#f8f49c"></option> <!-- Amarillo -->
      </datalist>
    </div>
    <div class="form-group">
      <label>Nota:</label>
      <input type="text" id="note" placeholder="Ej: Cuenta personal, Negocio..." />
    </div>
    <button id="btnSaveAccount" class="btn-primary">Añadir Cuenta</button>
  `;
  openModal('Añadir Cuenta', form);

  // Lógica para el toggle de "Cuenta de Valores"
  const toggleLabel = document.getElementById('isValueAccountLabel');
  const checkbox = document.getElementById('isValueAccount');
  toggleLabel.onclick = () => {
    checkbox.checked = !checkbox.checked;
    toggleLabel.querySelector('span').textContent = checkbox.checked ? '🏷️ Sí' : '🏷️ No';
    // Actualizar placeholder del número de cuenta
    const accountNumberInput = document.getElementById('accountNumber');
    if (checkbox.checked) {
      accountNumberInput.placeholder = "Ej: DE000A12B3C4";
    } else {
      accountNumberInput.placeholder = "Ej: ES12 1234 5678 9012 3456 7890";
    }
  };

  // Lógica para el input de saldo con formato
  const balanceInput = document.getElementById('currentBalance');
  let lastValue = '';
  balanceInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^\d,]/g, '');
    const parts = value.split(',');
    if (parts.length > 2) {
      value = parts[0] + ',' + parts.slice(1).join('');
    }
    const [integer, decimal] = value.split(',');
    if (integer) {
      const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      value = decimal ? formattedInteger + ',' + decimal : formattedInteger;
    }
    if (value !== e.target.value) {
      e.target.value = value;
    }
    lastValue = value;
  });

  document.getElementById('btnSaveAccount').onclick = async () => {
    const bank = document.getElementById('bank').value.trim();
    const description = document.getElementById('description').value.trim();
    const accountNumber = document.getElementById('accountNumber').value.trim();
    const isValueAccount = checkbox.checked; // Usar el checkbox
    const holder = document.getElementById('holder').value.trim();
    const holder2 = document.getElementById('holder2').value.trim() || null;
    let currentBalanceStr = balanceInput.value.trim();
    if (currentBalanceStr === '') {
      showToast('El saldo no puede estar vacío.');
      return;
    }
    // Convertir de nuevo a número con coma como decimal
    currentBalanceStr = currentBalanceStr.replace(/\./g, '').replace(',', '.');
    const currentBalance = parseFloat(currentBalanceStr);
    if (isNaN(currentBalance)) {
      showToast('Saldo inválido.');
      return;
    }
    const color = document.getElementById('color').value;
    const note = document.getElementById('note').value.trim() || null;
    if (!bank || !holder || !accountNumber) {
      showToast('Completa todos los campos obligatorios.');
      return;
    }
    await db.accounts.add({ bank, description, accountNumber, isValueAccount, holder, holder2, currentBalance, color, note });
    document.getElementById('modalOverlay').style.display = 'none';
    renderAccountsSummary();
  };
}

// --- FUNCIÓN ACTUALIZADA ---
async function openEditAccountForm(acc) {
  // Obtener entidades existentes para datalist
  const allAccounts = await db.accounts.toArray();
  const banks = [...new Set(allAccounts.map(a => a.bank))];
  const bankOptions = banks.map(b => `<option value="${b}">`).join('');

  // Obtener titulares existentes para datalist (común)
  const holders = [...new Set([
    ...allAccounts.map(a => a.holder),
    ...allAccounts.map(a => a.holder2).filter(h => h)
  ])];
  const holderOptions = holders.map(h => `<option value="${h}">`).join('');

  // Formatear saldo para mostrarlo en el input
  const formattedBalance = formatNumber(acc.currentBalance);

  const form = `
    <div class="form-group">
      <label>Entidad:</label>
      <input type="text" id="bank" list="banks" value="${acc.bank}" required />
      <datalist id="banks">${bankOptions}</datalist>
    </div>
    <div class="form-group">
      <label>Descripción:</label>
      <input type="text" id="description" value="${acc.description || ''}" />
    </div>
    <div class="form-group">
      <label>Cuenta de Valores</label>
      <label id="isValueAccountLabel" class="value-account-toggle" style="display: inline-block; padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; user-select: none; background-color: #f0f0f0; color: #333;">
        <input type="checkbox" id="isValueAccount" ${acc.isValueAccount ? 'checked' : ''} style="display: none;">
        <span>🏷️ ${acc.isValueAccount ? 'Sí' : 'No'}</span>
      </label>
    </div>
    <div class="form-group">
      <label>Nº de Cuenta (IBAN):</label>
      <input type="text" id="accountNumber" value="${acc.accountNumber || ''}" required />
    </div>
    <div class="form-group">
      <label>Titular principal:</label>
      <input type="text" id="holder" value="${acc.holder}" required />
      <datalist id="holders">${holderOptions}</datalist>
    </div>
    <div class="form-group">
      <label>Segundo titular:</label>
      <input type="text" id="holder2" value="${acc.holder2 || ''}" />
      <datalist id="holders">${holderOptions}</datalist>
    </div>
    <div class="form-group">
      <label>Saldo actual (€):</label>
      <input type="text" id="currentBalance" value="${formattedBalance}" required />
    </div>
    <div class="form-group">
      <label>Color de tarjeta:</label>
      <input type="color" id="color" value="${acc.color || '#1a73e8'}" list="colorPalette">
      <datalist id="colorPalette">
        <option value="#091891"></option> <!-- BBVA -->
        <option value="#fb6405"></option> <!-- ING -->
        <option value="#04ac94"></option> <!-- N26 -->
        <option value="#eb0404"></option> <!-- Santander -->
        <option value="#21da60"></option> <!-- Trade Republic -->
        <option value="#1496d2"></option> <!-- Revolut -->
        <option value="#b3dded"></option> <!-- azul grisáceo -->
        <option value="#f8f49c"></option> <!-- Amarillo -->
      </datalist>
    </div>
    <div class="form-group">
      <label>Nota:</label>
      <input type="text" id="note" value="${acc.note || ''}" />
    </div>
    <button id="btnUpdateAccount" class="btn-primary">Guardar Cambios</button>
  `;
  openModal('Editar Cuenta', form);

  // Aplicar color al borde de la tarjeta del modal
  const modalContent = document.querySelector('#modalOverlay .modal-content');
  if (modalContent && acc.color) {
    modalContent.style.borderLeft = `4px solid ${acc.color}`;
  } else if (modalContent) {
    modalContent.style.borderLeft = '4px solid #1a73e8'; // Color por defecto
  }

  // Lógica para el toggle de "Cuenta de Valores"
  const toggleLabel = document.getElementById('isValueAccountLabel');
  const checkbox = document.getElementById('isValueAccount');
  toggleLabel.onclick = () => {
    checkbox.checked = !checkbox.checked;
    toggleLabel.querySelector('span').textContent = checkbox.checked ? '🏷️ Sí' : '🏷️ No';
    // Actualizar placeholder del número de cuenta
    const accountNumberInput = document.getElementById('accountNumber');
    if (checkbox.checked) {
      accountNumberInput.placeholder = "Ej: DE000A12B3C4";
    } else {
      accountNumberInput.placeholder = "Ej: ES12 1234 5678 9012 3456 7890";
    }
  };

  // Lógica para el input de saldo con formato
  const balanceInput = document.getElementById('currentBalance');
  let lastValue = balanceInput.value;
  balanceInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^\d,]/g, '');
    const parts = value.split(',');
    if (parts.length > 2) {
      value = parts[0] + ',' + parts.slice(1).join('');
    }
    const [integer, decimal] = value.split(',');
    if (integer) {
      const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      value = decimal ? formattedInteger + ',' + decimal : formattedInteger;
    }
    if (value !== e.target.value) {
      e.target.value = value;
    }
    lastValue = value;
  });

  document.getElementById('btnUpdateAccount').onclick = async () => {
    const bank = document.getElementById('bank').value.trim();
    const description = document.getElementById('description').value.trim();
    const accountNumber = document.getElementById('accountNumber').value.trim();
    const isValueAccount = checkbox.checked; // Usar el checkbox
    const holder = document.getElementById('holder').value.trim();
    const holder2 = document.getElementById('holder2').value.trim() || null;
    let currentBalanceStr = balanceInput.value.trim();
    if (currentBalanceStr === '') {
      showToast('El saldo no puede estar vacío.');
      return;
    }
    // Convertir de nuevo a número con coma como decimal
    currentBalanceStr = currentBalanceStr.replace(/\./g, '').replace(',', '.');
    const currentBalance = parseFloat(currentBalanceStr);
    if (isNaN(currentBalance)) {
      showToast('Saldo inválido.');
      return;
    }
    const color = document.getElementById('color').value;
    const note = document.getElementById('note').value.trim() || null;
    if (!bank || !holder || !accountNumber) {
      showToast('Completa todos los campos obligatorios.');
      return;
    }
    await db.accounts.update(acc.id, { bank, description, accountNumber, isValueAccount, holder, holder2, currentBalance, color, note });
    document.getElementById('modalOverlay').style.display = 'none';
    renderAccountsSummary();
  };
}
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

  // Lógica para el input de importe con formato
  const amountInput = document.getElementById('returnAmount');
  let lastValue = '';
  amountInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^\d,]/g, '');
    const parts = value.split(',');
    if (parts.length > 2) {
      value = parts[0] + ',' + parts.slice(1).join('');
    }
    const [integer, decimal] = value.split(',');
    if (integer) {
      const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      value = decimal ? formattedInteger + ',' + decimal : formattedInteger;
    }
    if (value !== e.target.value) {
      e.target.value = value;
    }
    lastValue = value;
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
        let value = e.target.value.replace(/[^\d,]/g, '');
        const parts = value.split(',');
        if (parts.length > 2) {
          value = parts[0] + ',' + parts.slice(1).join('');
        }
        const [integer, decimal] = value.split(',');
        if (integer) {
          const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
          value = decimal ? formattedInteger + ',' + decimal : formattedInteger;
        }
        if (value !== e.target.value) {
          e.target.value = value;
        }
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
      <li>💰 Registro de rendimientos: intereses y dividendos (en bruto)</li>
      <li>📊 Rendimientos con desglose anual visible</li>
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

// --- INICIO ---
document.addEventListener('DOMContentLoaded', () => {
  db.open().catch(err => {
    console.error('IndexedDB error:', err);
    const el = document.getElementById('summary-totals');
    if (el) el.innerHTML = '<p style="color:red">Error de base de datos.</p>';
  }).then(() => {
    renderAccountsSummary();
  });
  setTheme(getCurrentTheme());
  initMenu();
});
