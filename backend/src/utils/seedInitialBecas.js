const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/database');

async function seedInitialBecas() {
  const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM becas');
  if (total > 0) {
    console.log(`Carga inicial omitida: ya existen ${total} becas.`);
    return;
  }

  const seedDir = path.join(__dirname, '../../seed_data');
  const imageSource = path.join(seedDir, 'images');
  const imageDestination = path.join(__dirname, '../../uploads/importadas');
  const data = JSON.parse(await fs.readFile(path.join(seedDir, 'becas.json'), 'utf8'));
  const [[admin]] = await pool.execute(
    'SELECT id FROM usuarios WHERE role_id = 1 AND activo = 1 ORDER BY id LIMIT 1'
  );

  if (!admin) throw new Error('No existe un administrador para asignar las becas iniciales.');

  await fs.mkdir(imageDestination, { recursive: true });
  await fs.cp(imageSource, imageDestination, { recursive: true, force: false, errorOnExist: false });

  const sql = `INSERT INTO becas
    (tipo, titulo, institucion, pais, area, descripcion, link_oficial, logo, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    for (const beca of data) {
      await connection.execute(sql, [
        beca.tipo, beca.titulo, beca.institucion, beca.pais, beca.area?.slice(0, 100) || null,
        beca.descripcion, beca.link_oficial, beca.logo, admin.id,
      ]);
    }
    await connection.commit();
    console.log(`Carga inicial completada: ${data.length} becas.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { seedInitialBecas };
