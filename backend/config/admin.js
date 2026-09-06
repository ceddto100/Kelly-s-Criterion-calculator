// config/admin.js - Single source of truth for admin identity
//
// Admins are matched by email. Defaults to the existing hardcoded admin and
// can be overridden/extended via the ADMIN_EMAILS env var (comma-separated).

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'cartercedrick35@gmail.com')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const normalizeEmail = (value) => (value || '').trim().toLowerCase();

const isAdminEmail = (email) => ADMIN_EMAILS.includes(normalizeEmail(email));

module.exports = { ADMIN_EMAILS, isAdminEmail, normalizeEmail };
