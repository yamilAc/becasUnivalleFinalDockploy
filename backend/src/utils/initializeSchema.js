const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/database');

async function initializeSchema() {
  const schemaPath = path.join(__dirname, '../../scripts/schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Esquema de base de datos verificado.');
}

module.exports = { initializeSchema };
