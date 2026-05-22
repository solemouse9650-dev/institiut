# Migración del panel a Firebase (vanilla JS, sin cambiar UI)

Este panel mantiene el **mismo HTML/CSS/UI**, pero ahora:

- Login: **Firebase Authentication** (email/contraseña)
- Datos: **Firestore** (colecciones reales + tiempo real con `onSnapshot`)
- Sin `localStorage` para datos (solo queda `localStorage` para el tema dark/light)

## 1) Firebase Console: pasos obligatorios

### A) Authentication
1. Firebase Console → **Authentication** → **Get started**
2. **Sign-in method** → habilitar **Email/Password**
3. **Users** → **Add user** → creá el usuario admin (email + contraseña)

### B) Firestore
1. Firebase Console → **Firestore Database** → **Create database**
2. Modo: production (recomendado)

### C) Reglas de seguridad (Firestote rules)
En Firestore → **Rules**, pegá el contenido de `firestore.rules`.

Archivo: `firestore.rules`

## 2) “Protección admin” (muy importante)

Las reglas requieren que exista:

`/admins/{uid}`

Pasos:
1. Logueate una vez con el usuario creado (para obtener su UID en Authentication → Users).
2. En Firestore → **Data** → creá la colección **admins**
3. Crear documento con ID = **UID** del usuario
4. Contenido recomendado:

```json
{
  "role": "admin",
  "createdAt": "serverTimestamp"
}
```

> Nota: por seguridad, las reglas **no permiten** crear/editar admins desde el panel.

## 3) Configuración del frontend (firebaseConfig)

Editá:
`js/firebase.js`

y reemplazá:

```js
apiKey: 'REEMPLAZAR_API_KEY',
authDomain: 'REEMPLAZAR_AUTH_DOMAIN',
projectId: 'REEMPLAZAR_PROJECT_ID',
storageBucket: 'REEMPLAZAR_STORAGE_BUCKET',
messagingSenderId: 'REEMPLAZAR_MESSAGING_SENDER_ID',
appId: 'REEMPLAZAR_APP_ID'
```

con tu config real (Firebase Console → Project settings → Your apps → SDK setup and configuration).

## 4) Colecciones usadas (Firestore)

- `alumnos`
- `cursos`
- `docentes`
- `horarios`

### Estructura sugerida para horarios
Cada documento en `horarios`:

```json
{
  "day": 0,
  "slot": "16:00",
  "cursoId": "ID_DOC_CURSO",
  "docenteId": "ID_DOC_DOCENTE"
}
```

Donde:
- `day`: 0=Lunes ... 5=Sábado
- `slot`: uno de: `08:00`, `10:00`, `16:00`, `17:30`, `19:00`
- `cursoId` y `docenteId`: IDs reales de documentos en `cursos` y `docentes`

Si `horarios` está vacío, el panel usa el **fallback** actual (grilla derivada de cursos) para no romper el diseño.

## 5) Migrar datos demo a Firestore

En el panel:
Configuración → **Restaurar datos demo**

Ahora este botón **carga los datos demo en Firebase** (sin borrar lo existente).

## 6) Import / Export JSON

- **Exportar JSON**: descarga un backup real desde Firestore.
- **Importar JSON**: sube el JSON a Firestore (modo merge por defecto).

## 7) Importante para probar local

Firebase (imports ESM) NO funciona bien abriendo `admin.html` con `file://`.

Para probar local, usá un servidor simple:
- VSCode: extensión “Live Server”
- o `npx serve` en la carpeta

## 8) Deploy en Vercel

1. Subí este proyecto a GitHub (o arrastrá la carpeta en Vercel).
2. En Vercel: **New Project** → framework = **Other** / “Static”
3. Output: estático (no necesita build).
4. Deploy.

> No hace falta setear variables de entorno si dejás la config hardcodeada en `js/firebase.js`.

