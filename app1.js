// app1.js
// Parte 1A: Inicialización, menú, tema y utilidades básicas

let estado = {
  cuentas: [],
  rendimientos: [],
  temaOscuro: false
};

const elementos = {
  btnMenu: document.getElementById('btnMenu'),
  menuLateral: document.getElementById('menuLateral'),
  cerrarMenu: document.getElementById('cerrarMenu'),
  overlay: document.getElementById('overlay'),
  modalCuenta: document.getElementById('modalCuenta'),
  modalRendimiento: document.getElementById('modalRendimiento'),
  modalAyuda: document.getElementById('modalAyuda'),
  formCuenta: document.getElementById('formCuenta'),
  formRendimiento: document.getElementById('formRendimiento'),
  listaCuentas: document.getElementById('listaCuentas'),
  saldoTotal: document.getElementById('saldoTotal'),
  rentabilidadTotal: document.getElementById('rentabilidadTotal'),
  resumenRentabilidad: document.getElementById('resumenRentabilidad'),
  btnVerDetalleRentabilidad: document.getElementById('btnVerDetalleRentabilidad'),
  detalleRentabilidad: document.getElementById('detalleRentabilidad')
};

function iniciarApp() {
  cargarDatos();
  renderizarTodo();
  inicializarEventos();
  aplicarTema();
}

function cargarDatos() {
  const datosGuardados = localStorage.getItem('controlCuentas');
  if (datosGuardados) {
    const datos = JSON.parse(datosGuardados);
    estado.cuentas = datos.cuentas || [];
    estado.rendimientos = datos.rendimientos || [];
    estado.temaOscuro = datos.temaOscuro === true;
  }
}

function guardarDatos() {
  const datos = {
    cuentas: estado.cuentas,
    rendimientos: estado.rendimientos,
    temaOscuro: estado.temaOscuro
  };
  localStorage.setItem('controlCuentas', JSON.stringify(datos));
}

function aplicarTema() {
  if (estado.temaOscuro) {
    document.body.classList.add('theme-dark');
  } else {
    document.body.classList.remove('theme-dark');
  }
}

function alternarTema() {
  estado.temaOscuro = !estado.temaOscuro;
  aplicarTema();
  guardarDatos();
}

function formatearMoneda(valor) {
  if (valor === null || valor === undefined) return '0,00 €';
  return valor.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' €';
}

function renderizarTodo() {
  aplicarTema();
}

function cerrarTodosLosModales() {
  elementos.modalCuenta?.classList.remove('visible');
  elementos.modalRendimiento?.classList.remove('visible');
  elementos.modalAyuda?.classList.remove('visible');
  elementos.overlay?.classList.remove('visible');
}

function abrirModal(modal) {
  cerrarTodosLosModales();
  modal?.classList.add('visible');
  elementos.overlay?.classList.add('visible');
}

function inicializarEventos() {
  elementos.btnMenu?.addEventListener('click', () => {
    elementos.menuLateral?.classList.add('visible');
    elementos.overlay?.classList.add('visible');
  });

  elementos.cerrarMenu?.addEventListener('click', () => {
    elementos.menuLateral?.classList.remove('visible');
    elementos.overlay?.classList.remove('visible');
  });

  elementos.overlay?.addEventListener('click', () => {
    elementos.menuLateral?.classList.remove('visible');
    cerrarTodosLosModales();
    elementos.overlay?.classList.remove('visible');
  });

  document.querySelectorAll('.btn-cerrar-modal').forEach(btn => {
    btn.addEventListener('click', cerrarTodosLosModales);
  });

  document.querySelectorAll('[data-accion]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const accion = e.target.dataset.accion || e.target.parentElement?.dataset.accion;
      
      cerrarTodosLosModales();
      elementos.menuLateral?.classList.remove('visible');
      elementos.overlay?.classList.remove('visible');

      switch (accion) {
        case 'nueva-cuenta':
          document.getElementById('tituloModalCuenta').textContent = 'Añadir cuenta';
          document.getElementById('formCuenta')?.reset();
          document.getElementById('cuentaId').value = '';
          abrirModal(elementos.modalCuenta);
          break;
        case 'nuevo-rendimiento':
          // Se completará en app3.js
          break;
        case 'ordenar':
          // Se completará en app4.js
          break;
        case 'importar':
          // Se completará en app4.js
          break;
        case 'exportar':
          // Se completará en app4.js
          break;
        case 'cambiar-tema':
          alternarTema();
          break;
        case 'ayuda':
          abrirModal(elementos.modalAyuda);
          break;
      }
    });
  });

  if (elementos.btnVerDetalleRentabilidad) {
    elementos.btnVerDetalleRentabilidad.addEventListener('click', () => {
      elementos.detalleRentabilidad?.classList.toggle('oculto');
      elementos.btnVerDetalleRentabilidad.textContent = 
        elementos.detalleRentabilidad?.classList.contains('oculto') ? 'Ver detalle' : 'Ocultar detalle';
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarApp);
} else {
  iniciarApp();
}
