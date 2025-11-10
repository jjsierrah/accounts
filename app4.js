// app4.js
// Parte 3: Importar, exportar, edición de rendimientos y menú completo

function exportarDatos() {
  const datos = {
    cuentas: estado.cuentas,
    rendimientos: estado.rendimientos,
    temaOscuro: estado.temaOscuro
  };
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `control-cuentas-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importarDatos(archivo) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const datos = JSON.parse(e.target.result);
      if (!Array.isArray(datos.cuentas) || !Array.isArray(datos.rendimientos)) {
        throw new Error('Formato inválido');
      }
      const ahora = Date.now();
      datos.cuentas.forEach((c, i) => c.id = c.id || `c_import_${ahora}_${i}`);
      datos.rendimientos.forEach((r, i) => r.id = r.id || `r_import_${ahora}_${i}`);
      estado.cuentas = datos.cuentas;
      estado.rendimientos = datos.rendimientos;
      estado.temaOscuro = datos.temaOscuro === true;
      guardarDatos();
      renderizarTodo();
      alert('Datos importados correctamente.');
    } catch (error) {
      alert('Error al importar el archivo. Asegúrate de que sea un JSON válido.');
    }
  };
  reader.readAsText(archivo);
}

function activarImportacion() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => e.target.files[0] && importarDatos(e.target.files[0]);
  input.click();
}

function editarRendimiento(rendimiento) {
  document.getElementById('tituloModalRendimiento').textContent = 'Editar rendimiento';
  document.getElementById('rendimientoId').value = rendimiento.id;
  document.getElementById('fechaRendimiento').value = rendimiento.fecha;
  document.getElementById('conceptoRendimiento').value = rendimiento.concepto;
  document.getElementById('importeBruto').value = rendimiento.importeBruto;
  document.getElementById('tipoRendimiento').value = rendimiento.tipo;
  document.getElementById('aplicarRetencion').checked = 
    rendimiento.tipo === 'interes' && rendimiento.neto === rendimiento.importeBruto * 0.81;
  rellenarSelectorCuentas();
  document.getElementById('cuentaRendimiento').value = rendimiento.cuentaId;
  abrirModal(elementos.modalRendimiento);
}

// Reemplazar renderizarDetalleRentabilidad para hacerlo editable
const renderizarDetalleRentabilidad_original = renderizarDetalleRentabilidad;
renderizarDetalleRentabilidad = function() {
  renderizarDetalleRentabilidad_original();
  if (!elementos.detalleRentabilidad) return;
  const lineas = elementos.detalleRentabilidad.children;
  for (let i = 0; i < lineas.length; i++) {
    const r = [...estado.rendimientos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[i];
    if (r) {
      lineas[i].style.cursor = 'pointer';
      lineas[i].title = 'Hacer clic para editar';
      const clickHandler = () => editarRendimiento(r);
      lineas[i].addEventListener('click', clickHandler);
    }
  }
};

// Completar el menú con importar, exportar y ordenar
document.querySelectorAll('[data-accion="importar"]').forEach(item => {
  item.addEventListener('click', (e) => { e.preventDefault(); activarImportacion(); });
});
document.querySelectorAll('[data-accion="exportar"]').forEach(item => {
  item.addEventListener('click', (e) => { e.preventDefault(); exportarDatos(); });
});
document.querySelectorAll('[data-accion="ordenar"]').forEach(item => {
  item.addEventListener('click', (e) => { e.preventDefault(); renderizarListaCuentas(); });
});
