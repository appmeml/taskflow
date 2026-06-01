# TaskFlow Lite · Guía de Membresías y Notificaciones

## Membresías (Compartir Tableros)

### Cómo invitar a alguien

1. Abre un tablero
2. Click en el botón **👥 Miembros** (barra superior derecha)
3. Click en **+ Invitar**
4. Escribe el email del usuario que quieres invitar
5. Elige el rol (Visor o Editor)
6. Click "Enviar invitación"

El usuario invitado recibe una **notificación** con la invitación.

### Roles y Permisos

| Rol    | Lectura | Crear | Mover | Editar miembros |
| ------ | ------- | ----- | ----- | --------------- |
| Visor  | ✅      | ❌    | ❌    | ❌              |
| Editor | ✅      | ✅    | ✅    | ❌              |
| Owner  | ✅      | ✅    | ✅    | ✅              |

**Nota**: Por ahora los permisos se aplican en la UI (si eres Viewer, no ves botones de crear). 
En producción real, las reglas de Firestore aplicarían esto server-side.

### Cambiar rol de un miembro

1. Abre Miembros
2. Click en el dropdown del rol (Visor/Editor/Owner)
3. Cambio automático ✓

### Remover miembro

1. Abre Miembros
2. Click el ✕ al lado del nombre
3. El usuario es removido y recibe notificación

---

## Notificaciones

### Cómo funcionan

- 🔔 campana en la barra superior derecha del tablero
- Rojo **badge** = tienes notificaciones sin leer
- Click en la campana = abre el panel

### Tipos de notificaciones

#### 1. Invitaciones
```
"usuario@email.com te invitó a 'Nombre del Tablero'"
```
→ Botones: Aceptar | Rechazar

#### 2. Actividad del tablero
```
"juan@empresa.com creó lista 'Hacer'"
"maria@empresa.com movió tarjeta 'Diseño'"
```
→ Click para marcar como leído

### Activity Feed

En el panel de Miembros, pestaña "Actividad reciente":
- Últimas 20 acciones del tablero
- Quién hizo qué y cuándo
- Símbolos para cada tipo: ➕ (creado), ↔️ (movido), 🗑️ (eliminado)

---

## Flujo Típico

**Día 1: Ana crea un tablero**
- Ana se registra
- Crea tablero "Sprint Junio"
- Es automáticamente Owner

**Día 2: Ana invita a Bob**
- Ana abre Miembros → Invita → bob@empresa.com (Editor)
- Bob recibe notificación: "Ana te invitó a 'Sprint Junio'"
- Bob click Aceptar
- Bob ahora puede ver y editar el tablero

**Día 3: Bob crea una tarjeta**
- Bob: "Diseñar homepage"
- Ana ve en el Activity Feed: "Bob creó 'Diseñar homepage'"
- Ana puede comentar (en el futuro)

**Día 4: Ana remover a Bob**
- Ana: Miembros → ✕ (Bob)
- Bob recibe notificación: "Fuiste removido de 'Sprint Junio'"
- Bob ya no ve el tablero

---

## Preguntas Comunes

**P: ¿Puedo compartir el tablero con muchas personas?**  
R: Sí. No hay límite técnico. Para 50+ personas, considera un servidor real.

**P: ¿Se sincronizan los cambios en tiempo real entre miembros?**  
R: Sí. Si Ana y Bob abren el mismo tablero, ven cambios al instante.

**P: ¿Qué pasa si dejo de ser Owner?**  
R: Solo otros Owners pueden cambiar permisos. Cuidado al remover el último Owner.

**P: ¿Puedo tener "tableros privados"?**  
R: Sí, por default. Solo veen los miembros que invites.

**P: ¿Cómo exporto los datos?**  
R: Por ahora no hay botón de export. En producción, se haría via Cloud Functions.

---

## Limitaciones Actuales (y roadmap)

❌ No hay "roles granulares" (ej. "puedo ver pero no mover")  
→ TODO: agregar permisos específicos por acción

❌ No hay "comentarios en tarjetas"  
→ TODO: agregar colección `cards/{cardId}/comments`

❌ No hay "menciones" (@usuario en comentarios)  
→ TODO: integrar con notificaciones

❌ No hay "notificaciones por email"  
→ TODO: Cloud Functions + SendGrid

✅ Notificaciones en-app en tiempo real  
✅ Membresías con roles básicos  
✅ Activity feed con timestamps  

---

## Técnicamente (para devs)

### Estructura de datos

```javascript
// Invitación
users/{userId}/boards/{boardId}/members/{memberId}
{
  userId: "abc123",
  email: "bob@empresa.com",
  role: "editor",
  status: "active" | "pending",
  invitedBy: "ana@empresa.com",
  invitedAt: Timestamp(2024-05-31)
}

// Notificación
notifications/{userId}/messages/{notificationId}
{
  type: "invite" | "activity" | "mention",
  message: "Ana te invitó a 'Sprint Junio'",
  boardId: "board123",
  read: false,
  createdAt: Timestamp(2024-05-31)
}

// Actividad
users/{userId}/boards/{boardId}/activity/{activityId}
{
  type: "card_created" | "card_moved" | "list_created" | etc,
  target: "Nombre de lo que se hizo",
  by: "juan@empresa.com",
  timestamp: Timestamp(2024-05-31)
}
```

### Llamadas Firestore

```javascript
// Invitar
db.collection('users').doc(userId).collection('boards')
  .doc(boardId).collection('members').doc(targetUserId).set({...})

// Escuchar notificaciones
db.collection('notifications').doc(userId)
  .collection('messages').onSnapshot((snap) => {...})

// Registrar actividad
db.collection('users').doc(userId).collection('boards')
  .doc(boardId).collection('activity').add({...})
```

### Cómo extender

**Agregar nuevos tipos de notificación:**
1. En `memberships.js`, función `sendNotification()`, agrega un nuevo `type`
2. En `notifications.js`, agrega el emoji y texto en `getActivityIcon()` y `getActivityText()`

**Agregar permisos granulares:**
1. Guardar los permisos en el rol: `role: "viewer:read-only"` o usar un campo `permissions: [...]`
2. En los eventos de drag & drop, chequear permisos antes de permitir

**Agregar notificaciones por email:**
1. Crear Cloud Function que escuche nuevas notificaciones
2. Usar SendGrid o Firebase Emailing para enviar
3. Agregar campo `notificationPreferences` en `users/{userId}`

---

**Happy colaborating! 🚀**
