const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/database');

async function initializeSchema() {
  const schemaPath = path.join(__dirname, '../../scripts/schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');
  await pool.query(sql);
  // "CREATE TABLE IF NOT EXISTS" no cambia tablas que ya existen, así que
  // se agrandan aquí las columnas de texto de becas en bases ya creadas.
  const ampliarColumnas = [
    'ALTER TABLE becas MODIFY COLUMN titulo VARCHAR(500) NOT NULL',
    'ALTER TABLE becas MODIFY COLUMN institucion VARCHAR(500) NOT NULL',
    'ALTER TABLE becas MODIFY COLUMN area VARCHAR(255) NULL DEFAULT NULL',
    'ALTER TABLE becas MODIFY COLUMN link_oficial VARCHAR(1000) NULL DEFAULT NULL'
  ];
  for (const alter of ampliarColumnas) {
    try {
      await pool.query(alter);
    } catch (error) {
      console.error(`No se pudo ampliar columna (${alter}):`, error.message);
    }
  }
  console.log('Esquema de base de datos verificado.');
}

module.exports = { initializeSchema };
