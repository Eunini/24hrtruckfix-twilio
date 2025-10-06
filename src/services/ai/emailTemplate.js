/**
 * Generate a branded HTML email.
 *
 * @param {Object} opts
 * @param {string} opts.title        - e.g. "🛠️ Your Ticket #12345 Is Created"
 * @param {string} opts.bodyHtml     - arbitrary HTML snippet for the email body
 * @param {string} opts.logoUrl      - absolute URL to your white-on-blue logo
 * @param {string} opts.companyName  - e.g. "24Hr Truck Services"
 * @param {string} opts.contactInfo  - e.g. "123 Service Road…"
 * @returns {string} – full HTML document
 */
function generateEmailTemplate({
    title,
    bodyHtml,
    logoUrl,
    accentColor   = "#005aac",
    bgColor       = "#0a0f24",
    textColor     = "#ffffff",
    subTextColor  = "#e0e0e0",
    footerColor   = "#14213d",
    footerText    = "#a0a0a0",
    companyName,
    contactInfo
  }) {
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
      body { margin:0; padding:0; background:#f4f4f4; font-family:Arial,sans-serif; }
      .container { width:100%; padding:20px 0; background:#f4f4f4; }
      .inner  { max-width:600px; margin:0 auto; background:${bgColor}; border-radius:8px; overflow:hidden; }
      .header { background:${accentColor}; padding:16px; text-align:center; }
      .header img { width:180px; display:block; margin:0 auto; }
      .title  { padding:24px 32px 16px; color:${textColor}; font-size:24px; line-height:1.2; margin:0; }
      .body   { padding:0 32px 24px; color:${subTextColor}; font-size:16px; line-height:1.5; }
      .footer { background:${footerColor}; padding:16px 32px; color:${footerText}; font-size:12px; line-height:1.4; }
      .footer p { margin:4px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="inner">
        <div class="header">
          <img src="${logoUrl}" alt="${companyName}">
        </div>
        <h1 class="title">${title}</h1>
        <div class="body">
          ${bodyHtml}
        </div>
        <div class="footer">
          <p>&copy; $${new Date().getFullYear()} ${companyName}</p>
          <p>${contactInfo}</p>
        </div>
      </div>
    </div>
  </body>
  </html>
  `.trim();
  }
  
  module.exports = { generateEmailTemplate };