import process from 'node:process';

export class LoggingEmailService {
  sendOtp({ email, otp, purpose }) {
    process.stdout.write(`OTP generated for ${email} purpose=${purpose} otp=${otp}\n`);
  }

  sendVerificationLink({ email, link }) {
    process.stdout.write(`Verification link generated for ${email} link=${link}\n`);
  }

  sendPasswordResetLink({ email, link }) {
    process.stdout.write(`Password reset link generated for ${email} link=${link}\n`);
  }

  sendAdminCredentials({ email, password, loginUrl }) {
    process.stdout.write(
      `Admin credentials generated for ${email} password=${password} loginUrl=${loginUrl ?? ''}\n`,
    );
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export class SmtpEmailService {
  constructor({ nodemailer, config }) {
    this.nodemailer = nodemailer;
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpUseSsl,
      auth: config.smtpUsername
        ? {
            user: config.smtpUsername,
            pass: config.smtpPassword,
          }
        : undefined,
      requireTLS: config.smtpUseStartTls,
    });
  }

  async sendOtp({ email, otp, purpose }) {
    const title =
      purpose === 'forgot_password' ? 'Your Food Route password reset OTP' : 'Your Food Route verification OTP';
    const reason =
      purpose === 'forgot_password'
        ? 'Use this OTP to reset your password.'
        : 'Use this OTP to verify your account.';

    await this.sendMail({
      to: email,
      subject: title,
      text: `${reason}\n\nOTP: ${otp}\n\nThis OTP expires soon.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(reason)}</p>
          <p style="font-size: 20px; font-weight: bold; letter-spacing: 4px;">${escapeHtml(otp)}</p>
          <p>This OTP expires soon.</p>
        </div>
      `,
    });
  }

  async sendVerificationLink({ email, link }) {
    await this.sendMail({
      to: email,
      subject: 'Verify your Food Route account',
      text: `Open this link to verify your account:\n\n${link}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Verify your Food Route account</h2>
          <p>Open the link below to verify your account.</p>
          <p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
        </div>
      `,
    });
  }

  async sendPasswordResetLink({ email, link }) {
    await this.sendMail({
      to: email,
      subject: 'Reset your Food Route password',
      text: `Open this link to reset your password:\n\n${link}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Reset your Food Route password</h2>
          <p>Open the link below to reset your password.</p>
          <p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
        </div>
      `,
    });
  }

  async sendAdminCredentials({ email, password, loginUrl }) {
    const safeLoginUrl = loginUrl || 'the admin dashboard';
    await this.sendMail({
      to: email,
      subject: 'Your Food Route admin account is ready',
      text:
        `Your admin account has been created.\n\n` +
        `Email: ${email}\n` +
        `Password: ${password}\n` +
        `Login URL: ${safeLoginUrl}\n\n` +
        `Please sign in and change your password immediately.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Your Food Route admin account is ready</h2>
          <p>Your admin account has been created.</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Password:</strong> ${escapeHtml(password)}</p>
          <p><strong>Login URL:</strong> <a href="${escapeHtml(safeLoginUrl)}">${escapeHtml(safeLoginUrl)}</a></p>
          <p>Please sign in and change your password immediately.</p>
        </div>
      `,
    });
  }

  async sendMail({ to, subject, text, html }) {
    await this.transporter.sendMail({
      from: this.config.emailFromAddress || this.config.smtpUsername,
      replyTo: this.config.emailReplyTo || undefined,
      to,
      subject,
      text,
      html,
    });
  }
}
