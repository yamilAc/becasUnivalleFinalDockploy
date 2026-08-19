/* Importa oportunidades extraídas desde Word con consultas parametrizadas.
 * Uso: node import_becas_from_json.js /ruta/becas.json ID_CREADOR
 */
const fs = require('fs');
const mysql = require('mysql2/promise');

const [jsonPath, creatorId] = process.argv.slice(2);
if (!jsonPath || !creatorId) {
  throw new Error('Uso: node import_becas_from_json.js /ruta/becas.json ID_CREADOR');
}

const opportunities = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const trim = (value, limit) => {
  if (!value) return null;
  return String(value).trim().slice(0, limit) || null;
};

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'sistema_becas',
  });

  try {
    const [existing] = await connection.execute('SELECT COUNT(*) AS total FROM becas');
    if (existing[0].total > 0) {
      throw new Error(`La tabla becas ya tiene ${existing[0].total} registros; se canceló para evitar duplicados.`);
    }

    await connection.beginTransaction();
    const sql = `INSERT INTO becas
      (tipo, titulo, institucion, pais, area, descripcion, link_oficial, logo, creado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    for (const item of opportunities) {
      await connection.execute(sql, [
        trim(item.tipo, 50),
        trim(item.titulo, 255),
        trim(item.institucion, 255),
        trim(item.pais, 100),
        trim(item.area, 100),
        trim(item.descripcion, 65535),
        trim(item.linkOficial, 500),
        `/uploads/importadas/${item.image}`,
        Number(creatorId),
      ]);
    }
    await connection.commit();
    console.log(`Importación completada: ${opportunities.length} oportunidades registradas.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
