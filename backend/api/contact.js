const nodemailer = require('nodemailer');

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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
        pool: true,
        maxConnections: 5,
        maxMessages: Infinity,
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { name, email, subject, message, attachment } = req.body || {};

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

    const mailAttachments = [];
    let attachmentInfo = null;

    if (attachment && attachment.data) {
        const base64Data = attachment.data.replace(/^data:[^;]+;base64,/, '');
        mailAttachments.push({
            filename: attachment.name || 'attachment',
            content: Buffer.from(base64Data, 'base64'),
            contentType: attachment.type || 'application/octet-stream'
        });
        attachmentInfo = {
            name: attachment.name || 'attachment',
            size: 'Attached'
        };
    }

    const textContent = `I have received this message from my portfolio.

These are the details of the user:
• Name: ${name}
• Email: ${email}
• Subject: ${cleanSubject}
${attachmentInfo ? `• Attachment: ${attachmentInfo.name}\n` : ''}
Message they want to send me:
--------------------------------------------------
${message}
--------------------------------------------------

Sent on: ${new Date().toLocaleString()}
Tip: You can hit 'Reply' to respond directly to ${email}`;

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
                📎 <strong>Attached:</strong> ${escapeHtml(attachmentInfo.name)}
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

    if (transporter) {
        try {
            await transporter.sendMail({
                from: `"Portfolio Contact Form" <${emailUser}>`,
                to: receiverEmail,
                replyTo: email,
                subject: `[Portfolio] ${cleanSubject} — from ${name}`,
                text: textContent,
                html: htmlContent,
                attachments: mailAttachments
            });

            return res.json({
                success: true,
                message: 'Your message has been sent successfully!'
            });
        } catch (err) {
            console.error('[Error sending email]:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to send email. Check SMTP configuration in environment variables.'
            });
        }
    } else {
        return res.json({
            success: true,
            devMode: true,
            message: 'Message received! (Dev mode active).'
        });
    }
};
