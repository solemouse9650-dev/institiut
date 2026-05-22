import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

import { db } from './firebase.js';

export const col = {
  alumnos: collection(db, 'alumnos'),
  cursos: collection(db, 'cursos'),
  docentes: collection(db, 'docentes'),
  horarios: collection(db, 'horarios'),
  admins: collection(db, 'admins') // opcional: protección extra
};

export function listenCollection(name, cb, opts = {}) {
  const { sortField = null, sortDir = 'desc' } = opts;
  const q = sortField
    ? query(collection(db, name), orderBy(sortField, sortDir))
    : query(collection(db, name));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cb(items);
  });
}

export async function createDoc(name, data) {
  const payload = {
    ...sanitize_(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, name), payload);
  return ref.id;
}

export async function updateDocById(name, id, data) {
  const payload = {
    ...sanitize_(data),
    updatedAt: serverTimestamp()
  };
  await updateDoc(doc(db, name, id), payload);
}

export async function deleteDocById(name, id) {
  await deleteDoc(doc(db, name, id));
}

export async function dumpAll() {
  const [alumnos, cursos, docentes, horarios] = await Promise.all([
    getDocs(col.alumnos),
    getDocs(col.cursos),
    getDocs(col.docentes),
    getDocs(col.horarios)
  ]);
  const mapDocs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return {
    alumnos: mapDocs(alumnos),
    cursos: mapDocs(cursos),
    docentes: mapDocs(docentes),
    horarios: mapDocs(horarios)
  };
}

// Importación: escribe en batch. Por seguridad, no borra lo existente automáticamente.
export async function importData(data, { overwrite = false } = {}) {
  const batch = writeBatch(db);
  const apply = (name, arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((item) => {
      const { id, createdAt, updatedAt, ...rest } = item || {};
      const ref = id ? doc(db, name, String(id)) : doc(collection(db, name));
      if (overwrite) {
        batch.set(ref, { ...sanitize_(rest), updatedAt: serverTimestamp(), createdAt: serverTimestamp() });
      } else {
        batch.set(ref, { ...sanitize_(rest), updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true });
      }
    });
  };
  apply('alumnos', data.alumnos);
  apply('cursos', data.cursos);
  apply('docentes', data.docentes);
  apply('horarios', data.horarios);
  await batch.commit();
}

// Sanitización muy básica (evita null/undefined, trim strings)
function sanitize_(obj) {
  const out = {};
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === 'string') out[k] = v.trim();
    else out[k] = v;
  });
  return out;
}
