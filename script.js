// ===== CONFIGURATION =====
const POWER_AUTOMATE_URL = 'https://default0c13096209bc40fc8db89d043ff625.1a.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/2412ec1d32f74a6d8a4df629cd33113e/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=kzyKq1IKiFyLWJlWzvQduSGcMyVViJeW6F5pDBbAPk0'; // Replace with actual URL
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

// ===== GLOBAL VARIABLES =====
let participacionesData = [];
let generoData = [];
let autoresData = [];
let selectedSignatureFile = null;
let turnstileToken = '';
let formCreationDate = '';
let pendingCaptchaToken = '';
let correosAdicionales = {};

function escapeHtml(value) {
  const v = (value === null || value === undefined) ? '' : String(value);
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isLikelyEmail(value) {
  const v = (typeof value === 'string') ? value.trim() : '';
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function actualizarListaParticipantesNotificacion() {
  const alertaDiv = document.getElementById('alerta-correos-faltantes');
  const listaUl = document.querySelector('.lista-participantes-notificacion');

  if (!listaUl) return;

  const participantesMap = new Map();

  participacionesData.forEach((p, index) => {
    if (p.deleted) return;

    const autorId = $(`.participacion-autor[data-index="${index}"]`).val();
    if (!autorId) return;

    const autorNombrePlain = decryptIfEncrypted(autorId);
    if (!autorNombrePlain.trim()) return;

    if (participantesMap.has(autorNombrePlain)) return;

    const autorData = autoresData.find(a => a.id === autorId);
    const correoDirectorio = autorData ? decryptIfEncrypted(autorData.emailEnc) : '';
    const correoManual = correosAdicionales[autorNombrePlain] || '';
    const correoFinal = (correoDirectorio && correoDirectorio.trim()) ? correoDirectorio.trim() : (correoManual || '').trim();

    participantesMap.set(autorNombrePlain, {
      nombre: autorNombrePlain,
      correo: correoFinal,
      tieneCorreo: !!correoFinal
    });
  });

  const participantes = Array.from(participantesMap.values());
  const participantesSinCorreo = participantes.filter(p => !p.tieneCorreo);

  if (alertaDiv) {
    if (participantesSinCorreo.length > 0) {
      alertaDiv.innerHTML = `Se encontraron <strong>${participantesSinCorreo.length}</strong> participante(s) sin correo electrónico (pueden no ser socios de ATN). Si tienes sus correos los puedes registrar en este apartado; si no, se recomienda notificarlos manualmente mientras se actualizan los datos en ATN.`;
      alertaDiv.style.display = 'block';
    } else {
      alertaDiv.style.display = 'none';
    }
  }

  if (participantes.length === 0) {
    listaUl.innerHTML = '<li>No hay participantes para notificar</li>';
    return;
  }

  listaUl.innerHTML = participantes.map(p0 => {
    const p = {
      nombre: escapeHtml(p0.nombre),
      correo: escapeHtml(p0.correo),
      tieneCorreo: !!p0.tieneCorreo
    };
    if (p.tieneCorreo) {
      return `
        <li class="participante-item">
          <span class="participante-nombre">${p.nombre}</span>
          <span class="participante-correo-encontrado">✓ Se encontró correo</span>
        </li>
      `;
    }

    const prefillRaw = correosAdicionales[p0.nombre] ? String(correosAdicionales[p0.nombre]).trim() : '';
    const prefill = escapeHtml(prefillRaw);
    return `
      <li class="participante-item">
        <span class="participante-nombre">${p.nombre}</span>
        <span class="participante-sin-correo">✗ No se encontró correo</span>
        <div class="campo-correo-opcional">
          <input
            type="email"
            class="form-control correo-adicional-input"
            data-autor="${encodeURIComponent(p0.nombre)}"
            value="${prefill}"
            placeholder="Agregar correo (opcional)"
          >
        </div>
      </li>
    `;
  }).join('');

  const correosInputs = listaUl.querySelectorAll('.correo-adicional-input');
  correosInputs.forEach(input => {
    input.addEventListener('change', function () {
      const autorEnc = this.getAttribute('data-autor') || '';
      const autor = autorEnc ? decodeURIComponent(autorEnc) : '';
      const correo = (typeof this.value === 'string') ? this.value.trim() : '';

      if (!autor) return;

      if (!correo) {
        delete correosAdicionales[autor];
        actualizarListaParticipantesNotificacion();
        return;
      }

      if (!isLikelyEmail(correo)) {
        return;
      }

      correosAdicionales[autor] = correo;
      actualizarListaParticipantesNotificacion();
    });
  });
}

function getSensitiveKey() {
  const a = atob('T2JyYXM=');
  const b = atob('RE0tMjAyNg==');
  const c = atob('QFRO');
  return `${a}${b}${c}`;
}

function xorEncryptToBase64(plainText) {
  const key = getSensitiveKey();
  const plain = new TextEncoder().encode(String(plainText ?? ''));
  const keyBytes = new TextEncoder().encode(key);
  const out = new Uint8Array(plain.length);
  for (let i = 0; i < plain.length; i++) {
    out[i] = plain[i] ^ keyBytes[i % keyBytes.length];
  }
  let binary = '';
  for (let i = 0; i < out.length; i++) {
    binary += String.fromCharCode(out[i]);
  }
  return btoa(binary);
}

function xorDecryptFromBase64(base64Text) {
  const key = getSensitiveKey();
  const keyBytes = new TextEncoder().encode(key);
  const binary = atob(String(base64Text ?? ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(out);
}

function normalizeEncrypted(value) {
  const v = (typeof value === 'string') ? value.trim() : '';
  if (!v) return '';
  if (v.startsWith('enc:')) return v;
  return `enc:${xorEncryptToBase64(v)}`;
}

function decryptIfEncrypted(value) {
  const v = (typeof value === 'string') ? value.trim() : '';
  if (!v) return '';
  if (!v.startsWith('enc:')) return v;
  return xorDecryptFromBase64(v.slice(4));
}

function formatDateDMY(date) {
  const dt = (date instanceof Date) ? date : new Date();
  const formatter = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(dt);
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  return `${map.day}-${map.month}-${map.year} ${map.hour}:${map.minute}:${map.second}`;
}

function getCaptchaToken() {
  if (typeof turnstileToken === 'string' && turnstileToken.trim()) {
    return turnstileToken.trim();
  }
  const el = document.querySelector('input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]');
  return (el && typeof el.value === 'string') ? el.value.trim() : '';
}

function validateCaptcha() {
  const token = getCaptchaToken();
  const $group = $('#captcha-group');

  if (!$group.length) return true;

  $group.removeClass('has-error');
  if (!token) {
    $group.addClass('has-error');
    return false;
  }

  return true;
}

window.onTurnstileSuccess = function (token) {
  turnstileToken = (typeof token === 'string') ? token.trim() : '';
  $('#captcha-group').removeClass('has-error');
};

window.onTurnstileExpired = function () {
  turnstileToken = '';
  $('#captcha-group').addClass('has-error');
};

// ===== INITIALIZATION =====
$(document).ready(async function () {
  formCreationDate = formatDateDMY(new Date());
  initializeForm();
  await loadJSONData(); // Wait for JSON data to load
  setupEventListeners();
  addInitialParticipacion(); // Now autoresData is populated
});

// ===== INITIALIZE FORM =====
function initializeForm() {
  // Initialize Select2 for all select elements with class 'select2'
  $('.select2').select2({
    placeholder: 'Seleccione una opción',
    allowClear: true,
    width: '100%'
  });
}

// ===== LOAD JSON DATA =====
async function loadJSONData() {
  // Load genre data from JSON file
  try {
    const genreResponse = await fetch('generos.json');
    if (genreResponse.ok) {
      const generosRaw = await genreResponse.json();
      // Transform to Select2 format: id = genero, text = genero
      generoData = generosRaw.map((g, index) => ({
        id: g.genero || `genero${index}`,
        text: g.genero || `Género ${index}`
      }));
    } else {
      console.warn('Could not load generos.json, using default data');
      generoData = [
        { id: 'Ficción', text: 'Ficción' },
        { id: 'Informativo', text: 'Informativo' },
        { id: 'Documental', text: 'Documental' },
        { id: 'Reportaje', text: 'Reportaje' }
      ];
    }
  } catch (error) {
    console.error('Error loading generos.json:', error);
    generoData = [
      { id: 'Ficción', text: 'Ficción' },
      { id: 'Informativo', text: 'Informativo' },
      { id: 'Documental', text: 'Documental' }
    ];
  }

  // Load authors data from JSON file
  try {
    const autoresResponse = await fetch('assets/core-data.json');
    if (autoresResponse.ok) {
      const autoresRaw = await autoresResponse.json();
      // Transform to Select2 format: id = nombre, text = nombre, email = correo
      autoresData = autoresRaw.map((autor, index) => ({
        id: normalizeEncrypted((autor && typeof autor.d1 === 'string') ? autor.d1 : `autor${index}`),
        text: decryptIfEncrypted((autor && typeof autor.d1 === 'string') ? autor.d1 : `Autor ${index}`),
        emailEnc: normalizeEncrypted((autor && typeof autor.d2 === 'string') ? autor.d2 : '')
      }));
    } else {
      console.warn('Could not load assets/core-data.json, using default data');
      autoresData = [
        { id: normalizeEncrypted('Autor 1'), text: 'Autor 1', emailEnc: normalizeEncrypted('') },
        { id: normalizeEncrypted('Autor 2'), text: 'Autor 2', emailEnc: normalizeEncrypted('') },
        { id: normalizeEncrypted('Autor 3'), text: 'Autor 3', emailEnc: normalizeEncrypted('') }
      ];
    }
    } catch (error) {
      console.error('Error loading autores.json:', error);
      autoresData = [
      { id: normalizeEncrypted('Autor 1'), text: 'Autor 1', emailEnc: normalizeEncrypted('') },
      { id: normalizeEncrypted('Autor 2'), text: 'Autor 2', emailEnc: normalizeEncrypted('') }
      ];
    }

  // Populate genre dropdown
  const $generoSelect = $('#genero-obra');
  generoData.forEach(genre => {
    $generoSelect.append(new Option(genre.text, genre.id, false, false));
  });
  $generoSelect.trigger('change');
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Form validation on input
  $('.form-control').on('blur', function () {
    validateField($(this));
  });

  setupRutFormatting();

  $('#declarante-correo').on('input', function () {
    validateField($(this));
  });

  $('#declaracion-veracidad').on('change', validateDeclaracionVeracidad);

  // Number input validation
  $('input[type="number"]').on('input', function () {
    const $input = $(this);
    const min = parseFloat($input.attr('min'));
    const max = parseFloat($input.attr('max'));
    const value = parseFloat($input.val());

    if (value < min) {
      $input.val(min);
    } else if (value > max) {
      $input.val(max);
    }
  });

  // Add participacion button
  $('.btn-agregar-participacion').on('click', addParticipacion);

  // File upload
  $('#firma-file').on('change', handleFileUpload);

  // Remove file button
  $('.btn-remove-file').on('click', removeSignatureFile);

  // Form submission
  $('#dramatic-form').on('submit', handleFormSubmit);

  // Modal buttons
  $('#modalExitoOk').on('click', function () {
    $('#modalExito').removeClass('show').hide();
    resetForm();
  });

  $('#modalErrorClose').on('click', function () {
    $('#modalError').removeClass('show').hide();
  });

  $('#modalErrorRetry').on('click', function () {
    $('#modalError').removeClass('show').hide();
    $('#dramatic-form').submit();
  });

  $('#modalConfirmYes').on('click', function () {
    $('#modalConfirm').removeClass('show').hide();
    const token = pendingCaptchaToken;
    pendingCaptchaToken = '';
    prepareAndSubmitData(token);
  });

  $('#modalConfirmNo').on('click', function () {
    pendingCaptchaToken = '';
    $('#modalConfirm').removeClass('show').hide();
  });
}

// ===== FIELD VALIDATION =====
function validateDeclaracionVeracidad() {
  const $group = $('#declaracion-veracidad-group');
  if (!$group.length) return true;

  const checked = $('#declaracion-veracidad').is(':checked');
  $group.toggleClass('has-error', !checked);
  return checked;
}

function cleanRut(raw) {
  return String(raw || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

function computeRutDv(bodyDigits) {
  let sum = 0;
  let multiplier = 2;
  for (let i = bodyDigits.length - 1; i >= 0; i--) {
    sum += parseInt(bodyDigits[i], 10) * multiplier;
    multiplier = (multiplier === 7) ? 2 : (multiplier + 1);
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

function isValidRut(raw) {
  const cleaned = cleanRut(raw);
  if (cleaned.length < 2) return false;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  if (!/^[0-9K]$/.test(dv)) return false;
  if (body.length < 6 || body.length > 9) return false;
  return computeRutDv(body) === dv;
}

function formatRut(raw) {
  const cleaned = cleanRut(raw);
  if (cleaned.length < 2) return '';
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  const reversed = body.split('').reverse();
  const parts = [];
  for (let i = 0; i < reversed.length; i += 3) {
    parts.push(reversed.slice(i, i + 3).reverse().join(''));
  }
  return `${parts.reverse().join('.')}-${dv}`;
}

function formatearRut(rut) {
  const rutLimpio = String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
  if (rutLimpio.length <= 1) return rutLimpio;

  const numero = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1);

  let numeroFormateado = '';
  for (let i = 0; i < numero.length; i++) {
    if (i > 0 && (numero.length - i) % 3 === 0) {
      numeroFormateado += '.';
    }
    numeroFormateado += numero[i];
  }

  return `${numeroFormateado}-${dv}`;
}

function setupRutFormatting() {
  const rutInput = document.getElementById('declarante-rut');
  if (!rutInput) return;

  rutInput.addEventListener('input', function (e) {
    const cursorPosition = e.target.selectionStart;
    const oldValue = e.target.value;
    const newValue = formatearRut(oldValue);

    e.target.value = newValue;

    const diff = newValue.length - oldValue.length;
    const nextPos = Math.max(0, (cursorPosition || 0) + diff);
    try {
      e.target.setSelectionRange(nextPos, nextPos);
    } catch (_) { }
  });
}

function validateField($field) {
  const $formGroup = $field.closest('.form-group');
  const rawValue = $field.val();
  const value = (typeof rawValue === 'string') ? rawValue.trim() : '';
  const isRequired = $field.prop('required');
  let isValid = true;

  // Remove previous validation classes
  $formGroup.removeClass('has-error');
  $field.removeClass('error valid');

  // Check if required field is empty
  if (isRequired && !value) {
    isValid = false;
  }

  // Validate number ranges
  if ($field.attr('type') === 'number' && value) {
    const min = parseFloat($field.attr('min'));
    const max = parseFloat($field.attr('max'));
    const numValue = parseFloat(value);

    if (numValue < min || numValue > max) {
      isValid = false;
    }
  }

  // Validate maxlength
  if ($field.attr('maxlength') && value.length > parseInt($field.attr('maxlength'))) {
    isValid = false;
  }

  const fieldId = $field.attr('id');
  if (fieldId === 'declarante-correo' && value) {
    const el = $field[0];
    if (!(el && typeof el.checkValidity === 'function' && el.checkValidity())) {
      isValid = false;
    }
  }

  if (fieldId === 'declarante-rut' && value) {
    if (!isValidRut(value)) {
      isValid = false;
    } else {
      const el = $field[0];
      if (document.activeElement !== el) {
        $field.val(formatRut(value));
      }
    }
  }

  // Apply validation classes
  if (!isValid) {
    $formGroup.addClass('has-error');
    $field.addClass('error');
  } else if (value) {
    $field.addClass('valid');
  }

  return isValid;
}

function ensureCustomAutorInMemory(autorId) {
  const id = (typeof autorId === 'string') ? autorId.trim() : '';
  if (!id) return;

  const exists = autoresData.some(a => a && a.id === id);
  if (exists) return;

  const nombre = decryptIfEncrypted(id);
  autoresData.push({
    id,
    text: nombre,
    emailEnc: ''
  });
}

function ensureCustomAutorInAllSelects(autorId) {
  const id = (typeof autorId === 'string') ? autorId.trim() : '';
  if (!id) return;

  const nombre = decryptIfEncrypted(id);
  const selects = document.querySelectorAll('select.select2-participacion');
  selects.forEach(sel => {
    if (sel.querySelector(`option[value="${CSS.escape(id)}"]`)) return;
    sel.add(new Option(nombre, id, false, false));
  });
}

// ===== PARTICIPACIONES MANAGEMENT =====
function addInitialParticipacion() {
  addParticipacion();
  actualizarListaParticipantesNotificacion();
}

function addParticipacion() {
  const rowIndex = participacionesData.length;

  const rowHtml = `
    <tr data-index="${rowIndex}">
      <td>
        <select class="form-control participacion-clase" data-index="${rowIndex}" required>
          <option value="">Seleccione clase</option>
          <option value="Texto">Texto</option>
          <option value="Coreografía">Coreografía</option>
          <option value="Música">Música</option>
          <option value="Traducción">Traducción</option>
          <option value="Adaptación">Adaptación</option>
        </select>
      </td>
      <td>
        <select class="form-control participacion-autor select2-participacion" data-index="${rowIndex}" required>
          <option value="">Seleccione autor</option>
        </select>
      </td>
      <td>
        <input type="number" class="form-control participacion-porcentaje" data-index="${rowIndex}" 
               min="0" max="100" step="0.01" placeholder="0" required>
      </td>
      <td>
        <button type="button" class="btn-eliminar-participacion" data-index="${rowIndex}">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `;

  $('#participaciones-tbody').append(rowHtml);

  // Initialize Select2 for the new author dropdown
  const $authorSelect = $(`.select2-participacion[data-index="${rowIndex}"]`);
  autoresData.forEach(autor => {
    $authorSelect.append(new Option(autor.text, autor.id, false, false));
  });
  $authorSelect.select2({
    placeholder: 'Seleccione autor',
    allowClear: true,
    width: '100%',
    tags: true,
    selectOnClose: true,
    createTag: function (params) {
      const term = (params && typeof params.term === 'string') ? params.term.trim() : '';
      if (!term) return null;

      const id = normalizeEncrypted(term);
      if ($authorSelect.find(`option[value="${id}"]`).length) return null;

      return {
        id,
        text: term,
        newTag: true
      };
    }
  });

  // Add to data array
  participacionesData.push({
    clase: '',
    autor: '',
    porcentaje: 0
  });

  // Setup event listeners for this row
  $(`.participacion-clase[data-index="${rowIndex}"]`).on('change', function () {
    updateParticipacionData(rowIndex, 'clase', $(this).val());
    validateParticipaciones();
  });

  $(`.participacion-autor[data-index="${rowIndex}"]`).on('change', function () {
    const autorId = $(this).val();
    updateParticipacionData(rowIndex, 'autor', autorId);
    ensureCustomAutorInMemory(autorId);
    ensureCustomAutorInAllSelects(autorId);
    actualizarListaParticipantesNotificacion();
  });

  $(`.participacion-porcentaje[data-index="${rowIndex}"]`).on('input change', function () {
    updateParticipacionData(rowIndex, 'porcentaje', parseFloat($(this).val()) || 0);
    validateParticipaciones();
  });

  $(`.btn-eliminar-participacion[data-index="${rowIndex}"]`).on('click', function () {
    removeParticipacion(rowIndex);
  });

  actualizarListaParticipantesNotificacion();
}

function updateParticipacionData(index, field, value) {
  if (participacionesData[index]) {
    participacionesData[index][field] = value;
  }
}

function removeParticipacion(index) {
  // Don't allow removing the last participacion
  const activeRows = $('#participaciones-tbody tr').length;
  if (activeRows <= 1) {
    showMessage('Debe haber al menos una participación', 'error');
    return;
  }

  // Remove from DOM
  $(`tr[data-index="${index}"]`).fadeOut(300, function () {
    $(this).remove();
    validateParticipaciones();
    actualizarListaParticipantesNotificacion();
  });

  // Mark as deleted in data (we'll filter these out when submitting)
  if (participacionesData[index]) {
    participacionesData[index].deleted = true;
  }
}

function validateParticipaciones() {
  const participacionesPorClase = {};
  let hasError = false;
  let errorMessage = '';

  // Group participations by clase
  participacionesData.forEach((p, index) => {
    if (p.deleted) return;

    const clase = $(`.participacion-clase[data-index="${index}"]`).val();
    const porcentaje = parseFloat($(`.participacion-porcentaje[data-index="${index}"]`).val()) || 0;

    if (clase) {
      if (!participacionesPorClase[clase]) {
        participacionesPorClase[clase] = 0;
      }
      participacionesPorClase[clase] += porcentaje;
    }
  });

  // Validate that no clase exceeds 100%
  Object.keys(participacionesPorClase).forEach(clase => {
    if (participacionesPorClase[clase] > 100) {
      hasError = true;
      errorMessage = `La suma de porcentajes para "${clase}" excede el 100% (actual: ${participacionesPorClase[clase].toFixed(2)}%)`;
    }
  });

  // Display error or summary
  if (hasError) {
    $('#participaciones-error').text(errorMessage).show();
    $('#participacion-resumen').removeClass('show');
  } else {
    $('#participaciones-error').hide();

    // Show summary if there are participations
    if (Object.keys(participacionesPorClase).length > 0) {
      let summaryHtml = '<h4>Resumen de Participaciones:</h4><ul>';
      Object.keys(participacionesPorClase).forEach(clase => {
        summaryHtml += `<li><strong>${clase}:</strong> ${participacionesPorClase[clase].toFixed(2)}%</li>`;
      });
      summaryHtml += '</ul>';
      $('#participacion-resumen').html(summaryHtml).addClass('show');
    }
  }

  return !hasError;
}

// ===== FILE UPLOAD =====
function handleFileUpload(e) {
  const file = e.target.files[0];

  if (!file) return;

  // Validate file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    showMessage('Formato de archivo no permitido. Use PNG, JPG o JPEG.', 'error');
    e.target.value = '';
    return;
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    showMessage('El archivo excede el tamaño máximo de 5MB.', 'error');
    e.target.value = '';
    return;
  }

  // Store file
  selectedSignatureFile = file;

  // Show preview
  const reader = new FileReader();
  reader.onload = function (event) {
    $('#firma-image').attr('src', event.target.result);
    $('#firma-filename').text(file.name);
    $('#firma-filesize').text(formatFileSize(file.size));
    $('#firma-preview').fadeIn(300);
    $('.file-input-label').hide();
  };
  reader.readAsDataURL(file);
}

function removeSignatureFile() {
  selectedSignatureFile = null;
  $('#firma-file').val('');
  $('#firma-preview').fadeOut(300);
  $('.file-input-label').show();
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ===== FORM SUBMISSION =====
function handleFormSubmit(e) {
  e.preventDefault();

  // Validate all fields
  let isValid = true;
  const captchaToken = getCaptchaToken();

  // Validate regular form fields
  $('.form-control[required]').each(function () {
    if (!validateField($(this))) {
      isValid = false;
    }
  });

  // Validate participaciones
  const activeParticipaciones = participacionesData.filter(p => !p.deleted);
  if (activeParticipaciones.length === 0) {
    showMessage('Debe agregar al menos una participación', 'error');
    isValid = false;
  }

  if (!validateParticipaciones()) {
    isValid = false;
  }

  if (!validateDeclaracionVeracidad()) {
    showMessage('Debe aceptar la declaración de veracidad', 'error');
    isValid = false;
  }

  if (!captchaToken || !validateCaptcha()) {
    showMessage('Debe completar la verificación', 'error');
    isValid = false;
  }

  if (!isValid) {
    showMessage('Por favor, complete todos los campos obligatorios correctamente', 'error');
    // Scroll to first error
    $('html, body').animate({
      scrollTop: $('.has-error').first().offset().top - 100
    }, 500);
    return;
  }

  pendingCaptchaToken = captchaToken;
  showConfirmModal();
}

async function prepareAndSubmitData(captchaToken) {
  // Show loading overlay
  $('#loadingOverlay').show();

  try {
    let signatureBase64 = null;
    if (selectedSignatureFile) {
      signatureBase64 = await fileToBase64(selectedSignatureFile);
    }

    // Prepare participaciones data
    const participaciones = [];
    const correosUnicos = new Set();
    const correosAdicionalesUsados = {};
    participacionesData.forEach((p, index) => {
      if (p.deleted) return;

      const clase = $(`.participacion-clase[data-index="${index}"]`).val();
      const autorNombre = $(`.participacion-autor[data-index="${index}"]`).val();
      const porcentaje = parseFloat($(`.participacion-porcentaje[data-index="${index}"]`).val()) || 0;

      if (clase && autorNombre && porcentaje > 0) {
        // Find author email from autoresData
        const autorData = autoresData.find(a => a.id === autorNombre);
        const autorNombrePlain = decryptIfEncrypted(autorNombre);
        const autorCorreoDirectorio = autorData ? decryptIfEncrypted(autorData.emailEnc) : '';
        let autorCorreoFinal = (typeof autorCorreoDirectorio === 'string') ? autorCorreoDirectorio.trim() : '';

        if (!autorCorreoFinal) {
          const correoManual = correosAdicionales[autorNombrePlain];
          if (isLikelyEmail(correoManual)) {
            autorCorreoFinal = String(correoManual).trim();
            correosAdicionalesUsados[autorNombrePlain] = autorCorreoFinal;
          }
        }

        if (autorCorreoFinal) {
          correosUnicos.add(autorCorreoFinal);
        }

        participaciones.push({
          clase: clase,
          autorNombre: autorNombrePlain,
          autorCorreo: autorCorreoFinal,
          porcentaje: porcentaje
        });
      }
    });

    // Prepare form data
    const formData = {
      tituloObra: $('#titulo-obra').val().trim(),
      tituloOriginal: $('#titulo-original').val().trim() || null,
      otroTitulo: $('#otro-titulo').val().trim() || null,
      genero: $('#genero-obra').val(),
      declaranteNombre: $('#declarante-nombre').val().trim(),
      declaranteRut: $('#declarante-rut').val().trim(),
      declaranteCorreo: $('#declarante-correo').val().trim(),
      fechaCreacionFormulario: formCreationDate || formatDateDMY(new Date()),
      duracionObra: parseInt($('#duracion-obra').val()),
      numeroActos: parseInt($('#numero-actos').val()),
      duracionMusica: parseInt($('#duracion-musica').val()),
      duracionTexto: parseInt($('#duracion-texto').val()),
      fechaEstreno: $('#fecha-estreno').val(),
      lugarEstreno: $('#lugar-estreno').val().trim(),
      numeroInscripcion: $('#numero-inscripcion').val().trim() || null,
      fechaInscripcion: $('#fecha-inscripcion').val() || null,
      participaciones: participaciones,
      correosAdicionales: correosAdicionalesUsados,
      correosUnicos: Array.from(correosUnicos),
      lugarEspecifico: $('#lugar-especifico').val().trim() || null,
      observacionesAlcance: $('#observaciones-alcance').val().trim() || null,
      captchaToken: captchaToken
    };

    if (selectedSignatureFile && signatureBase64) {
      formData.firmaBase64 = signatureBase64;
      formData.firmaFilename = selectedSignatureFile.name;
      formData.firma = {
        base64: signatureBase64,
        name: selectedSignatureFile.name,
        size: selectedSignatureFile.size,
        type: selectedSignatureFile.type
      };
    }

    // Submit to Power Automate
    await submitToPowerAutomate(formData);

  } catch (error) {
    console.error('Error preparing data:', error);
    $('#loadingOverlay').hide();
    showErrorModal('Error al preparar los datos: ' + error.message);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Remove the data URL prefix to get just the base64 string
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function submitToPowerAutomate(data) {
  try {
    const response = await fetch(POWER_AUTOMATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    $('#loadingOverlay').hide();

    if (response.ok) {
      showSuccessModal();
    } else {
      const errorText = await response.text();
      showErrorModal('Error del servidor: ' + errorText);
    }
  } catch (error) {
    $('#loadingOverlay').hide();
    console.error('Error submitting to Power Automate:', error);
    showErrorModal('Error de conexión: ' + error.message);
  }
}

// ===== MODALS =====
function showSuccessModal() {
  $('#modalExito').addClass('show').show();
}

function showErrorModal(message) {
  $('#error-message-text').text(message);
  $('#modalError').addClass('show').show();
}

function showConfirmModal() {
  $('#modalConfirm').addClass('show').show();
}

// ===== MESSAGES =====
function showMessage(message, type) {
  const $message = $('#form-message');
  $message.removeClass('success error').addClass(type).text(message).show();

  // Auto-hide after 5 seconds
  setTimeout(() => {
    $message.fadeOut();
  }, 5000);

  // Scroll to message
  $('html, body').animate({
    scrollTop: $message.offset().top - 100
  }, 500);
}

// ===== FORM RESET =====
function resetForm() {
  // Reset form
  $('#dramatic-form')[0].reset();

  // Clear participaciones
  participacionesData = [];
  correosAdicionales = {};
  $('#participaciones-tbody').empty();
  addInitialParticipacion();

  // Clear signature
  removeSignatureFile();

  // Clear validation classes
  $('.form-control').removeClass('error valid');
  $('.form-group').removeClass('has-error');

  // Clear messages
  $('#form-message').hide();
  $('#participaciones-error').hide();
  $('#participacion-resumen').removeClass('show');
  $('#captcha-group').removeClass('has-error');
  turnstileToken = '';

  if (window.turnstile && typeof window.turnstile.reset === 'function') {
    try {
      window.turnstile.reset();
    } catch (_) { }
  }

  // Scroll to top
  $('html, body').animate({ scrollTop: 0 }, 500);
}

// ===== UTILITY FUNCTIONS =====
// Function to load JSON from file (for future use)
async function loadJSONFromFile(filePath) {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading JSON file:', error);
    return [];
  }
}

// Prevent form submission on Enter key (except in textareas)
$(document).on('keypress', 'input:not(textarea)', function (e) {
  if (e.which === 13) {
    e.preventDefault();
    return false;
  }
});
