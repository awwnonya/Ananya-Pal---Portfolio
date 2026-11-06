const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '../frontend');

// Setup Multer for in-memory file uploads (max 10MB)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve static frontend files from frontend directory
app.use(express.static(FRONTEND_DIR));

// Persistent Nodemailer Transporter with Connection Pooling
const emailUser = process.env.EMAIL_USER;
const emailPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
const receiverEmail = process.env.RECEIVER_EMAIL || emailUser || 'ananya.uem69@gmail.com';

let transporter = null;
if (emailUser && emailPass) {
    transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        host: process.env.SMTP_HOST || undefined,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
        secure: process.env.SMTP_SECURE === 'true',
        pool: true, // Reuse pooled TCP/TLS connections for instant delivery
        maxConnections: 5,
        maxMessages: Infinity,
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });

    // Pre-warm the pooled connection on startup
    transporter.verify((err) => {
        if (err) {
            console.error('⚠️ [SMTP Verify Warning]:', err.message);
        } else {
            console.log('✓ [SMTP Ready]: Connection pool active & pre-warmed for instant email delivery.');
        }
    });
}

// Utility to escape HTML special characters for email safety
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        smtpReady: !!transporter,
        receiver: receiverEmail,
        timestamp: new Date().toISOString()
    });
});

// Contact form submission endpoint (supports both multipart/form-data and JSON)
app.post('/api/contact', upload.single('attachment'), async (req, res) => {
    const { name, email, subject, message } = req.body || {};

    // Basic validation
    if (!name || !email || !message) {
        return res.status(400).json({
            success: false,
            error: 'Please provide name, email, and a message.'
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            error: 'Please provide a valid email address.'
        });
    }

    const cleanSubject = subject && subject.trim() ? subject.trim() : 'New Portfolio Inquiry';

    // Prepare attachments (from multipart multer OR JSON base64)
    const mailAttachments = [];
    let attachmentInfo = null;

    if (req.file) {
        mailAttachments.push({
            filename: req.file.originalname,
            content: req.file.buffer,
            contentType: req.file.mimetype
        });
        attachmentInfo = {
            name: req.file.originalname,
            size: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`
        };
    } else if (req.body.attachment && req.body.attachment.data) {
        const base64Data = req.body.attachment.data.replace(/^data:[^;]+;base64,/, '');
        mailAttachments.push({
            filename: req.body.attachment.name || 'attachment',
            content: Buffer.from(base64Data, 'base64'),
            contentType: req.body.attachment.type || 'application/octet-stream'
        });
        attachmentInfo = {
            name: req.body.attachment.name || 'attachment',
            size: 'Included'
        };
    }

    // Plain text email content
    const textContent = `I have received this message from my portfolio.

These are the details of the user:
• Name: ${name}
• Email: ${email}
• Subject: ${cleanSubject}
${attachmentInfo ? `• Attachment: ${attachmentInfo.name} (${attachmentInfo.size})\n` : ''}
Message they want to send me:
--------------------------------------------------
${message}
--------------------------------------------------

Sent on: ${new Date().toLocaleString()}
Tip: You can hit 'Reply' to respond directly to ${email}`;

    // Rich HTML email content styled to match portfolio branding
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f7f6f2; color: #1a1914; margin: 0; padding: 24px; }
            .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e8e6df; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
            .badge { display: inline-block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; color: #E39B33; background: rgba(227, 155, 51, 0.1); padding: 4px 10px; border-radius: 6px; margin-bottom: 12px; }
            h2 { font-size: 22px; margin: 0 0 8px 0; color: #1a1914; font-weight: 600; }
            .lead { font-size: 14px; color: #64625b; margin: 0 0 24px 0; line-height: 1.5; }
            .details-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px; }
            .details-table td { padding: 10px 12px; border-bottom: 1px solid #f0eee6; }
            .details-table td.label { font-weight: 600; color: #76746d; width: 110px; }
            .details-table td.value { color: #1a1914; }
            .details-table a { color: #E39B33; text-decoration: none; font-weight: 500; }
            .msg-box { background: #faf9f5; border: 1px solid #e8e6df; border-left: 4px solid #E39B33; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px; }
            .msg-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #76746d; font-weight: 600; margin-bottom: 8px; }
            .msg-text { font-size: 14px; line-height: 1.6; color: #2a2924; white-space: pre-wrap; margin: 0; }
            .attachment-badge { display: inline-flex; align-items: center; gap: 8px; background: #fff8ee; border: 1px solid #f3d4a2; padding: 10px 14px; border-radius: 8px; font-size: 13px; color: #8f5300; margin-bottom: 20px; font-weight: 500; }
            .footer { font-size: 12px; color: #9a9890; text-align: center; border-top: 1px solid #f0eee6; padding-top: 20px; }
        </style>
    </head>
    <body>
        <div class="card">
            <span class="badge">Portfolio Notification</span>
            <h2>New Message Received</h2>
            <p class="lead">I have received this message from my portfolio. These are the details of the user and their message:</p>
            
            <table class="details-table">
                <tr>
                    <td class="label">Name:</td>
                    <td class="value"><strong>${escapeHtml(name)}</strong></td>
                </tr>
                <tr>
                    <td class="label">Mail ID:</td>
                    <td class="value"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
                </tr>
                <tr>
                    <td class="label">Subject:</td>
                    <td class="value">${escapeHtml(cleanSubject)}</td>
                </tr>
            </table>

            ${attachmentInfo ? `
            <div class="attachment-badge">
                📎 <strong>Attached:</strong> ${escapeHtml(attachmentInfo.name)} (${escapeHtml(attachmentInfo.size)})
            </div>` : ''}

            <div class="msg-box">
                <div class="msg-label">Message Content</div>
                <p class="msg-text">${escapeHtml(message)}</p>
            </div>

            <div class="footer">
                Hit <strong>Reply</strong> in your email client to respond directly to ${escapeHtml(name)} (${escapeHtml(email)}).
            </div>
        </div>
    </body>
    </html>
    `;

    // ⚡ INSTANT RESPONSE: Return success immediately so the frontend feels instantaneous!
    res.json({
        success: true,
        message: 'Your message has been sent successfully!'
    });

    // Send email asynchronously in the background via persistent pre-warmed connection pool
    if (transporter) {
        const mailOptions = {
            from: `"Portfolio Contact Form" <${emailUser}>`,
            to: receiverEmail,
            replyTo: email,
            subject: `[Portfolio] ${cleanSubject} — from ${name}`,
            text: textContent,
            html: htmlContent,
            attachments: mailAttachments
        };

        transporter.sendMail(mailOptions)
            .then(info => {
                console.log(`⚡ [Instant Send] Email delivered to ${receiverEmail} (MsgID: ${info.messageId})`);
            })
            .catch(err => {
                console.error('❌ [Background SMTP Error]:', err.message);
            });
    } else {
        // Dev mode log
        console.log('\n================ NEW PORTFOLIO MESSAGE (DEV MODE) ================');
        console.log(`To:       ${receiverEmail}`);
        console.log(`From:     ${name} <${email}>`);
        console.log(`Subject:  ${cleanSubject}`);
        if (attachmentInfo) console.log(`File:     ${attachmentInfo.name} (${attachmentInfo.size})`);
        console.log(`Message:\n${message}`);
        console.log('==================================================================\n');
    }
});

// Multer error handling (e.g. file too large)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            error: 'Attachment is too large. Maximum allowed size is 10MB.'
        });
    }
    next(err);
});

// Fallback route: serve index.html for any frontend navigation
app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`
🚀 Portfolio Backend Server is running!
• Local URL:   http://localhost:${PORT}
• Contact API: http://localhost:${PORT}/api/contact
• Health:      http://localhost:${PORT}/api/health
        `);
    });
}

module.exports = app;
