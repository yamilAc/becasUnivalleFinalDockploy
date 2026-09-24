const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const authMiddleware = require('../middlewares/authMiddleware');
const { isDocente } = require('../middlewares/roleMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');

// Configuración de multer para fotos de perfil
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'perfil-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  }
});

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Crear nuevo auxiliar (SOLO DOCENTE)
router.post('/', isDocente, upload.single('foto'), async (req, res) => {
  try {
    const { nombre, email, password, telefono, departamento } = req.body;
    const foto_perfil = req.file ? `/uploads/${req.file.filename}` : null;
    
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }
    
    if (!email.endsWith('@aux.univalle.edu')) {
      return res.status(400).json({ message: 'El email debe terminar en @aux.univalle.edu' });
    }
    
    const role_id = 2;
    
    const userId = await User.create({
      nombre,
      apellido: '',
      email,
      password,
      telefono,
      departamento,
      foto_perfil,
      role_id
    });
    
    res.status(201).json({ message: 'Auxiliar creado exitosamente', id: userId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear auxiliar' });
  }
});

// Obtener todos los auxiliares con sus datos (SOLO DOCENTE)
router.get('/', isDocente, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.nombre, u.email, u.telefono, u.departamento, u.foto_perfil,
              u.activo, u.ultimo_acceso, u.created_at, u.updated_at,
              (SELECT COUNT(*) FROM becas b WHERE b.creado_por = u.id) AS becas_creadas
       FROM usuarios u
       WHERE u.role_id = 2
       ORDER BY u.created_at DESC, u.id DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener auxiliares' });
  }
});

// Borra del disco una foto de perfil subida (si existe)
const borrarFoto = (fotoPath) => {
  if (!fotoPath || !fotoPath.startsWith('/uploads/')) return;
  const archivo = path.join(__dirname, '../..', fotoPath);
  fs.unlink(archivo, () => {});
};

// Editar auxiliar (SOLO DOCENTE)
router.put('/:id', isDocente, upload.single('foto'), async (req, res) => {
  const fotoNueva = req.file ? `/uploads/${req.file.filename}` : null;
  const rechazar = (status, message) => {
    borrarFoto(fotoNueva);
    return res.status(status).json({ message });
  };

  try {
    const { id } = req.params;
    const [actuales] = await pool.execute(
      'SELECT id, email, foto_perfil FROM usuarios WHERE id = ? AND role_id = 2',
      [id]
    );
    if (!actuales.length) return rechazar(404, 'Auxiliar no encontrado');
    const actual = actuales[0];

    const nombre = (req.body.nombre || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const telefono = (req.body.telefono || '').trim();
    const departamento = (req.body.departamento || '').trim();
    const password = req.body.password || '';
    const quitarFoto = req.body.quitarFoto === 'true';

    if (nombre.length < 3) return rechazar(400, 'El nombre debe tener al menos 3 caracteres');
    if (!email.endsWith('@aux.univalle.edu')) return rechazar(400, 'El email debe terminar en @aux.univalle.edu');
    if (telefono && !/^[0-9]{8,15}$/.test(telefono)) return rechazar(400, 'Teléfono inválido (8-15 dígitos)');
    if (password && (password.length < 6 || !/[A-Z]/.test(password) || !/[0-9]/.test(password))) {
      return rechazar(400, 'La contraseña debe tener mínimo 6 caracteres, una mayúscula y un número');
    }

    const [duplicados] = await pool.execute(
      'SELECT id FROM usuarios WHERE email = ? AND id <> ?',
      [email, id]
    );
    if (duplicados.length) return rechazar(400, 'Ese email ya está registrado por otro usuario');

    let foto_perfil = actual.foto_perfil;
    if (fotoNueva) foto_perfil = fotoNueva;
    else if (quitarFoto) foto_perfil = null;

    const campos = ['nombre = ?', 'email = ?', 'telefono = ?', 'departamento = ?', 'foto_perfil = ?'];
    const valores = [nombre, email, telefono, departamento, foto_perfil];
    if (password) {
      campos.push('password = ?');
      valores.push(await bcrypt.hash(password, 10));
    }
    valores.push(id);

    await pool.execute(
      `UPDATE usuarios SET ${campos.join(', ')} WHERE id = ? AND role_id = 2`,
      valores
    );

    if (foto_perfil !== actual.foto_perfil) borrarFoto(actual.foto_perfil);

    res.json({ message: 'Auxiliar actualizado exitosamente' });
  } catch (error) {
    console.error(error);
    borrarFoto(fotoNueva);
    res.status(500).json({ message: 'Error al actualizar auxiliar' });
  }
});

// Eliminar auxiliar (SOLO DOCENTE)
// Las becas que registró o modificó pasan a nombre del docente que lo elimina,
// así no se pierden, y el auxiliar pierde el acceso de inmediato.
router.delete('/:id', isDocente, async (req, res) => {
  const { id } = req.params;
  let conn;
  try {
    const [actuales] = await pool.execute(
      'SELECT id, foto_perfil FROM usuarios WHERE id = ? AND role_id = 2',
      [id]
    );
    if (!actuales.length) {
      return res.status(404).json({ message: 'Auxiliar no encontrado' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [becas] = await conn.execute(
      'UPDATE becas SET creado_por = ? WHERE creado_por = ?',
      [req.user.id, id]
    );
    await conn.execute(
      'UPDATE becas SET modificado_por = ? WHERE modificado_por = ?',
      [req.user.id, id]
    );
    await conn.execute('DELETE FROM usuarios WHERE id = ? AND role_id = 2', [id]);
    await conn.commit();

    borrarFoto(actuales[0].foto_perfil);

    res.json({
      message: 'Auxiliar eliminado exitosamente',
      becasTransferidas: becas.affectedRows
    });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar auxiliar' });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;