// ═══════════════════════════════════════════════════════════════════
// CLOUD FUNCTION: Enviar notificaciones por email
// ═══════════════════════════════════════════════════════════════════
// Instalación:
// 1. npm install functions-framework @google-cloud/functions-framework
// 2. npm install node-fetch@2 (para SendGrid)
// 3. gcloud functions deploy sendNotificationEmail \
//    --runtime nodejs18 \
//    --trigger-topic=send-notification-email \
//    --entry-point=sendNotificationEmail \
//    --set-env-vars SENDGRID_API_KEY=tu_key_aqui

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

admin.initializeApp();

// Obtener API key de SendGrid desde variables de entorno
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Función: trigger en Firestore cuando se crea una notificación
exports.sendNotificationEmail = functions.firestore
  .document("notifications/{userId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    const userId = context.params.userId;

    try {
      // 1. Obtener datos del usuario (email, preferencias)
      const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(userId)
        .get();

      if (!userDoc.exists) {
        console.log(`Usuario ${userId} no encontrado`);
        return;
      }

      const user = userDoc.data();
      const userEmail = user.email;

      // 2. Chequear preferencias de notificación
      const settingsDoc = await admin
        .firestore()
        .collection("users")
        .doc(userId)
        .collection("settings")
        .doc("notifications")
        .get();

      const settings = settingsDoc.data() || {};
      const emailNotifications = settings.emailNotifications !== false; // default true
      const emailInvites = settings.emailInvites !== false;
      const emailActivity = settings.emailActivity !== false;

      // 3. Decidir si enviar email según tipo y preferencias
      let shouldSendEmail = false;
      let subject = "";
      let template = "";

      if (notification.type === "invite" && emailInvites) {
        shouldSendEmail = true;
        subject = `${notification.invitedBy} te invitó a un tablero`;
        template = buildInviteEmail(
          user.name || userEmail,
          notification.invitedBy,
          notification.boardName,
          notification.boardId
        );
      } else if (notification.type === "activity" && emailActivity) {
        shouldSendEmail = true;
        subject = "Actividad en un tablero compartido";
        template = buildActivityEmail(user.name || userEmail, notification);
      }

      if (!shouldSendEmail || !emailNotifications) {
        console.log(
          `Email no enviado para ${userEmail}: tipo=${notification.type}, prefs=${emailNotifications}`
        );
        return;
      }

      // 4. Enviar email via SendGrid
      const msg = {
        to: userEmail,
        from: process.env.SENDGRID_FROM_EMAIL || "noreply@taskflow.app",
        subject: subject,
        html: template,
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true },
        },
      };

      await sgMail.send(msg);
      console.log(`Email enviado a ${userEmail}`);

      // 5. Marcar como enviado
      await snap.ref.update({ emailSent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch (error) {
      console.error("Error enviando email:", error);
      // No re-throw: no queremos que la función falle y reintente infinitamente
    }
  });

// Función: trigger en Firestore cuando se actualizan settings
exports.validateUserSettings = functions.firestore
  .document("users/{userId}/settings/notifications")
  .onWrite(async (change, context) => {
    const newSettings = change.after.data();
    const allowedKeys = [
      "emailNotifications",
      "emailInvites",
      "emailActivity",
      "digestFrequency", // "immediate", "daily", "weekly"
      "updatedAt",
    ];

    // Validar que no haya campos raros
    for (const key of Object.keys(newSettings || {})) {
      if (!allowedKeys.includes(key)) {
        console.warn(
          `Campo no permitido en settings: ${key}. Eliminando...`
        );
        await change.after.ref.update({ [key]: admin.firestore.FieldValue.delete() });
      }
    }

    // Validar tipos de datos
    const settings = newSettings || {};
    const errors = [];

    if (
      settings.emailNotifications !== undefined &&
      typeof settings.emailNotifications !== "boolean"
    )
      errors.push("emailNotifications debe ser boolean");

    if (settings.emailInvites !== undefined && typeof settings.emailInvites !== "boolean")
      errors.push("emailInvites debe ser boolean");

    if (settings.emailActivity !== undefined && typeof settings.emailActivity !== "boolean")
      errors.push("emailActivity debe ser boolean");

    if (
      settings.digestFrequency &&
      !["immediate", "daily", "weekly"].includes(settings.digestFrequency)
    )
      errors.push(
        "digestFrequency debe ser 'immediate', 'daily' o 'weekly'"
      );

    if (errors.length > 0) {
      console.warn(`Validación fallida en settings: ${errors.join(", ")}`);
      // En producción, podrías rechazar la escritura o registrar una alarma
    }

    return null;
  });

// ─────────────────────────────────────────────────────────────────
// TEMPLATES DE EMAIL
// ─────────────────────────────────────────────────────────────────

function buildInviteEmail(userName, invitedBy, boardName, boardId) {
  const dashboardUrl = `https://tu-dominio.com/board.html?id=${boardId}`;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #0079bf; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>¡Te invitaron a un tablero!</h1>
        </div>
        <div class="content">
          <p>Hola ${userName},</p>
          <p><strong>${invitedBy}</strong> te invitó a colaborar en <strong>"${boardName}"</strong> en TaskFlow.</p>
          <p>Aceptar la invitación es fácil: solo haz click en el botón de abajo.</p>
          <a href="${dashboardUrl}" class="button">Abrir Tablero</a>
          <p style="margin-top: 20px; color: #666; font-size: 14px;">
            Si no esperabas esta invitación, puedes ignorar este email.
          </p>
        </div>
        <div class="footer">
          <p>TaskFlow · Kanban simplificado</p>
          <p><a href="https://tu-dominio.com" style="color: #0079bf;">Visita TaskFlow</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function buildActivityEmail(userName, notification) {
  const activityUrl = `https://tu-dominio.com/board.html?id=${notification.boardId}`;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f0f1f5; padding: 12px 16px; border-left: 4px solid #0079bf; }
        .content { background: #f9f9f9; padding: 20px; }
        .button { display: inline-block; background: #0079bf; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h3 style="margin: 0;">Actividad en "${notification.boardName}"</h3>
        </div>
        <div class="content">
          <p>Hola ${userName},</p>
          <p>${notification.message}</p>
          <a href="${activityUrl}" class="button">Ver Tablero</a>
          <p style="margin-top: 20px; color: #666; font-size: 14px;">
            Puedes cambiar tus preferencias de notificación en Settings.
          </p>
        </div>
        <div class="footer">
          <p>TaskFlow · Kanban simplificado</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ─────────────────────────────────────────────────────────────────
// EXPORTAR FUNCIONES
// module.exports = {
//   sendNotificationEmail,
//   validateUserSettings,
// };
