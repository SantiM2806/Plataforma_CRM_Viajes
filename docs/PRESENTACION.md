# Travelkit CRM/CX — Plataforma para Agencias de Viajes

**Todo el ciclo comercial de tu agencia en una sola plataforma:** cotizar, enviar propuestas, cerrar la venta, gestionar la reserva, atender por chat y conciliar la utilidad.

> Estado: **MVP funcional, probado de punta a punta.** Multi-agencia · Colombia · USD/COP.

---

## El problema

Hoy una agencia de viajes trabaja repartida entre hojas de cálculo, correos, PDFs armados a mano y varios chats de WhatsApp. El precio se calcula a pulso (markup del proveedor + markup propio + comisión bancaria + TRM del día), las propuestas se ven poco profesionales y **nadie sabe con claridad cuánta utilidad dejó cada venta.**

## La solución

Travelkit CRM unifica el ciclo completo en un flujo guiado y con precios automáticos:

**Cotizar → Enviar propuesta web → El cliente aprueba → Reserva → Chat → Conciliación**

---

## Módulos

### 1. Cotizaciones con motor de precios
- Búsqueda de hoteles por proveedor (LiteAPI), con ocupación y edades de niños.
- **Precio automático**: costo neto × (1 + markup proveedor + markup agencia + fee bancario) y conversión a **COP con la TRM oficial del BanRep**, redondeada a la centena.
- Una cotización puede presentar **varias opciones** para que el cliente compare.
- Consecutivo único por agencia (ej. `COT-AVM-0001`) y **exportación a PDF**.

### 2. Propuesta web pública
- Cada cotización genera un **enlace propio** para el cliente (sin instalar nada, sin login).
- El cliente **compara las opciones, elige una y aprueba con un clic** (o rechaza).
- Solo ve el precio final de venta: los costos y márgenes quedan internos.

### 3. Reservas / CRM
- Al aprobar, se **crea la reserva automáticamente** (`RES-AVM-0001`) con todos los datos congelados.
- Seguimiento del estado: por confirmar → confirmada (con localizador) → completada, o cancelada.
- Cada agente ve solo sus propias reservas y cotizaciones.

### 4. Inbox omnicanal
- **Telegram y WhatsApp Cloud API** (integración directa con Meta, sin intermediarios) en una sola bandeja.
- Responder al cliente y **enviarle la cotización dentro del chat** con su enlace.
- Asignación de conversaciones por agente.

### 5. Reportería y conciliación
- Panel de **ventas efectivas** con el desglose **Costo proveedor · Markup (utilidad) · Fee bancario · Venta**.
- Filtro por fechas y **exportación a CSV** con los **datos base para facturación (DIAN)**.

### 6. Configuración y multi-tenant
- Cada agencia configura sus **markups** (por proveedor, por producto o general), su **fee bancario** y la validez de las cotizaciones.
- Roles: Super Admin (dueño del SaaS), Admin de agencia, Agente y Contable.
- **Aislamiento total entre agencias** por seguridad a nivel de base de datos.

---

## Por qué importa

| Antes | Con Travelkit |
|---|---|
| Precio calculado a mano, con errores | Precio automático con TRM del día |
| PDF armado manualmente | PDF y **propuesta web** al instante |
| "¿Aceptas?" por WhatsApp suelto | **Aprobación con un clic** y registro |
| Reserva anotada aparte | Reserva **creada sola** al aprobar |
| Utilidad estimada "a ojo" | **Utilidad por venta** y CSV para contabilidad |

---

## Tecnología

Construido sobre una base moderna, segura y escalable:

- **Next.js** (aplicación web y páginas públicas)
- **PostgreSQL** con seguridad por filas (aislamiento por agencia)
- **LiteAPI** para inventario hotelero global
- **WhatsApp Cloud API** y **Telegram** para el Inbox
- **TRM oficial** del Banco de la República (automática)
- Generación de **PDF** nativa

---

## Estado del proyecto

**Listo y probado de punta a punta:**
Autenticación y multi-tenant · Cotizador + precios + TRM + PDF · Propuesta pública + aprobación · Reservas · Inbox (Telegram/WhatsApp) · Reportería + CSV · Worker de TRM diaria.

**Siguiente:** conexión de credenciales del cliente (Google, LiteAPI, WhatsApp), despliegue a producción con dominio propio y afinamiento visual final.

---

*Travelkit CRM — del interés del cliente a la venta conciliada, sin salir de la plataforma.*
