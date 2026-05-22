/**
 * Google Apps Script (Code.gs)
 * Hoja destino: "Solicitud inscripcion"
 *
 * 1) Abrí Google Sheets (en blanco) o una planilla existente.
 * 2) Extensiones → Apps Script
 * 3) Pegá este código en Code.gs (reemplazando lo que haya)
 * 4) Implementar → Nueva implementación → "Aplicación web"
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquiera
 * 5) Copiá la URL que termina en /exec y pegala en index.html:
 *    const INSCRIPCION_SHEETS_WEBAPP_URL='.../exec'
 */

const SHEET_NAME = 'Solicitud inscripcion';

function doGet() {
  return ContentService
    .createTextOutput('OK')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const data = (e && e.parameter) ? e.parameter : {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet_(ss, SHEET_NAME);
    ensureHeader_(sheet);

    const row = [
      new Date(),                       // Timestamp
      data.nombre || '',
      data.edad || '',
      data.telefono || '',
      data.nivel || '',
      data.email || '',
      data.curso || '',
      data.observaciones || '',
      data.origen || '',
      data.userAgent || ''
    ];

    sheet.appendRow(row);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function getOrCreateSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    'Fecha',
    'Nombre',
    'Edad',
    'Teléfono',
    'Nivel de inglés',
    'Email',
    'Curso de interés',
    'Observaciones',
    'Origen',
    'User Agent'
  ]);
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

