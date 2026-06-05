require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const pool = require('./config/database');
const sembrarDatos = require('./db/seed');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/socket.io',
});

app.use(cors());
app.use(express.json());

app.set('io', io);

// Rutas públicas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/webhook', require('./routes/webhook'));

// Rutas protegidas
app.use('/api/pedidos', authMiddleware, require('./routes/pedidos'));
app.use('/api/caja', authMiddleware, require('./routes/caja'));
app.use('/api/usuarios', authMiddleware, require('./routes/usuarios'));
app.use('/api/horarios', authMiddleware, require('./routes/horarios'));
app.use('/api/locales', authMiddleware, require('./routes/locales'));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error' });
  }
});

require('./socket/events')(io);

const PORT = process.env.PORT || 3001;

async function iniciar() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Conectado a PostgreSQL');

    // Ejecutar schema si las tablas no existen
    const fs = require('fs');
    const path = require('path');
    const schema = fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8');
    await pool.query(schema);

    // Actualizar CHECK constraint para permitir rol 'empleado'
    try {
      await pool.query(`
        ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
        ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
          CHECK (rol IN ('admin', 'cocina', 'cajero', 'repartidor', 'empleado'));
      `);
      console.log('✅ CHECK constraint actualizado para rol empleado');
    } catch (error) {
      console.log('ℹ️  Constraint ya existe o no necesita actualización');
    }

    // Agregar columna permisos si no existe
    try {
      await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos TEXT[] DEFAULT NULL`);
      console.log('✅ Columna permisos lista');
    } catch (error) {
      console.log('ℹ️  Columna permisos ya existe');
    }

    await sembrarDatos();

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT} (0.0.0.0)`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar:', error);
    process.exit(1);
  }
}

iniciar();
