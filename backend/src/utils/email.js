const nodemailer = require('nodemailer');
const db = require('../config/db');

/**
 * Resolves the most specific WhatsApp group link for an accepted applicant.
 * Priority: group.whatsapp_link → unit.whatsapp_link → department.whatsapp_link → global SMTP config
 *
 * @param {string|null} groupId  - The assigned group's UUID (for members)
 * @param {string|null} unitId   - The unit/track UUID
 * @param {string|null} deptId   - The department UUID
 * @param {string}      fallback - The global WhatsApp link from SMTP settings
 * @returns {Promise<string|null>}
 */
async function resolveWhatsAppLink(groupId, unitId, deptId, fallback) {
  // Try group first
  if (groupId) {
    const g = await db.query('SELECT whatsapp_link FROM groups WHERE id = $1', [groupId]);
    if (g.rows.length && g.rows[0].whatsapp_link) return g.rows[0].whatsapp_link;
  }

  // Try unit/track
  if (unitId) {
    const u = await db.query('SELECT whatsapp_link FROM units WHERE id = $1', [unitId]);
    if (u.rows.length && u.rows[0].whatsapp_link) return u.rows[0].whatsapp_link;
  }

  // Try department
  if (deptId) {
    const d = await db.query('SELECT whatsapp_link FROM departments WHERE id = $1', [deptId]);
    if (d.rows.length && d.rows[0].whatsapp_link) return d.rows[0].whatsapp_link;
  }

  return fallback || null;
}

/**
 * Sends a HTML email to an accepted applicant with their credentials and platform resources.
 * Handles failure gracefully so it doesn't crash the parent transaction.
 *
 * @param {Object} application  The applicant's database record
 * @param {Object} credentials  { username, temporaryPassword, groupCode, assignedGroupId, unitId, deptId }
 * @param {boolean} throwOnError Whether to rethrow errors (useful for SMTP settings test page)
 */
async function sendAcceptanceEmail(application, credentials, throwOnError = false) {
  try {
    // 1. Fetch SMTP settings from database
    const settingsRes = await db.query("SELECT value FROM system_settings WHERE key = 'smtp'");
    if (settingsRes.rowCount === 0) {
      console.warn('[EMAIL] SMTP settings not configured in system_settings. Skipping email delivery.');
      if (throwOnError) {
        throw new Error('SMTP settings are not configured in system_settings.');
      }
      return;
    }

    const config = settingsRes.rows[0].value;
    if (!config.host || !config.user || !config.pass) {
      console.warn('[EMAIL] SMTP configurations are incomplete. Skipping email delivery.');
      if (throwOnError) {
        throw new Error('SMTP configurations are incomplete. Please configure Host, Username, and Password.');
      }
      return;
    }

    // 2. Create Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port, 10) || 587,
      secure: config.secure === true,
      auth: {
        user: config.user,
        pass: config.pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // 3. Resolve WhatsApp link (specific → global fallback)
    const whatsappLink = await resolveWhatsAppLink(
      credentials.assignedGroupId || null,
      application.desired_unit_id || null,
      application.desired_department_id || null,
      config.whatsappGroupLink || null
    );

    // 4. Format dynamic fields
    const isBoard = application.kind === 'board';
    const placementType = isBoard ? 'Board Position' : 'Student Track';
    const placementName = isBoard
      ? application.desired_role
      : (application.desiredUnitName || 'Technical Mentorship');
    const groupCodeStr = credentials.groupCode ? ` (Group ${credentials.groupCode})` : '';
    const platformUrl = config.platformUrl || 'https://msckfs.z16.web.core.windows.net';

    // 5. Construct HTML Email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to MSC-KFS!</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8f4f2;
            color: #241a1c;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background: #ffffff;
            border-radius: 12px;
            border: 1px solid #ede1dc;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(36, 26, 28, 0.05);
          }
          .header {
            background-color: #4a1620;
            color: #ffffff;
            padding: 35px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 0.02em;
          }
          .content {
            padding: 30px 40px;
            line-height: 1.6;
          }
          .content h2 {
            color: #4a1620;
            font-size: 20px;
            margin-top: 0;
          }
          .placement-badge {
            display: inline-block;
            background-color: #eef7e2;
            color: #6b9a00;
            font-weight: bold;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 14px;
            margin: 10px 0 20px;
          }
          .creds-box {
            background-color: #fcfbfa;
            border: 1px dashed #e8542e;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .creds-row { margin-bottom: 10px; }
          .creds-row:last-child { margin-bottom: 0; }
          .creds-label {
            font-size: 12px;
            text-transform: uppercase;
            color: #8a7370;
            font-weight: bold;
          }
          .creds-value {
            font-family: monospace;
            font-size: 16px;
            color: #241a1c;
            font-weight: bold;
          }
          .cta-section {
            text-align: center;
            margin: 30px 0 20px;
          }
          .btn {
            display: inline-block;
            background-color: #e8542e;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 15px;
            margin: 5px;
            box-shadow: 0 4px 6px rgba(232, 84, 46, 0.15);
          }
          .btn-secondary {
            display: inline-block;
            background-color: #4a1620;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 15px;
            margin: 5px;
          }
          .footer {
            background-color: #fbfcfe;
            border-top: 1px solid #ede1dc;
            padding: 20px 40px;
            font-size: 12px;
            color: #8a7370;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Microsoft Campus Club KFS</h1>
          </div>
          <div class="content">
            <h2>Congratulations, ${application.full_name}!</h2>
            <p>We are absolutely thrilled to inform you that your application to join Microsoft Campus Club KFS has been <strong>Accepted</strong>!</p>
            
            <div class="placement-badge">
              Accepted for: ${placementType} — ${placementName}${groupCodeStr}
            </div>
            
            <p>Your member account has been created successfully. Here are your credentials to log in to our learning and management platform:</p>
            
            <div class="creds-box">
              <div class="creds-row">
                <span class="creds-label">Platform Link:</span><br>
                <span class="creds-value"><a href="${platformUrl}" style="color:#e8542e;">${platformUrl}</a></span>
              </div>
              <div style="height: 10px;"></div>
              <div class="creds-row">
                <span class="creds-label">Username:</span><br>
                <span class="creds-value">${credentials.username}</span>
              </div>
              <div style="height: 10px;"></div>
              <div class="creds-row">
                <span class="creds-label">Temporary Password:</span><br>
                <span class="creds-value">${credentials.temporaryPassword}</span>
              </div>
            </div>

            <p><strong>Note:</strong> Please log in to the portal as soon as possible and change your password once inside.</p>
            
            <div class="cta-section">
              ${whatsappLink
                ? `<a href="${whatsappLink}" class="btn" target="_blank">Join WhatsApp Group</a>`
                : ''}
              <a href="${platformUrl}" class="btn-secondary" target="_blank">Access Portal</a>
            </div>
            
            <p>Welcome to our vibrant tech community! Let's shape the future of technology together.</p>
          </div>
          <div class="footer">
            &copy; 2026 Microsoft Campus Club KFS &middot; Kafr El-Sheikh University
          </div>
        </div>
      </body>
      </html>
    `;

    // 6. Send mail
    const mailOptions = {
      from: `"${config.fromName || 'MSC-KFS Admissions'}" <${config.fromEmail || config.user}>`,
      to: application.email,
      subject: `Admissions Update: Welcome to Microsoft Campus Club KFS!`,
      html: htmlContent
    };

    console.log(`[EMAIL] Attempting to send acceptance email to: ${application.email}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Acceptance email sent successfully! MessageID: ${info.messageId}`);
    return info;

  } catch (err) {
    console.error('[EMAIL] Failed to send acceptance email:', err);
    if (throwOnError) {
      throw err;
    }
  }
}

/**
 * Sends a HTML email to a rejected applicant with a professional and encouraging message.
 * Handles failure gracefully so it doesn't crash the parent transaction.
 *
 * @param {Object} application The applicant's database record
 */
async function sendRejectionEmail(application) {
  try {
    // 1. Fetch SMTP settings from database
    const settingsRes = await db.query("SELECT value FROM system_settings WHERE key = 'smtp'");
    if (settingsRes.rowCount === 0) {
      console.warn('[EMAIL] SMTP settings not configured. Skipping rejection email.');
      return;
    }

    const config = settingsRes.rows[0].value;
    if (!config.host || !config.user || !config.pass) {
      console.warn('[EMAIL] SMTP configurations are incomplete. Skipping rejection email.');
      return;
    }

    // 2. Create Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port, 10) || 587,
      secure: config.secure === true,
      auth: {
        user: config.user,
        pass: config.pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // 3. Construct HTML Email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Admissions Update — MSC-KFS</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8f4f2;
            color: #241a1c;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background: #ffffff;
            border-radius: 12px;
            border: 1px solid #ede1dc;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(36, 26, 28, 0.05);
          }
          .header {
            background-color: #4a1620;
            color: #ffffff;
            padding: 35px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 0.02em;
          }
          .content {
            padding: 35px 40px;
            line-height: 1.7;
          }
          .content p {
            margin-bottom: 20px;
            font-size: 15px;
          }
          .arabic-section {
            direction: rtl;
            text-align: right;
            border-bottom: 1px solid #ede1dc;
            padding-bottom: 25px;
            margin-bottom: 25px;
            font-size: 16px;
          }
          .footer {
            background-color: #fbfcfe;
            border-top: 1px solid #ede1dc;
            padding: 20px 40px;
            font-size: 12px;
            color: #8a7370;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Microsoft Campus Club KFS</h1>
          </div>
          <div class="content">
            <!-- Arabic Rejection Message -->
            <div class="arabic-section">
              <p>عزيزنا/عزيزتنا <strong>${application.full_name}</strong>،</p>
              <p>نشكرك جزيل الشكر على اهتمامك ووقتك في التقديم للانضمام إلى <strong>Microsoft Campus Club KFS</strong>.</p>
              <p>لقد تلقينا هذا الموسم عدداً كبيراً جداً من طلبات التقديم المتميزة، ونظراً للمقاعد المتاحة المحدودة للغاية، كان علينا اتخاذ قرارات صعبة. يؤسفنا إبلاغك بأنه لم نتمكن من قبول طلبك للانضمام إلينا في هذا الموسم.</p>
              <p>هذا القرار لا يقلل أبداً من مهاراتك أو شغفك، ونشجعك بشدة على مواصلة التعلم والتقديم معنا مجدداً في مواسم التقديم القادمة.</p>
              <p>نتمنى لك كل التوفيق والنجاح في مسيرتك الأكاديمية والمهنية.</p>
              <p style="margin-bottom:0; font-weight:bold; color:#4a1620;">مع تحيات إدارة القبول والتسجيل،</p>
            </div>

            <!-- English Rejection Message -->
            <div class="english-section">
              <p>Dear <strong>${application.full_name}</strong>,</p>
              <p>Thank you very much for your interest and the time you invested in applying to join <strong>Microsoft Campus Club KFS</strong>.</p>
              <p>We received an overwhelming number of high-quality applications this season. Due to our strictly limited capacity, we had to make some very difficult selection decisions. Unfortunately, we are unable to proceed with your application for this recruitment wave.</p>
              <p>This decision does not reflect on your skills or potential. We highly encourage you to keep developing your knowledge and apply again in our upcoming recruitment seasons.</p>
              <p>We wish you the absolute best of luck in your academic and professional endeavors.</p>
              <p style="margin-bottom:0; font-weight:bold; color:#4a1620;">Warm regards,<br>Admissions & Recruitment Team</p>
            </div>
          </div>
          <div class="footer">
            &copy; 2026 Microsoft Campus Club KFS &middot; Kafr El-Sheikh University
          </div>
        </div>
      </body>
      </html>
    `;

    // 4. Send mail
    const mailOptions = {
      from: `"${config.fromName || 'MSC-KFS Admissions'}" <${config.fromEmail || config.user}>`,
      to: application.email,
      subject: `Admissions Update: Microsoft Campus Club KFS Application`,
      html: htmlContent
    };

    console.log(`[EMAIL] Attempting to send rejection email to: ${application.email}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Rejection email sent successfully! MessageID: ${info.messageId}`);
    return info;

  } catch (err) {
    console.error('[EMAIL] Failed to send rejection email:', err);
  }
}

module.exports = {
  sendAcceptanceEmail,
  sendRejectionEmail
};
