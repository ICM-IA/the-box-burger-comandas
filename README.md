# The Box Burger — Sistema de Comandas

App web para gestión de comandas en tiempo real para The Box Burger (Mar del Plata, Argentina).
Reemplaza FUDO e integra con el asistente de WhatsApp construido en N8N.

## Stack

- **Backend:** Node.js + Express + Socket.io + PostgreSQL
- **Frontend:** React + Vite (sin dependencias de CDN externas)
- **Tiempo real:** WebSockets via Socket.io
- **Auth:** JWT (12 horas de expiración)
- **Deploy:** Docker + Easypanel en VPS Ubuntu 24.04

## Módulos

| Módulo | Roles | Descripción |
|--------|-------|-------------|
| Comandas | admin, cocina | Kanban en tiempo real: Nuevos → En Cocina → Listos |
| Delivery | admin, cajero, repartidor | Asignación y seguimiento de pedidos a domicilio |
| Caja | admin, cajero | Resumen del día y cierre de caja |
| Empleados | admin | CRUD de empleados + registro de horarios |
| Webhook (API) | N8N | Recibe pedidos del asistente de WhatsApp |

---

## Instalación local (desarrollo)

### Requisitos
- Node.js 20+
- PostgreSQL 16+
- Docker (opcional)

### 1. Variables de entorno

```bash
cp .env.example .env
# Editar .env con tus valores
```

### 2. Backend

```bash
cd backend
npm install
# Asegurarse de que PostgreSQL corre y la DB existe
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend queda en `http://localhost:3000` y hace proxy al backend en `http://localhost:3001`.

### Usuario inicial
- **Email:** `admin@theboxburger.com`
- **Contraseña:** `admin123`
- **Rol:** admin

---

## Deploy con Docker Compose

```bash
cp .env.example .env
# Configurar las variables en .env

docker compose up -d --build
```

La app queda disponible en:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`

---

## Deploy en Easypanel (VPS Ubuntu 24.04)

### 1. PostgreSQL

En Easypanel → **Servicios** → **+ Nuevo** → **PostgreSQL**:
- Nombre: `theboxburger-db`
- Database: `theboxburger`
- Usuario: `theboxburger`
- Contraseña: (generar una segura y anotar)

### 2. Backend

En Easypanel → **Servicios** → **+ Nuevo** → **App**:
- Nombre: `theboxburger-backend`
- Fuente: Git (o subir el código)
- Directorio de build: `/backend`
- Variables de entorno:
  ```
  DATABASE_URL=postgresql://theboxburger:TU_PASSWORD@theboxburger-db:5432/theboxburger
  JWT_SECRET=un_secreto_muy_largo_y_aleatorio
  WEBHOOK_SECRET=otro_secreto_para_n8n
  N8N_WEBHOOK_URL=http://n8n:5678/webhook/pedido-actualizado
  PORT=3001
  TZ=America/Argentina/Buenos_Aires
  ```
- Puerto: `3001`
- Dominio: `api-comandas.theboxburger.com.ar`

### 3. Frontend

En Easypanel → **Servicios** → **+ Nuevo** → **App**:
- Nombre: `theboxburger-frontend`
- Fuente: Git (o subir el código)
- Directorio de build: `/frontend`
- Puerto: `80`
- Dominio: `comandas.theboxburger.com.ar`

> El nginx del frontend ya incluye proxy reverso hacia el backend en `/api` y `/socket.io`.
> Asegurarse de que el nombre del contenedor del backend coincida con `theboxburger-backend` en `nginx.conf`.

### 4. DNS

En tu proveedor de DNS, crear dos registros A:
```
comandas.theboxburger.com.ar     → 31.97.171.78
api-comandas.theboxburger.com.ar → 31.97.171.78
```

---

## Webhook desde N8N

```
POST https://api-comandas.theboxburger.com.ar/api/webhook/nuevo-pedido
Authorization: Bearer {WEBHOOK_SECRET}
Content-Type: application/json
```

### Body de ejemplo

```json
{
  "local": "entre_rios",
  "canal": "whatsapp",
  "tipo": "delivery",
  "ghl_contact_id": "abc123",
  "ghl_conversation_id": "xyz789",
  "cliente": {
    "nombre": "Juan Pérez",
    "telefono": "2236123456",
    "direccion": "San Martín 1234, Mar del Plata"
  },
  "items": [
    { "nombre": "Jack Doble", "cantidad": 2, "precio_unitario": 8500, "personalizaciones": "sin cebolla" },
    { "nombre": "Papas fritas", "cantidad": 1, "precio_unitario": 3200, "personalizaciones": "" }
  ],
  "distancia_km": 2.3,
  "costo_envio": 1200,
  "subtotal": 20200,
  "total": 21400,
  "metodo_pago": "mercadopago",
  "mp_link": "https://mpago.la/xxx",
  "notas": "timbre roto, llamar al llegar",
  "tiempo_estimado": 35
}
```

### Respuesta

```json
{ "success": true, "pedido_id": 142, "numero_pedido": "ER-0142" }
```

## Numeración de pedidos

- `ER-XXXX` → Local Entre Ríos
- `ED-XXXX` → Local Edison
- El contador reinicia cada día (basado en timezone Argentina)

## Estructura del repositorio

```
/
├── backend/
│   ├── src/
│   │   ├── config/database.js
│   │   ├── db/schema.sql + seed.js
│   │   ├── middleware/auth.js
│   │   ├── routes/ (auth, pedidos, caja, usuarios, horarios, webhook)
│   │   ├── socket/events.js
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── context/ (AuthContext, SocketContext)
│   │   ├── components/ (Sidebar, Header, ProtectedRoute)
│   │   ├── pages/ (Login, Comandas, Delivery, Caja, Empleados)
│   │   ├── lib/api.js
│   │   └── styles/global.css
│   ├── nginx.conf
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```
