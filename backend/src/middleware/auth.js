const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await pool.query(
      'SELECT id, nombre, apellido, email, rol, local_id, activo FROM usuarios WHERE id = $1',
      [payload.id]
    );

    if (!rows[0] || !rows[0].activo) {
      return res.status(401).json({ error: 'Usuario no válido o desactivado' });
    }

    req.usuario = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado — Solo administradores' });
  }
  next();
};

module.exports = { authMiddleware, soloAdmin };
