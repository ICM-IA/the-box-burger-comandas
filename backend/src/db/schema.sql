-- Configurar timezone
SET timezone = 'America/Argentina/Buenos_Aires';

-- Locales
CREATE TABLE IF NOT EXISTS locales (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  direccion VARCHAR(200),
  telefono VARCHAR(20),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Usuarios / Empleados
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(50) NOT NULL CHECK (rol IN ('admin', 'cocina', 'cajero', 'repartidor', 'empleado')),
  local_id INTEGER REFERENCES locales(id),
  permisos TEXT[] DEFAULT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Horarios de empleados
CREATE TABLE IF NOT EXISTS horarios (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  fecha DATE NOT NULL,
  hora_entrada TIMESTAMP,
  hora_salida TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(usuario_id, fecha)
);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  ghl_contact_id VARCHAR(100),
  nombre VARCHAR(100),
  telefono VARCHAR(30),
  direccion_habitual TEXT,
  local_asignado INTEGER REFERENCES locales(id),
  total_pedidos INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS clientes_ghl_contact_id_idx
  ON clientes (ghl_contact_id) WHERE ghl_contact_id IS NOT NULL;

-- Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  numero_pedido VARCHAR(20) UNIQUE NOT NULL,
  local_id INTEGER REFERENCES locales(id),
  cliente_id INTEGER REFERENCES clientes(id),
  canal VARCHAR(50) NOT NULL CHECK (canal IN ('whatsapp', 'web', 'mostrador')),
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('delivery', 'retiro')),
  estado VARCHAR(50) NOT NULL DEFAULT 'nuevo'
    CHECK (estado IN ('nuevo', 'en_cocina', 'listo', 'en_camino', 'entregado', 'cancelado')),
  direccion_entrega TEXT,
  distancia_km DECIMAL(5,2),
  costo_envio DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  metodo_pago VARCHAR(50) CHECK (metodo_pago IN ('efectivo', 'mercadopago', 'transferencia', 'tarjeta', 'qr')),
  mp_link VARCHAR(500),
  mp_pagado BOOLEAN DEFAULT false,
  notas TEXT,
  repartidor_id INTEGER REFERENCES usuarios(id),
  tiempo_estimado INTEGER,
  ghl_conversation_id VARCHAR(100),
  ghl_contact_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Items del pedido
CREATE TABLE IF NOT EXISTS pedido_items (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
  nombre_producto VARCHAR(200) NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  personalizaciones TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Caja
CREATE TABLE IF NOT EXISTS caja (
  id SERIAL PRIMARY KEY,
  local_id INTEGER REFERENCES locales(id),
  fecha DATE NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id),
  total_efectivo DECIMAL(10,2) DEFAULT 0,
  total_mp DECIMAL(10,2) DEFAULT 0,
  total_transferencia DECIMAL(10,2) DEFAULT 0,
  total_tarjeta DECIMAL(10,2) DEFAULT 0,
  total_qr DECIMAL(10,2) DEFAULT 0,
  total_pedidos INTEGER DEFAULT 0,
  total_ventas DECIMAL(10,2) DEFAULT 0,
  cerrada BOOLEAN DEFAULT false,
  hora_cierre TIMESTAMP,
  notas TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(local_id, fecha)
);
