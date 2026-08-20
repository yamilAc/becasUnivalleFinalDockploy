const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { initializeSchema } = require('./src/utils/initializeSchema');
const { ensureInitialAdmin } = require('./src/utils/ensureInitialAdmin');
const { seedInitialBecas } = require('./src/utils/seedInitialBecas');
const { restoreLinkedImageBecas } = require('./src/utils/restoreLinkedImageBecas');

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Importar rutas
const authRoutes = require('./src/routes/authRoutes');
const becaRoutes = require('./src/routes/becaRoutes');
const auxiliarRoutes = require('./src/routes/auxiliarRoutes');
const practicaRoutes = require('./src/routes/practicaRoutes');

// Usar rutas
app.use('/api/auth', authRoutes);
app.use('/api/becas', becaRoutes);
app.use('/api/auxiliares', auxiliarRoutes);
app.use('/api/practicas-internacionales', practicaRoutes);

// Ruta de prueba
app.get('/api', (req, res) => {
  res.json({ message: 'API del Sistema de Becas Univalle funcionando' });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Error interno del servidor', error: err.message });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initializeSchema();
    await ensureInitialAdmin();
    await seedInitialBecas();
    await restoreLinkedImageBecas();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('No fue posible inicializar el administrador:', error);
    process.exit(1);
  }
}

startServer();
