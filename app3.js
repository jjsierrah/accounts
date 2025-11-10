// app3.js
function rellenarSelectorCuentas() {
  const select = document.getElementById('cuentaRendimiento');
  if (!select) return;

  const cuentasActivas = estado.cuentas.filter(c => c.activa !== false);
  select.innerHTML = '';
  
  cuentasActivas.forEach(cuenta => {
    const option = document.createElement('option');
    option.value = cuenta.id;
    option.textContent = `${cuenta.banco} – ${cuenta.titular}`;
    select.appendChild(option);
  });
}

elementos.formRendimiento?.addEventListener('submit', (e) => {
  e.preventDefault();

  const id = document.getElementById('rendimientoId').value;
  const cuentaId = document.getElementById('cuentaRendimiento').value;
  const fecha = document.getElementById('fechaRendimiento').value;
  const concepto = document.getElementById('conceptoRendimiento').value.trim();
  const importeBruto = parseFloat(document.getElementById('importeBruto').value);
  const tipo = document.getElementById('tipoRendimiento').value;
  const aplicarRetencion = document.getElementById('aplicarRetencion').checked;

  if (!cuentaId || !fecha || !concepto || isNaN(importeBruto)) {
    alert('Completa todos los campos correctamente.');
    return;
  }

  const esIngreso = tipo !== 'comision';
  let importeNeto = esIngreso ? Math.abs(importeBruto) : -Math.abs(importeBruto);

  if (tipo === 'interes' && aplicarRetencion) {
    importeNeto = importeNeto * 0.81;
  }

  const anio = new Date(fecha).getFullYear();

  if (id) {
    const idx = estado.rendimientos.findIndex(r => r.id === id);
    if (idx !== -1) {
      estado.rendimientos[idx] = { ...estado.rendimientos[idx], cuentaId, fecha, concepto, importeBruto, neto: importeNeto, tipo, anio };
    }
  } else {
    estado.rendimientos.push({
      id: 'r' + Date.now().toString(36),
      cuentaId,
      fecha,
      concepto,
      importeBruto,
      neto: importeNeto,
      tipo,
      anio
    });
  }

  guardarDatos();
  renderizarTodo();
  cerrarTodosLosModales();
});

function calcularRentabilidadTotal() {
  return estado.rendimientos.reduce((sum, r) => sum + r.neto, 0);
}

function obtenerRentabilidadPorAnio() {
  const agrupado = {};
  estado.rendimientos.forEach(r => {
    if (!agrupado[r.anio]) agrupado[r.anio] = 0;
    agrupado[r.anio] += r.neto;
  });
  return Object.entries(agrupado)
    .map(([anio, total]) => ({ anio: parseInt(anio), total }))
    .sort((a, b) => b.anio - a.anio);
}

function renderizarResumenRentabilidad() {
  const rentabilidadPorAnio = obtenerRentabilidadPorAnio();
  if (!elementos.resumenRentabilidad) return;

  elementos.resumenRentabilidad.innerHTML = '';

  if (rentabilidadPorAnio.length === 0) {
    elementos.resumenRentabilidad.innerHTML = '<div>Sin rendimientos registrados.</div>';
    return;
  }

  rentabilidadPorAnio.forEach(({ anio, total }) => {
    const item = document.createElement('div');
    item.className = 'item-anio';
    const signo = total >= 0 ? '+' : '';
    item.innerHTML = `<strong>${anio}</strong>: ${signo}${formatearMoneda(total).replace(' €', '')} €`;
    elementos.resumenRentabilidad.appendChild(item);
  });
}

function renderizarDetalleRentabilidad() {
  if (!elementos.detalleRentabilidad) return;
  elementos.detalleRentabilidad.innerHTML = '';

  if (estado.rendimientos.length === 0) return;

  const rendimientosOrdenados = [...estado.rendimientos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  rendimientosOrdenados.forEach(r => {
    const cuenta = estado.cuentas.find(c => c.id === r.cuentaId);
    const nombreCuenta = cuenta ? cuenta.banco : 'Cuenta eliminada';
    const signo = r.neto >= 0 ? '+' : '';
    const importeTexto = `${signo}${formatearMoneda(Math.abs(r.neto)).replace(' €', '')} €`;

    const linea = document.createElement('div');
    linea.innerHTML = `
      <span>${new Date(r.fecha).toLocaleDateString('es-ES')} – ${r.concepto} (${nombreCuenta})</span>
      <span>${importeTexto}</span>
    `;
    elementos.detalleRentabilidad.appendChild(linea);
  });
}

function actualizarBotonDetalle() {
  if (!elementos.btnVerDetalleRentabilidad || !elementos.detalleRentabilidad) return;
  const estaVisible = !elementos.detalleRentabilidad.classList.contains('oculto');
  elementos.btnVerDetalleRentabilidad.textContent = estaVisible ? 'Ocultar detalle' : 'Ver detalle';
}

// Extender renderizarTodo
if (typeof renderizarTodo === 'function') {
  const renderizarTodo_original = renderizarTodo;
  renderizarTodo = function() {
    renderizarTodo_original();
    if (elementos.rentabilidadTotal) {
      elementos.rentabilidadTotal.textContent = formatearMoneda(calcularRentabilidadTotal());
    }
    renderizarResumenRentabilidad();
    renderizarDetalleRentabilidad();
    actualizarBotonDetalle();
  };
}

// Completar el caso 'nuevo-rendimiento' en el menú
document.querySelectorAll('[data-accion="nuevo-rendimiento"]').forEach(item => {
  const handler = (e) => {
    e.preventDefault();
    document.getElementById('tituloModalRendimiento').textContent = 'Añadir rendimiento';
    document.getElementById('formRendimiento')?.reset();
    document.getElementById('rendimientoId').value = '';
    rellenarSelectorCuentas();
    abrirModal(elementos.modalRendimiento);
  };
  item.removeEventListener('click', handler);
  item.addEventListener('click', handler);
});
