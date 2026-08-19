const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function ensureInitialAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Faltan INITIAL_ADMIN_EMAIL o INITIAL_ADMIN_PASSWORD');
  }
  if (password.length < 12) {
    throw new Error('INITIAL_ADMIN_PASSWORD debe tener al menos 12 caracteres');
  }

  const [existing] = await pool.execute(
    'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
    [email]
  );
  if (existing.length) return;

  const hashedPassword = await bcrypt.hash(password, 12);
  await pool.execute(
    `INSERT INTO usuarios (nombre, apellido, email, password, telefono, departamento, role_id)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    ['Admin', 'Univalle', email, hashedPassword, '', 'Internacionalización']
  );
  console.log(`Administrador inicial creado: ${email}`);
}

module.exports = { ensureInitialAdmin };
