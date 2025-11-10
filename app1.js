// app1.js - Versión mínima funcional

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
