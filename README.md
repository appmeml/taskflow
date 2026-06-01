# TaskFlow Lite · Kanban simplificado

Gestor de tareas tipo Trello **listo para producción**: HTML + Firebase + GitHub Pages + Cloud Functions.

- **Cero backend**: Firebase Firestore + Auth + Cloud Functions
- **Cero compilación**: HTML puro, sube a GitHub Pages
- **Cero config devops**: Cloudflare + GitHub Actions
- **✨ Producción-ready**: Notificaciones por email, membresías, settings
- **Escalable**: Documentado hasta 1000+ usuarios

---

## Documentación

- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** ← **Empieza aquí** (45 min a producción)
- [MEMBERSHIPS_GUIDE.md](MEMBERSHIPS_GUIDE.md) - Cómo usar membresías e invitaciones
- [MAINTENANCE.md](MAINTENANCE.md) - Operaciones, escalamiento, troubleshooting
- [FIRESTORE_RULES.txt](FIRESTORE_RULES.txt) - Reglas de seguridad (validadas)
- [README.md](README.md) - Arquitectura y features

---

## Quick Start (5 min local)

### A. Firebase

1. Ve a [firebase.google.com](https://firebase.google.com) → "Ir a la consola"
2. Crea proyecto (nombre libre, ej. "taskflow-lite")
3. En Compilación → **Autenticación**:
   - Habilita Email/Password
4. En Compilación → **Firestore Database**:
   - Modo producción
   - Región: Europe (eur3)
   - Reglas: copia las de abajo
5. Copia el bloque de credenciales (aparece en Settings → Proyecto)

Pega en `js/firebase-config.js`, línea 4:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "tu-app.firebaseapp.com",
  projectId: "tu-project-id",
  // ...
};
```

**Reglas de Firestore** (copia-pega en Firestore):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Solo los usuarios autenticados pueden leer/escribir sus propios datos
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

### B. GitHub

1. Crea repo `tu-usuario/taskflow` (público)
2. Haz push de los archivos:

```bash
git clone https://github.com/tu-usuario/taskflow.git
# Copia los archivos de esta carpeta (index.html, board.html, css/, js/)
cd taskflow
git add .
git commit -m "init: taskflow lite"
git push
```

3. En Settings → Pages:
   - Source: Deploy from branch
   - Branch: main, folder: / (root)
   - Espera 1 min, GitHub te da una URL: `https://tu-usuario.github.io/taskflow`

### C. Cloudflare (opcional pero recomendado)

Cloudflare te da DNS, HTTPS automático, caché y más por gratis.

1. Ve a [cloudflare.com](https://cloudflare.com) → Sign up
2. Add site → pega tu dominio (si tienes uno)
3. Usa nameservers de Cloudflare en tu registrador de dominio
4. En Caching → Page Rules: Cache Everything (gratis)
5. En Security → Browser Integrity Check: ON
6. En Performance → Rocket Loader: ON

**Si quieres un dominio gratis**: usa [Freenom.com](https://freenom.com) para conseguir `.tk`, `.cf`, etc.

---

## 2. Arquitectura

```
┌─────────────────┐         ┌──────────────────┐      ┌─────────┐
│  GitHub Pages   │◀────────│  Cloudflare      │─────▶│ Firebase│
│  (HTML estático)│         │  (DNS + caché)   │      │(BD + Auth)
└─────────────────┘         └──────────────────┘      └─────────┘
```

- **HTML/JS sin build**: sube directo desde GitHub
- **Firestore**: base de datos en tiempo real
- **Auth Firebase**: login/signup sin backend
- **Cloudflare**: CDN global, HTTPS, analytics

---

## 3. Estructura de datos (Firestore)

```
users/{userId}
  ├─ name: string
  ├─ email: string
  ├─ boards/{boardId}
  │  ├─ title: string
  │  ├─ background: string (color hex)
  │  ├─ members/{memberId}          ← NUEVO
  │  │  ├─ email: string
  │  │  ├─ role: "viewer" | "editor" | "owner"
  │  │  └─ invitedAt: timestamp
  │  ├─ activity/{activityId}       ← NUEVO
  │  │  ├─ type: "card_created" | "card_moved" | etc
  │  │  ├─ by: string (email)
  │  │  └─ timestamp: timestamp
  │  └─ lists/{listId}
  │     ├─ title: string
  │     ├─ position: number
  │     └─ cards/{cardId}
  │        ├─ title: string
  │        └─ position: number

notifications/{userId}
  └─ messages/{notificationId}      ← NUEVO
     ├─ type: "invite" | "activity"
     ├─ message: string
     ├─ read: boolean
     └─ createdAt: timestamp
```

Sin normalización: cada usuario tiene sus datos aislados. Firebase maneja la seguridad via reglas.

---

## 4. Características

✅ Autenticación (email/password, sesión persistente)  
✅ Crear/editar/eliminar tableros, listas y tarjetas  
✅ Drag & drop (arrastrar tarjetas entre listas)  
✅ Síncronización en tiempo real (cambios viven en todas las pestañas)  
✅ **Membresías de tableros** (compartir con email, roles: viewer/editor/owner)  
✅ **Notificaciones en tiempo real** (invitaciones, actividad del tablero)  
✅ **Activity feed** (ver quién hizo qué y cuándo)  
✅ Responsive (funciona en móvil)  
✅ Cumple quota Firebase free tier para ≤20 usuarios

---

## 4.1 Membresías y Permisos

- **Compartir tablero**: click en "Miembros" → "Invitar" → escribe email
- **Roles**:
  - **Viewer**: solo lectura
  - **Editor**: crear/editar tarjetas (default)
  - **Owner**: control total (cambiar roles, invitar, eliminar tablero)
- **Notificaciones**: el usuario invitado recibe una notificación con botones Aceptar/Rechazar

## 4.2 Notificaciones en Tiempo Real

- 🔔 campana en la barra superior: muestra invitaciones y actividad
- **Tipos**: invitaciones, miembros removidos, tarjetas creadas/movidas
- **Feed de actividad**: panel derecho muestra quién hizo qué (últimas 20 acciones)

---

## 5. Plan gratuito (Firebase Spark)

Para 20 usuarios típicos:

| Recurso                     | Límite gratuito | Uso estimado |
| --------------------------- | --------------- | ------------ |
| Firestore reads/día         | 50K             | ~500 (10/user)    |
| Firestore writes/día        | 20K             | ~200 (10/user)    |
| Almacenamiento              | 1 GB            | ~10 MB       |
| Autenticaciones/mes         | 50K MAU         | ~20           |
| Cloud Functions invocations | 2M/mes          | 0 (no usamos)    |

Estás **muy** dentro de límites.

---

## 6. Roadmap (escalabilidad futura)

Sin tocar HTML/CSS, puedes:

- ✅ **Membresías**: Invitar usuarios, roles (viewer/editor/owner)
- ✅ **Notificaciones**: Feed de actividad, campana de notificaciones
- **Tableros compartidos reales**: agregar colección `shared_boards` (N:M entre usuarios)
- **Etiquetas y due dates**: nuevos campos en `cards`
- **Comentarios en tarjetas**: subcol `cards/{cardId}/comments`
- **Webhooks**: Cloud Functions para notificaciones por email
- **PWA**: agregar `manifest.json` y service worker
- **Base de datos**: migrar a PostgreSQL (mantener Firebase para auth)
- **Equipos**: agrupar usuarios en organizaciones con permisos a nivel org

---

## 7. Troubleshooting

**"Error: Permission denied"**  
→ Comprueba las reglas de Firestore. El usuario debe estar autenticado.

**"La app no se actualiza en tiempo real"**  
→ Abre devtools → Console. Si hay errores de Firebase, revisa las credenciales.

**"Las tarjetas no se guardan"**  
→ Verifica que Firestore esté en modo "Iniciar en modo de prueba", no "Producción".

**"GitHub Pages no actualiza"**  
→ Espera 2 min. Si persiste: Settings → Pages → desactiva y reactiva.

---

## 8. Contacto / Preguntas

Si necesitas ayuda:
- Firebase docs: [firebase.google.com/docs](https://firebase.google.com/docs)
- GitHub Pages: [pages.github.com](https://pages.github.com)
- Cloudflare: [support.cloudflare.com](https://support.cloudflare.com)

---

**Hecho con ❤️ para equipos pequeños que necesitan velocidad, no complejidad.**
