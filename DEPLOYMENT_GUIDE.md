# TaskFlow Lite · Guía de Despliegue a Producción

**Estado**: Lista para producción con 20-100 usuarios.

---

## Checklist Pre-Despliegue

- [ ] Firebase project creado y configurado
- [ ] Cloud Functions desplegadas
- [ ] Reglas de Firestore aplicadas
- [ ] SendGrid API key configurada
- [ ] GitHub repo con todos los archivos
- [ ] Dominio registrado (o subdomain de GitHub Pages)
- [ ] Cloudflare configurado (DNS + HTTPS)
- [ ] Tests básicos en navegador (invitar, notificaciones)
- [ ] Backups automatizados habilitados

---

## Fase 1: Firebase Setup (15 min)

### 1.1 Crear proyecto Firebase

```bash
# Web: https://console.firebase.google.com
# Click: "Add project" → "TaskFlow"
# Analytics: Disable (para MVP)
```

### 1.2 Habilitar Autenticación

```
Firebase Console → Authentication → Get Started
→ Email/Password → Enable
→ Anonymous → Disable
→ Google → (Opcional para más tarde)
```

### 1.3 Crear Firestore Database

```
Firestore Database → Create database
→ Mode: Production
→ Location: europe-west1 (o tu región)
```

### 1.4 Copiar credenciales

En Project Settings → SDK Setup:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBQu...",
  authDomain: "taskflow-lite-xxx.firebaseapp.com",
  projectId: "taskflow-lite-xxx",
  storageBucket: "taskflow-lite-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcd1234",
};
```

Pega en `js/firebase-config.js`.

### 1.5 Aplicar reglas de Firestore

Firestore → Rules:

Copia todo el contenido de `FIRESTORE_RULES.txt` y pégalo.

Click "Publish".

---

## Fase 2: Cloud Functions (SendGrid) (20 min)

### 2.1 Obtener SendGrid API key

```
https://app.sendgrid.com/settings/api_keys → Create API Key
Copy key (starts with SG.xxx...)
```

### 2.2 Instalar Firebase CLI

```bash
npm install -g firebase-tools
firebase login
firebase init
```

Cuando pregunte:
- Features: Select **Functions**
- Project: tu project de Firebase
- Language: JavaScript
- Eslint: No

### 2.3 Copiar función

```bash
# Reemplaza functions/index.js con notificationEmail.js
cp functions/notificationEmail.js functions/index.js
```

Actualiza `functions/package.json`.

### 2.4 Deploy

```bash
# Set API key en Firebase Console → Cloud Functions → Environment variables
export SENDGRID_API_KEY="SG.xxx"
export SENDGRID_FROM_EMAIL="noreply@taskflow.app"

firebase deploy --only functions
```

Verifica en Firebase Console → Functions que se desplegó correctamente.

### 2.5 Test

En Firestore, crea manualmente una notificación:

```javascript
db.collection('notifications').doc('user_id').collection('messages').add({
  type: 'invite',
  message: 'Test',
  read: false,
  createdAt: new Date()
});
```

Chequea en SendGrid que el email se envió.

---

## Fase 3: GitHub Pages (5 min)

### 3.1 Crear repositorio

```bash
git init
git add .
git commit -m "feat: TaskFlow Lite production"
git branch -M main
git remote add origin https://github.com/tu-usuario/taskflow.git
git push -u origin main
```

### 3.2 Habilitar Pages

GitHub → Settings → Pages:
- Source: Deploy from branch
- Branch: main
- Folder: / (root)
- Click Save

Espera 1 min. GitHub te da: `https://tu-usuario.github.io/taskflow`

---

## Fase 4: Cloudflare (10 min)

### 4.1 Registrar dominio

Opciones:
- **Freenom**: .tk, .cf (gratis, subdomains OK)
- **Namecheap**: $0.88/año
- **GoDaddy**: $1-2/año

Ej: `taskflow.tk`

### 4.2 Apuntar nameservers

En tu registrador (Namecheap, Freenom, etc), actualiza:

```
Nameserver 1: iris.ns.cloudflare.com
Nameserver 2: neal.ns.cloudflare.com
```

### 4.3 Cloudflare setup

```
https://dash.cloudflare.com/ → Add site → taskflow.tk
→ Free plan
→ Nameservers (espera 24h para que se propague)
```

### 4.4 Configurar DNS en Cloudflare

```
DNS → Add record
Type: CNAME
Name: www
Target: tu-usuario.github.io
Proxied: Yes (nube naranja)
```

Espera propagación (15 min a 24h). Luego:

```bash
https://www.taskflow.tk → Funciona ✓
```

### 4.5 SSL automático

Crypto → Automatic HTTPS Rewrites: ON

---

## Fase 5: Configuración de Producción

### 5.1 Actualizar URLs

En `js/firebase-config.js`:

```javascript
// Reemplaza localhost con tu dominio
SENDGRID_FROM_EMAIL = "noreply@tu-dominio.com"
```

En `functions/notificationEmail.js`:

```javascript
const dashboardUrl = `https://www.tu-dominio.com/board.html?id=${boardId}`;
```

### 5.2 Backup automático

Firebase Console → Backup & Restore:

```
Create schedule
Frequency: Daily
Time: 02:00 UTC
Retention: 7 days
```

### 5.3 Monitoreo

Firebase Console → Functions → Monitoring:

- CPU time
- Memory usage
- Error rate
- Execution count

Cloudflare Dashboard:

- Analytics → Traffic
- Security → DDoS events
- Performance → Core Web Vitals

### 5.4 Logs

```bash
firebase functions:log
# Ver últimas ejecuciones

firebase emulators:start --only functions
# Emular localmente
```

---

## Fase 6: Testing (Producción)

### 6.1 Checklist funcional

```
[ ] Registro: Ana → email + password
[ ] Login: Ana inicia sesión
[ ] Crear tablero: "Sprint 1"
[ ] Invitar: bob@empresa.com (role: Editor)
[ ] Email: Bob recibe invitación (chequear spam)
[ ] Notificación in-app: Bob ve campana 🔔
[ ] Aceptar: Bob clickea "Aceptar"
[ ] Tablero: Bob ve tablero en su lista
[ ] Crear tarjeta: Bob crea "Frontend"
[ ] Activity feed: Ana ve activity
[ ] Settings: Bob configura email daily
[ ] Eliminar: Ana remover a Bob
[ ] Email: Bob recibe notificación de removal
```

### 6.2 Carga

Simular 20 usuarios simultáneos:

```bash
# Usar Artillery o Locust para stress test
# Por ahora, Firestore puede manejar esto fácilmente
```

### 6.3 Seguridad

```
[ ] HTTPS everywhere (Cloudflare ✓)
[ ] CORS headers (Firebase ✓)
[ ] XSS: input validation en JS ✓
[ ] Permisos: Firestore rules ✓
[ ] Auth: JWT via Firebase ✓
[ ] CSRF: N/A (stateless)
```

---

## Mantenimiento Semanal

### Monday

```bash
# 1. Check error logs
firebase functions:log --limit 50

# 2. Check Cloudflare analytics
# Visita https://dash.cloudflare.com/

# 3. Backup manual
# (Automático, pero verifica)
```

### Alertas a configurar

Firebase Console → Alerts:

```
[ ] Error rate > 5%
[ ] Function duration > 30s
[ ] Out of quota
```

Slack integration (opcional):

```
Notifications → Add channel → Slack
```

---

## Escalamiento (100+ usuarios)

Cuando llegues a 50-100 usuarios activos:

1. **Archivado de tableros**: Los inactivos → Firestore storage tier bajo
2. **Índices de Firestore**: Firebase auto-sugiere. Aplícalos.
3. **CloudSQL**: Si necesitas reportes/analytics, migra a PostgreSQL
4. **CDN**: Cloudflare ya está cacheando HTML. OK.
5. **Cloud Scheduler**: Digest emails diarios via Cloud Scheduler
6. **Load testing**: Usar Apache JMeter (gratuito)

---

## Troubleshooting en Producción

### Problema: "Notificación no llega"

```
1. Verificar en Firebase Console → Functions → Logs
2. Chequear SendGrid dashboard → Email activity
3. Confirmar API key en Cloud Functions environment vars
4. Revisar spam folder del usuario
5. Chequear si emailNotifications = true en settings
```

### Problema: "Tablero muy lento"

```
1. Abrir DevTools → Network
2. Ver qué queries son lentas
3. Firebase Console → Firestore → Indexes
4. Crear índice compuesto si es necesario
```

### Problema: "Usuarios no se pueden registrar"

```
1. Firebase Console → Authentication → Sign-in method
2. Verificar Email/Password esté enabled
3. Chequear limites de reCAPTCHA
4. Ver error en console del navegador
```

### Problema: "Cloudflare bloquea requests"

```
1. Cloudflare dashboard → Security → Events
2. Ver si hay rate limiting activo
3. Whitelist tu IP si estás testeando
4. Desactivar WAF temporalmente
```

---

## Costo Total (Mensual)

| Servicio | Free Tier | Costo |
|----------|-----------|-------|
| Firebase | Spark | $0 |
| SendGrid | 100 emails/día | $0 |
| GitHub Pages | Unlimited | $0 |
| Cloudflare | Free | $0 |
| Dominio | (Freenom) | $0 |
| **Total** | | **$0** |

Cuando escalés (>1000 usuarios):
- Firebase: $5-50/mes
- SendGrid: $10-100/mes
- Dominio: $10/año
- **Total**: ~$100-200/mes

---

## Soporte y Documentación

- Firebase Docs: https://firebase.google.com/docs
- SendGrid Docs: https://docs.sendgrid.com
- Cloudflare Docs: https://developers.cloudflare.com
- GitHub Pages: https://pages.github.com

---

## Post-Lanzamiento

**Día 1**: Monitorea logs, asegúrate de que no haya errores críticos.

**Semana 1**: Recopila feedback de usuarios. Arregla bugs.

**Mes 1**: Analiza usage, optimiza la UI si es necesario.

**Mes 3**: Considera agregar features (comentarios, due dates, etc).

---

**¡Felicidades! 🚀 TaskFlow está en producción.**
