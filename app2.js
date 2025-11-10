// app2.js
// Parte 1B: Gestión de cuentas, saldo total y colores

const COLORES_CUENTAS = [
  '#4A90E2', '#50C878', '#FF6F61', '#FFD700', '#9B59B6',
  '#1ABC9C', '#E74C3C', '#3498DB', '#2ECC71', '#F39C12',
  '#8E44AD', '#16A085', '#C0392B'
];
const mapaColoresPorTipo = new Map();

function obtenerColorParaTipo(tipo) {
  if (!mapaColoresPorTipo.has(tipo)) {
    const tiposExistentes = Array.from(mapaColoresPorTipo.keys());
    const indice = tiposExistentes.length % COLORES_CUENTAS.length;
    mapaColoresPorTipo.set(tipo, COLORES_CUENTAS[indice]);
  }
  return mapaColoresPorTipo.get(tipo);
}

function renderizarListaCuentas() {
  if (!elementos.listaCuentas) return;

  const cuentasOrdenadas = [...estado.cuentas]
    .sort((a, b) => {
      if (a.banco !== b.banco) return a.banco.localeCompare(b.banco);
      return a.tipo.localeCompare(b.tipo);
    });

  elementos.listaCuentas.innerHTML = '';

  if (cuentasOrdenadas.length === 0) {
    elementos.listaCuentas.innerHTML = '<p>No hay cuentas registradas.</p>';
    return;
  }

  cuentasOrdenadas.forEach(cuenta => {
    const color = obtenerColorParaTipo(cuenta.tipo);
    const titular2Texto = cuenta.titular2 ? `<div class="titular-secundario">${cuenta.titular2}</div>` : '';

    const tarjeta = document.createElement('div');
    tarjeta.className = 'tarjeta-cuenta';
    tarjeta.style.setProperty('--color-borde', color);
    tarjeta.innerHTML = `
      <div class="titular-cuenta">${cuenta.titular}</div>
      ${titular2Texto}
      <div class="banco-cuenta">${cuenta.banco}</div>
      <div class="tipo-cuenta">${cuenta.tipo}</div>
      <div class="saldo-cuenta">${formatearMoneda(cuenta.saldo)}</div>
    `;

    tarjeta.addEventListener('click', () => editarCuenta(cuenta));
    elementos.listaCuentas.appendChild(tarjeta);
  });
}

function editarCuenta(cuenta) {
  document.getElementById('tituloModalCuenta').textContent = 'Editar cuenta';
  document.getElementById('cuentaId').value = cuenta.id;
  document.getElementById('banco').value = cuenta.banco;
  document.getElementById('tipoCuenta').value = cuenta.tipo;
  document.getElementById('titular').value = cuenta.titular;
  document.getElementById('titular2').value = cuenta.titular2 || '';
  document.getElementById('saldo').value = cuenta.saldo || 0;
  document.getElementById('cuentaActiva').checked = cuenta.activa !== false;

  abrirModal(elementos.modalCuenta);
}

elementos.formCuenta?.addEventListener('submit', (e) => {
  e.preventDefault();

  const id = document.getElementById('cuentaId').value;
  const banco = document.getElementById('banco').value.trim();
  const tipo = document.getElementById('tipoCuenta').value.trim();
  const titular = document.getElementById('titular').value.trim();
  const titular2 = document.getElementById('titular2').value.trim() || '';
  const saldo = parseFloat(document.getElementById('saldo').value) || 0;
  const activa = document.getElementById('cuentaActiva').checked;

  if (!banco || !tipo || !titular) {
    alert('Por favor, completa todos los campos obligatorios.');
    return;
  }

  if (id) {
    const cuentaIndex = estado.cuentas.findIndex(c => c.id === id);
    if (cuentaIndex !== -1) {
      estado.cuentas[cuentaIndex] = { ...estado.cuentas[cuentaIndex], banco, tipo, titular, titular2, saldo, activa };
    }
  } else {
    estado.cuentas.push({
      id: 'c' + Date.now().toString(36),
      banco,
      tipo,
      titular,
      titular2,
      saldo,
      moneda: 'EUR',
      activa: true
    });
  }

  guardarDatos();
  renderizarTodo();
  cerrarTodosLosModales();
});

function calcularSaldoTotal() {
  return estado.cuentas
    .filter(c => c.activa !== false)
    .reduce((sum, cuenta) => sum + (cuenta.saldo || 0), 0);
}

// Reemplazar renderizarTodo para incluir saldo
const renderizarTodo_original = renderizarTodo;
renderizarTodo = function() {
  renderizarTodo_original();
  renderizarListaCuentas();
  if (elementos.saldoTotal) {
    elementos.saldoTotal.textContent = formatearMoneda(calcularSaldoTotal());
  }
};
