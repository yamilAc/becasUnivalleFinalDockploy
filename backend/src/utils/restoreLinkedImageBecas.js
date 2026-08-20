const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/database');

// Restaura datos cuando una base existente fue depurada antes de detectar los
// enlaces que Word almacena dentro de sus imágenes.
async function restoreLinkedImageBecas() {
  const seedFile = path.join(__dirname, '../../seed_data/becas.json');
  const data = JSON.parse(await fs.readFile(seedFile, 'utf8'));
  const [[admin]] = await pool.execute(
    'SELECT id FROM usuarios WHERE role_id = 1 AND activo = 1 ORDER BY id LIMIT 1'
  );
  if (!admin) throw new Error('No existe un administrador para restaurar las becas.');

  const sql = `INSERT INTO becas
    (tipo, titulo, institucion, pais, area, descripcion, link_oficial, logo, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const connection = await pool.getConnection();
  let restored = 0;
  try {
    await connection.beginTransaction();
    for (const beca of data) {
      const [existing] = await connection.execute(
        `SELECT id FROM becas
         WHERE titulo = ? AND institucion = ? AND pais = ?
         LIMIT 1`,
        [beca.titulo, beca.institucion, beca.pais]
      );
      if (existing.length) continue;
      await connection.execute(sql, [
        beca.tipo, beca.titulo, beca.institucion, beca.pais, beca.area,
        beca.descripcion, beca.link_oficial, beca.logo, admin.id,
      ]);
      restored += 1;
    }
    await connection.commit();
    console.log(`Oportunidades con imagen y enlace restauradas: ${restored}.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { restoreLinkedImageBecas };
