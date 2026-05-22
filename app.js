import { loginWithEmail, logout, listenAuth } from './auth.js';
import { listenCollection, createDoc, updateDocById, deleteDocById, dumpAll, importData } from './firestore.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { db } from './firebase.js';

(function () {
  'use strict';

  // =========================
  // Helpers DOM / UI (igual que tu panel)
  // =========================
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  let state = { alumnos: [], cursos: [], docentes: [], horarios: [] };
  let sortState = {};
  let editing = { type: null, id: null };

  function toast(msg, type = 'success') {
    const c = $('#toastContainer');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function showApp(show) {
    $('#loginScreen').classList.toggle('hidden', show);
    $('#appShell').classList.toggle('hidden', !show);
  }

  function setLoading(loading) {
    $('#appLoader')?.classList.toggle('done', !loading);
  }

  // =========================
  // Auth (Firebase)
  // =========================
  // Para mantener el input "Usuario" sin cambiar UI:
  // - Si escribís un EMAIL, se usa tal cual.
  // - Si escribís "cambridge_admin", se transforma en "cambridge_admin@institiut.local"
  //   (tenés que crear ese usuario en Firebase Auth con ese email).
  const USERNAME_LOGIN_DOMAIN = 'institiut.local';
  function normalizeLoginEmail(userInput) {
    const v = (userInput || '').trim();
    if (!v) return '';
    if (v.includes('@')) return v;
    return `${v}@${USERNAME_LOGIN_DOMAIN}`;
  }

  async function ensureAdmin_(user) {
    // Protección admin: debe existir el doc admins/{uid}
    // Si no querés esta protección, podés comentar todo este try/catch y devolver true.
    try {
      const ref = doc(db, 'admins', user.uid);
      const snap = await getDoc(ref);
      return snap.exists();
    } catch {
      return false;
    }
  }

  $('#loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = normalizeLoginEmail($('#loginUser').value);
    const pass = $('#loginPass').value || '';
    const err = $('#loginError');
    err.textContent = '';

    try {
      setLoading(true);
      await loginWithEmail(email, pass);
      // onAuthStateChanged se encarga de mostrar panel y cargar datos
    } catch (e2) {
      err.textContent = 'Usuario o contraseña incorrectos';
      toast('Acceso denegado', 'error');
      setLoading(false);
    }
  });

  $('#logoutBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await logout();
      toast('Sesión cerrada');
    } catch {
      toast('No se pudo cerrar sesión', 'error');
    }
  });

  // mantener UX actual
  $('#togglePass')?.addEventListener('click', () => {
    const inp = $('#loginPass');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // =========================
  // Sidebar / tema (igual)
  // =========================
  const THEME_KEY = 'cse_theme';
  $$('.sidebar-nav a[data-panel]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const p = a.dataset.panel;
      $$('.sidebar-nav a').forEach((x) => x.classList.remove('active'));
      a.classList.add('active');
      $$('.panel').forEach((x) => x.classList.remove('active'));
      $('#panel-' + p)?.classList.add('active');
      $('#breadcrumbs').innerHTML = 'Panel / <span>' + a.textContent.trim() + '</span>';
      $('#sidebar')?.classList.remove('open');
    })
  );

  $('#sidebarToggle')?.addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  $('#themeToggle')?.addEventListener('click', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
    localStorage.setItem(THEME_KEY, dark ? 'light' : 'dark');
    $('#themeToggle').textContent = dark ? '🌙' : '☀️';
  });
  if (localStorage.getItem(THEME_KEY) === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    $('#themeToggle').textContent = '☀️';
  }

  // =========================
  // Tablas / CRUD (misma UI, datos Firestore)
  // =========================
  function sortData(arr, key, tableId) {
    const st = sortState[tableId] || {};
    const dir = st.key === key && st.dir === 'asc' ? 'desc' : 'asc';
    sortState[tableId] = { key, dir };
    return [...arr].sort((a, b) => {
      let va = (a[key] || '').toString().toLowerCase();
      let vb = (b[key] || '').toString().toLowerCase();
      if (key === 'edad') {
        va = +a.edad;
        vb = +b.edad;
      }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function bindSort(tableId, entity) {
    const table = $(tableId);
    table?.querySelectorAll('th[data-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        renderTable(entity, key, tableId);
        table.querySelectorAll('th').forEach((h) => {
          h.classList.remove('sorted', 'desc');
        });
        th.classList.add('sorted');
        if (sortState[tableId]?.dir === 'desc') th.classList.add('desc');
      });
    });
  }

  function renderTable(entity, sortKey, tableId, filter = '') {
    const cfg = {
      alumno: { data: 'alumnos', table: '#tableAlumnos', cols: ['nombre', 'edad', 'curso', 'nivel', 'telefono', 'email'] },
      curso: { data: 'cursos', table: '#tableCursos', cols: ['nombre', 'horarios', 'aula', 'docente'] },
      docente: { data: 'docentes', table: '#tableDocentes', cols: ['nombre', 'especialidad', 'horarios', 'cursos'] }
    }[entity];

    let rows = state[cfg.data] || [];
    if (filter) {
      const f = filter.toLowerCase();
      rows = rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(f)));
    }
    if (sortKey) rows = sortData(rows, sortKey, cfg.table);

    const tbody = $(cfg.table + ' tbody');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state">Sin registros</div></td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (r) => `<tr>
${cfg.cols.map((c) => `<td>${r[c] ?? ''}</td>`).join('')}
<td class="actions">
<button class="btn-sm secondary" data-edit="${entity}" data-id="${r.id}">Editar</button>
<button class="btn-sm danger" data-del="${entity}" data-id="${r.id}">Eliminar</button>
${entity === 'alumno' ? `<button class="btn-sm primary" data-aviso="${r.id}" title="Avisar a los padres">Avisar a los padres</button>` : ''}
</td></tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openModal(b.dataset.edit, b.dataset.id)));
    tbody.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => confirmDelete(b.dataset.del, b.dataset.id)));
    tbody.querySelectorAll('[data-aviso]').forEach((b) => b.addEventListener('click', () => openAvisoPadres(b.dataset.aviso)));
  }

  function openModal(entity, id) {
    editing = { type: entity, id };
    const forms = {
      alumno: `
<h3>${id ? 'Editar' : 'Nuevo'} Alumno</h3>
<div class="modal-grid">
<div><label>Nombre</label><input id="m_nombre" required></div>
<div><label>Edad</label><input id="m_edad" type="number" min="5" max="99"></div>
<div><label>Curso</label><input id="m_curso"></div>
<div><label>Nivel</label><input id="m_nivel"></div>
<div><label>Teléfono</label><input id="m_telefono"></div>
<div><label>Email</label><input id="m_email" type="email"></div>
</div>`,
      curso: `<h3>${id ? 'Editar' : 'Nuevo'} Curso</h3><div class="modal-grid">
<div><label>Nombre</label><input id="m_nombre" required></div>
<div><label>Horarios</label><input id="m_horarios"></div>
<div><label>Aula</label><input id="m_aula"></div>
<div><label>Docente</label><input id="m_docente"></div></div>`,
      docente: `<h3>${id ? 'Editar' : 'Nuevo'} Docente</h3><div class="modal-grid">
<div><label>Nombre</label><input id="m_nombre" required></div>
<div><label>Especialidad</label><input id="m_especialidad"></div>
<div><label>Horarios</label><input id="m_horarios"></div>
<div><label>Cursos asignados</label><input id="m_cursos"></div></div>`
    };

    $('#modalContent').innerHTML =
      forms[entity] +
      `<div class="modal-actions">
<button class="btn-sm secondary" id="modalCancel">Cancelar</button>
<button class="btn-sm primary" id="modalSave">Guardar</button></div>`;

    if (id) {
      const map = { alumno: 'alumnos', curso: 'cursos', docente: 'docentes' };
      const item = (state[map[entity]] || []).find((x) => String(x.id) === String(id));
      Object.keys(item || {}).forEach((k) => {
        const el = $('#m_' + k);
        if (el) el.value = item[k];
      });
    }

    $('#modalOverlay').classList.add('open');
    $('#modalCancel').onclick = closeModal;
    $('#modalSave').onclick = () => saveModal(entity);
  }

  function closeModal() {
    $('#modalOverlay').classList.remove('open');
    editing = { type: null, id: null };
  }

  async function saveModal(entity) {
    const fields = {
      alumno: ['nombre', 'edad', 'curso', 'nivel', 'telefono', 'email'],
      curso: ['nombre', 'horarios', 'aula', 'docente'],
      docente: ['nombre', 'especialidad', 'horarios', 'cursos']
    }[entity];

    const obj = {};
    fields.forEach((f) => {
      const el = $('#m_' + f);
      if (el) obj[f] = f === 'edad' ? +el.value : el.value.trim();
    });
    if (!obj.nombre) {
      toast('El nombre es obligatorio', 'error');
      return;
    }

    try {
      setLoading(true);
      const collectionName = entity === 'alumno' ? 'alumnos' : entity === 'curso' ? 'cursos' : 'docentes';
      if (editing.id) await updateDocById(collectionName, String(editing.id), obj);
      else await createDoc(collectionName, obj);
      closeModal();
      toast('Guardado correctamente');
    } catch (e) {
      toast('Error al guardar: ' + (e?.message || 'desconocido'), 'error');
    } finally {
      setLoading(false);
    }
  }

  function confirmDelete(entity, id) {
    const map = { alumno: 'alumnos', curso: 'cursos', docente: 'docentes' };
    const item = (state[map[entity]] || []).find((x) => String(x.id) === String(id));
    $('#modalContent').innerHTML = `<div class="confirm-dialog"><h3>Confirmar eliminación</h3>
<p>¿Eliminar <strong>${item?.nombre || 'registro'}</strong>? Esta acción no se puede deshacer.</p>
<div class="modal-actions">
<button class="btn-sm secondary" id="modalCancel">Cancelar</button>
<button class="btn-sm danger" id="modalConfirmDel">Eliminar</button></div></div>`;
    $('#modalOverlay').classList.add('open');
    $('#modalCancel').onclick = closeModal;
    $('#modalConfirmDel').onclick = async () => {
      try {
        setLoading(true);
        const collectionName = entity === 'alumno' ? 'alumnos' : entity === 'curso' ? 'cursos' : 'docentes';
        await deleteDocById(collectionName, String(id));
        closeModal();
        toast('Eliminado', 'success');
      } catch (e) {
        toast('Error al eliminar: ' + (e?.message || 'desconocido'), 'error');
      } finally {
        setLoading(false);
      }
    };
  }

  // WhatsApp “Avisar a los padres” (misma lógica que ya tenías)
  function normalizeWhatsappNumber(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('549')) return d;
    if (d.startsWith('54')) return d;
    if (d.length === 10) return '549' + d;
    if (d.length === 11 && d.startsWith('0')) return '549' + d.slice(1);
    return d;
  }
  function openWhatsapp(rawNumber, text) {
    const number = normalizeWhatsappNumber(rawNumber);
    if (!number) {
      toast('El alumno no tiene teléfono cargado', 'error');
      return;
    }
    const url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(text || '');
    window.open(url, '_blank', 'noopener');
  }
  function openAvisoPadres(alumnoId) {
    const a = (state.alumnos || []).find((x) => String(x.id) === String(alumnoId));
    if (!a) {
      toast('Alumno no encontrado', 'error');
      return;
    }
    $('#modalContent').innerHTML = `
      <h3>Avisar a los padres</h3>
      <div style="color:var(--muted);font-size:.95rem;margin-top:-.25rem">
        Alumno: <strong>${a.nombre || ''}</strong><br>
        Teléfono: <strong>${a.telefono || '(sin cargar)'}</strong>
      </div>
      <div class="modal-actions" style="justify-content:center;flex-wrap:wrap;margin-top:1.25rem">
        <button class="btn-sm secondary" data-aviso-opt="no hizo la tarea">No hizo la tarea</button>
        <button class="btn-sm secondary" data-aviso-opt="faltó a clases">Falto a clases</button>
        <button class="btn-sm secondary" data-aviso-opt="sacó mala nota">Sacó mala nota</button>
      </div>
      <div class="modal-actions" style="margin-top:1.25rem">
        <button class="btn-sm secondary" id="modalCancel">Cerrar</button>
      </div>
    `;
    $('#modalOverlay').classList.add('open');
    $('#modalCancel').onclick = closeModal;
    $('#modalContent')
      .querySelectorAll('[data-aviso-opt]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const opt = btn.getAttribute('data-aviso-opt');
          const msg = `Hola! Queremos avisarles que ${a.nombre} ${opt}.`;
          closeModal();
          openWhatsapp(a.telefono, msg);
        });
      });
  }

  // Dashboard + horarios + búsqueda global (con datos reales en state)
  function renderDashStats() {
    const el = $('#dashStats');
    if (!el) return;
    el.innerHTML = `
    <div class="stat-box"><h3>${state.alumnos.length}</h3><p>Alumnos</p></div>
    <div class="stat-box"><h3>${state.cursos.length}</h3><p>Cursos</p></div>
    <div class="stat-box"><h3>${state.docentes.length}</h3><p>Docentes</p></div>
    <div class="stat-box"><h3>${state.alumnos.filter((a) => a.nivel && String(a.nivel).includes('B')).length}</h3><p>Nivel intermedio+</p></div>`;
  }

  function renderHorarios() {
    const g = $('#horariosGrid');
    const slots = ['08:00', '10:00', '16:00', '17:30', '19:00'];
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    // Si hay horarios reales, los usamos. Si no, mantenemos fallback actual (derivado de cursos).
    const hasReal = Array.isArray(state.horarios) && state.horarios.length > 0;
    const byKey = new Map();
    if (hasReal) {
      state.horarios.forEach((h) => {
        const key = `${h.day}|${h.slot}`;
        byKey.set(key, h);
      });
    }

    let html = '<table><thead><tr><th>Hora</th>' + days.map((d) => `<th>${d}</th>`).join('') + '</tr></thead><tbody>';
    slots.forEach((slot, si) => {
      html += `<tr><td><strong>${slot}</strong></td>`;
      days.forEach((d, di) => {
        let cell = '';
        if (hasReal) {
          const h = byKey.get(`${di}|${slot}`);
          if (h) {
            const curso = state.cursos.find((c) => String(c.id) === String(h.cursoId));
            const docente = state.docentes.find((x) => String(x.id) === String(h.docenteId));
            cell = `${curso ? curso.nombre : ''}${docente ? `<br><small>${docente.nombre}</small>` : ''}`;
          }
        } else {
          const c = state.cursos[(si + di) % Math.max(state.cursos.length, 1)];
          cell = c ? c.nombre + '<br><small>' + (c.horarios || '') + '</small>' : '';
        }
        html += `<td>${cell}</td>`;
      });
      html += '</tr>';
    });
    g.innerHTML = html + '</tbody></table>';
  }

  function globalSearch(q) {
    const el = $('#globalResults');
    if (!q.trim()) {
      el.innerHTML = '<div class="empty-state">Escribí en el buscador para ver resultados</div>';
      return;
    }
    const f = q.toLowerCase();
    const results = [];
    state.alumnos.forEach((a) => {
      if (JSON.stringify(a).toLowerCase().includes(f)) results.push({ tipo: 'Alumno', nombre: a.nombre, detalle: (a.curso || '') + ' · ' + (a.nivel || '') });
    });
    state.cursos.forEach((c) => {
      if (JSON.stringify(c).toLowerCase().includes(f)) results.push({ tipo: 'Curso', nombre: c.nombre, detalle: (c.horarios || '') + ' · ' + (c.docente || '') });
    });
    state.docentes.forEach((d) => {
      if (JSON.stringify(d).toLowerCase().includes(f)) results.push({ tipo: 'Docente', nombre: d.nombre, detalle: d.especialidad || '' });
    });
    if (!results.length) {
      el.innerHTML = '<div class="empty-state">Sin resultados</div>';
      return;
    }
    el.innerHTML =
      '<table><thead><tr><th>Tipo</th><th>Nombre</th><th>Detalle</th></tr></thead><tbody>' +
      results.map((r) => `<tr><td>${r.tipo}</td><td>${r.nombre}</td><td>${r.detalle}</td></tr>`).join('') +
      '</tbody></table>';
  }

  $('#globalSearch')?.addEventListener('input', (e) => globalSearch(e.target.value));

  function refreshAll() {
    renderDashStats();
    renderTable('alumno', null, '#tableAlumnos');
    renderTable('curso', null, '#tableCursos');
    renderTable('docente', null, '#tableDocentes');
    renderHorarios();
  }

  // Toolbar botones (agregar)
  $$('[data-action="add"]').forEach((b) => b.addEventListener('click', () => openModal(b.dataset.entity, null)));
  $('#searchAlumnos')?.addEventListener('input', (e) => renderTable('alumno', null, '#tableAlumnos', e.target.value));
  $('#searchCursos')?.addEventListener('input', (e) => renderTable('curso', null, '#tableCursos', e.target.value));
  $('#searchDocentes')?.addEventListener('input', (e) => renderTable('docente', null, '#tableDocentes', e.target.value));

  bindSort('#tableAlumnos', 'alumno');
  bindSort('#tableCursos', 'curso');
  bindSort('#tableDocentes', 'docente');

  // =========================
  // Export / Import (mantener feature)
  // =========================
  $('#exportBtn')?.addEventListener('click', async () => {
    try {
      setLoading(true);
      const data = await dumpAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'cse_backup_' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      toast('Exportación completada');
    } catch (e) {
      toast('Error al exportar: ' + (e?.message || 'desconocido'), 'error');
    } finally {
      setLoading(false);
    }
  });

  $('#importBtn')?.addEventListener('click', () => $('#importFile').click());
  $('#importFile')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setLoading(true);
        const data = JSON.parse(reader.result);
        await importData(data, { overwrite: false });
        toast('Importación exitosa');
      } catch (err) {
        toast('Error al importar: ' + (err?.message || 'formato inválido'), 'error');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // “Restaurar datos demo” ahora importa demo a Firestore (sin borrar)
  const demoData = {
    alumnos: [
      { nombre: 'Sofía López', edad: 14, curso: 'Adolescentes', nivel: 'B1', telefono: '3755123456', email: 'sofia@email.com' },
      { nombre: 'Juan Pérez', edad: 32, curso: 'Adultos', nivel: 'A2', telefono: '3755987654', email: 'juan@email.com' },
      { nombre: 'Valentina Ruiz', edad: 8, curso: 'Niños', nivel: 'Starter', telefono: '3755111222', email: 'vale@email.com' }
    ],
    cursos: [
      { nombre: 'Niños', horarios: 'Lun/Mié 16:00', aula: 'Aula 1', docente: 'Laura Méndez' },
      { nombre: 'Adolescentes', horarios: 'Mar/Jue 17:30', aula: 'Aula 2', docente: 'James Wilson' },
      { nombre: 'Preparación FCE', horarios: 'Sáb 09:00', aula: 'Lab', docente: 'Ana Rodríguez' }
    ],
    docentes: [
      { nombre: 'Laura Méndez', especialidad: 'Kids & Teens', horarios: 'Lun–Vie tarde', cursos: 'Niños, Adolescentes' },
      { nombre: 'James Wilson', especialidad: 'Adults', horarios: 'Mar/Jue noche', cursos: 'Adultos, Conversación' }
    ],
    horarios: []
  };

  $('#resetBtn')?.addEventListener('click', async () => {
    if (!confirm('¿Cargar datos demo en Firebase? (No borra los existentes)')) return;
    try {
      setLoading(true);
      await importData(demoData, { overwrite: false });
      toast('Datos demo cargados');
    } catch (e) {
      toast('Error cargando demo: ' + (e?.message || 'desconocido'), 'error');
    } finally {
      setLoading(false);
    }
  });

  // =========================
  // Firestore listeners (tiempo real)
  // =========================
  let unsub = [];
  function startRealtime() {
    stopRealtime();
    unsub = [
      listenCollection('alumnos', (items) => {
        state.alumnos = items;
        refreshAll();
      }),
      listenCollection('cursos', (items) => {
        state.cursos = items;
        refreshAll();
      }),
      listenCollection('docentes', (items) => {
        state.docentes = items;
        refreshAll();
      }),
      listenCollection('horarios', (items) => {
        state.horarios = items;
        refreshAll();
      })
    ];
  }
  function stopRealtime() {
    unsub.forEach((u) => {
      try {
        u && u();
      } catch {}
    });
    unsub = [];
  }

  // =========================
  // Init
  // =========================
  setLoading(true);
  listenAuth(
    async (user) => {
      // logged in
      const ok = await ensureAdmin_(user);
      if (!ok) {
        $('#loginError').textContent = 'No tenés permisos de administrador.';
        toast('No autorizado', 'error');
        await logout();
        showApp(false);
        setLoading(false);
        return;
      }
      showApp(true);
      startRealtime();
      refreshAll();
      setLoading(false);
    },
    () => {
      // logged out
      stopRealtime();
      showApp(false);
      setLoading(false);
    }
  );
})();
