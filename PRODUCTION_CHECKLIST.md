# TaskFlow Lite · Pre-Producción Checklist

**Completar esto antes de anunciar públicamente.**

---

## Seguridad (CRÍTICO)

### Firestore
- [ ] Reglas de seguridad aplicadas (FIRESTORE_RULES.txt)
- [ ] Validación de datos en server-side
- [ ] No hay datos sensibles en el cliente
- [ ] Permisos de tablero chequeados en Cloud Functions
- [ ] Rate limiting en Cloud Functions

### Autenticación
- [ ] Firebase Auth activo (Email/Password)
- [ ] Min password length: 8 caracteres
- [ ] Email verification deshabilitado para MVP (OK para v2)
- [ ] Logout limpia tokens/sesión

### API Secrets
- [ ] SendGrid API key NO en código (solo env vars)
- [ ] Firebase config public (es OK)
- [ ] Cloudflare API token guardado seguro
- [ ] GitHub secrets configurados

### HTTPS
- [ ] Todo sobre HTTPS
- [ ] Cloudflare SSL habilitado
- [ ] HSTS headers activos
- [ ] No hay mixed content (http + https)

### CORS
- [ ] CORS restrictivo a dominio específico
- [ ] Credentials incluidas en requests
- [ ] Options request manejado

---

## Performance

### Frontend
- [ ] PageSpeed Insights > 80
- [ ] Time to Interactive < 3s
- [ ] Core Web Vitals green
- [ ] Mobile responsive funciona
- [ ] Sin console errors

### Backend
- [ ] Cloud Functions timeout adecuado (30-60s)
- [ ] Memory allocation suficiente (256MB OK)
- [ ] No hay N+1 queries
- [ ] Firestore índices creados según necesario

### Base de Datos
- [ ] Firestore quota monitoring habilitado
- [ ] Backups automáticos configurados
- [ ] Test restore realizado

---

## Funcionalidad

### Autenticación
- [ ] Registro funciona (usuario nuevo)
- [ ] Login funciona (usuario existente)
- [ ] Logout funciona
- [ ] Password recovery NO (OK para MVP)
- [ ] Sesión persiste en reload

### Tableros
- [ ] Crear tablero
- [ ] Editar nombre tablero
- [ ] Eliminar tablero
- [ ] Cambiar color de fondo

### Listas y Tarjetas
- [ ] Crear lista
- [ ] Crear tarjeta en lista
- [ ] Drag & drop tarjetas (misma lista)
- [ ] Drag & drop tarjetas (otra lista)
- [ ] Editar título tarjeta
- [ ] Eliminar tarjeta
- [ ] Eliminar lista (y sus tarjetas)

### Membresías
- [ ] Invitar usuario por email
- [ ] Notificación in-app aparece
- [ ] Usuario puede aceptar/rechazar
- [ ] Cambiar rol de miembro
- [ ] Remover miembro

### Notificaciones
- [ ] Campana 🔔 aparece
- [ ] Badge muestra cantidad
- [ ] Panel de notificaciones abre
- [ ] Email de invitación llega (chequear spam)
- [ ] Email de activity (si habilitado)
- [ ] Marcar como leído funciona

### Settings
- [ ] Abrir panel settings
- [ ] Cambiar preferencias email
- [ ] Guardar cambios persisten
- [ ] Export datos genera JSON
- [ ] Cerrar cuenta funciona

---

## Infraestructura

### Firebase
- [ ] Project configurado
- [ ] Firestore Database creada
- [ ] Authentication habilitada
- [ ] Cloud Functions desplegadas
- [ ] Backups configurados

### GitHub Pages
- [ ] Repo público con todos los archivos
- [ ] GitHub Pages habilitado
- [ ] Dominio custom apuntando
- [ ] SSL/HTTPS activo

### Cloudflare
- [ ] Nameservers apuntados
- [ ] DNS records correctos
- [ ] SSL habilitado
- [ ] Cache rules aplicados
- [ ] DDoS protection ON

### SendGrid
- [ ] API key configurada
- [ ] From email verificado
- [ ] Email templates testeados
- [ ] Bounce/complaint handling configurado

---

## Documentación

- [ ] README.md actualizado
- [ ] DEPLOYMENT_GUIDE.md completo
- [ ] MEMBERSHIPS_GUIDE.md con screenshots
- [ ] MAINTENANCE.md con runbooks
- [ ] FIRESTORE_RULES.txt comentado
- [ ] API endpoints documentados (si hay)

---

## Testing

### Manual Testing
- [ ] Registrarse como nuevo usuario
- [ ] Crear tablero y listas
- [ ] Invitar a otro usuario
- [ ] Aceptar invitación
- [ ] Colaborar en tiempo real (2 navegadores)
- [ ] Recibir email de notificación
- [ ] Cambiar settings
- [ ] Eliminar cuenta

### Cross-browser
- [ ] Chrome / Chromium
- [ ] Firefox
- [ ] Safari (si es posible)
- [ ] Mobile (iOS Safari)
- [ ] Mobile (Chrome Android)

### Load Testing
- [ ] 20 usuarios simultáneos (OK)
- [ ] 50 usuarios simultáneos (OK)
- [ ] Sin errores con carga normal

---

## Monitoreo Post-Lanzamiento

### Día 1
- [ ] Monitor logs continuamente
- [ ] Estar disponible para bugs críticos
- [ ] Responder a errores users

### Semana 1
- [ ] Recolectar feedback
- [ ] Arreglar bugs encontrados
- [ ] Optimizar performance si es necesario

### Mes 1
- [ ] Análisis de usage
- [ ] Preparar plan de features
- [ ] Considerar mejoras UX

---

## Go/No-Go Decision

**¿Es apto para lanzar a producción?**

```
VERDE (Go):
- ✅ Todas las boxes arriba chequeadas
- ✅ Sin bloqueadores críticos
- ✅ Documentación completa
- ✅ Team listo para soporte

AMARILLO (Delay):
- ⚠️ Algunos bugs menores
- ⚠️ Performance marginal
- ⚠️ Documentación incompleta

ROJO (No-Go):
- ❌ Bugs críticos no resueltos
- ❌ Security issues
- ❌ Performance inaceptable
- ❌ Data loss risk
```

**Status**: ___________

**Approved by**: ___________

**Date**: ___________

---

## Comunicación al Lanzamiento

### Usuarios Internos

Email template:

```
Asunto: TaskFlow Lite está en vivo 🚀

¡Hola equipo!

TaskFlow Lite ya está en producción:
→ https://tu-dominio.com

Pueden:
✓ Crear tableros Kanban
✓ Invitar compañeros
✓ Recibir notificaciones por email
✓ Colaborar en tiempo real

Reporte de bugs: [link a issues]
Feedback: [form/email]

¡Vamos a ser productivos!
```

### Public Launch (si aplica)

- Anuncio en Twitter/LinkedIn
- Blog post técnico
- Hacker News (si es proyecto open-source)

---

**¡A lanzar! 🎉**

Guardar este checklist en revisiones mensuales para asegurar que:
1. Nada se rompió
2. Está todo documentado
3. El sistema funciona
