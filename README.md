# Gestor de Dinero

App para gestionar ingresos y gastos con soporte multicuenta, categorías personalizables, transferencias entre cuentas y un dashboard visual e interactivo.

## Arquitectura

Monorepo con dos paquetes independientes:

```
gestor/
├── backend/     API REST — Node.js + Express + TypeScript + Prisma + SQLite
└── frontend/    App web — React + Vite + TypeScript + Tailwind CSS + Recharts
```

**Backend** (`backend/`)
- `prisma/schema.prisma` — modelos de datos: `Account`, `Category`, `Transaction`, `Transfer`, `GoogleAccount`
- `src/routes/` — endpoints REST (`/api/accounts`, `/api/categories`, `/api/transactions`, `/api/transfers`, `/api/stats`, `/api/google`)
- `src/utils.ts` — cálculo de balances (balance inicial + ingresos − gastos + transferencias)
- `src/google.ts` — OAuth con Google y sincronización con Google Sheets
- Base de datos SQLite local (`backend/prisma/dev.db`), sin necesidad de servidor externo

**Frontend** (`frontend/`)
- `src/pages/` — Resumen (Dashboard), Cuentas, Transacciones, Categorías, Transferencias, Ajustes
- `src/components/dashboard/` — `BalanceCard`, `TrendChart` (tendencia mensual), `CategoryDonut` (gasto por categoría)
- `src/components/ui/` — sistema de diseño reutilizable: `Card`, `Button`, `Modal`, `FormField`, `IconColorPicker`, `EmptyState`
- `src/hooks/queries.ts` — capa de datos con TanStack Query (caché, invalidación automática)
- Estilo minimalista cálido (crema + naranja/terracota) inspirado en dashboards financieros modernos, con tarjetas redondeadas, gráficos suaves y micro-interacciones

## Sincronización con Google Drive (Sheets)

Desde la pestaña **Ajustes** puedes conectar tu cuenta de Google. La sincronización funciona en los dos sentidos:

- **App → Sheets**: pulsando "Sincronizar ahora" subes tus cuentas, categorías, transacciones y transferencias a una hoja de cálculo "Gestor de Dinero" en tu Google Drive.
- **Sheets → App**: si editas una fila o añades una nueva directamente en la hoja, la app la revisa automáticamente cada ~45 segundos (mientras la tienes abierta) y trae esos cambios sola, sin que tengas que hacer nada. Si además borraste filas en la hoja, usa el botón "Importar cambios" para aplicar también esos borrados en la app (por seguridad, la revisión automática en segundo plano nunca borra datos por su cuenta).

Cada fila lleva una columna **ID** que la app usa para reconocerla al volver a importar — no la borres ni la edites. Requiere unas credenciales gratuitas de Google Cloud que se crean en 5 minutos — sigue la guía paso a paso en **[`GOOGLE_SETUP.md`](./GOOGLE_SETUP.md)**.

## Puesta en marcha

Requisitos: Node.js 18+ y npm.

### Opción rápida

- **Linux / macOS**:
  ```bash
  chmod +x start.sh   # solo la primera vez
  ./start.sh
  ```
- **Windows**: haz doble clic en `start.bat` (o ejecútalo desde el símbolo del sistema / PowerShell).

Estos scripts crean `backend/.env`, instalan dependencias, crean la base de datos si no existe y arrancan backend + frontend. Es seguro volver a ejecutarlos: si algo ya está instalado o migrado, se lo saltan.

### Opción manual

```bash
# 0. Crear el archivo de variables de entorno del backend (solo la primera vez)
cp backend/.env.example backend/.env

# 1. Instalar dependencias de ambos paquetes
npm run install:all

# 2. Crear la base de datos (genera backend/prisma/dev.db)
npm run db:migrate
# te pedirá un nombre para la migración, por ejemplo: init

# 3. Arrancar backend (puerto 4000) y frontend (puerto 5173) a la vez
npm run dev
```

Abre http://localhost:5173 — el frontend habla con la API a través de un proxy de Vite (`/api` → `http://localhost:4000`), así que no hace falta configurar CORS ni variables de entorno adicionales.

### Comandos útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Backend + frontend en paralelo (desarrollo) |
| `npm run build` | Compila ambos paquetes para producción |
| `npm run db:studio` | Abre Prisma Studio para ver/editar la base de datos visualmente |

## 📦 Llevarlo en un USB y ejecutarlo en Windows, macOS o Linux

Esta carpeta no necesita "instalarse" en el sistema — es un proyecto normal, así que puedes copiarla entera a una memoria USB y arrancarla desde cualquier ordenador con Node.js, sea Windows, macOS o Linux.

**1. Prepara la carpeta antes de copiarla (una sola vez, desde el ordenador donde la tienes ahora):**

```bash
chmod +x preparar-usb.sh   # solo la primera vez
./preparar-usb.sh
```

Esto borra `node_modules` y las carpetas compiladas (`dist`), que pesan mucho y además contienen piezas nativas específicas de tu sistema operativo actual — si las copiaras tal cual a un Windows o un Mac no funcionarían allí. Se vuelven a generar solas la primera vez que arrancas la app en cada ordenador nuevo (por eso ese primer arranque tarda un poco más y necesita internet).

Después, copia toda la carpeta `gestor` (o como la hayas renombrado) a tu memoria USB.

**2. Ejecutarlo en cualquier ordenador donde tengas el USB:**

Necesitas tener [Node.js](https://nodejs.org) (versión 18 o superior) instalado en ese ordenador — es gratis y se instala en un minuto. Con eso:

- **Linux / macOS**: abre una terminal en la carpeta (dentro del USB) y ejecuta `chmod +x start.sh && ./start.sh`.
- **Windows**: haz doble clic en `start.bat` dentro de la carpeta. Si Windows avisa de que es un archivo de un "editor desconocido", pulsa "Más información" → "Ejecutar de todas formas".

En ambos casos la app queda disponible en `http://localhost:5173`. Salvo que uses la sincronización con Google Sheets, funciona completamente sin conexión una vez instalada.

**Qué viaja contigo en el USB:**

- **Tus datos** (`backend/prisma/dev.db`) son un archivo normal — viajan con la carpeta, así que tus cuentas, categorías y movimientos estarán ahí en cualquier ordenador donde la ejecutes.
- **Tus credenciales de Google** (`backend/.env`, si ya conectaste Google Sheets) también viajan con el proyecto para que la sincronización siga funcionando. Por eso conviene no dejar el USB desatendido ni prestarlo — quien tenga ese archivo podría usar esas credenciales. Si vas a compartir el USB, borra `backend/.env` antes (se recrea siguiendo [`GOOGLE_SETUP.md`](./GOOGLE_SETUP.md)).

## Primeros pasos dentro de la app

La app arranca completamente vacía, como pediste. Orden recomendado:

1. **Cuentas** → crea tus cuentas (banco, efectivo, tarjeta, inversión...)
2. **Categorías** → crea las categorías de ingreso/gasto que uses habitualmente
3. **Resumen** → usa "Nueva transacción" para registrar movimientos; el dashboard (balance, tendencia, gasto por categoría) se rellena automáticamente
4. **Transferencias** → para mover dinero entre tus propias cuentas sin que cuente como ingreso/gasto
5. **Ajustes** (opcional) → conecta tu cuenta de Google para guardar una copia de tus datos en Google Sheets (ver [`GOOGLE_SETUP.md`](./GOOGLE_SETUP.md))

## Notas

- Los balances de cuenta se calculan dinámicamente (no se almacenan), por lo que siempre están en sincronía con tus movimientos.
- Eliminar una cuenta con movimientos o transferencias la archiva en vez de borrarla, para no perder el histórico.
- La paleta de colores y los iconos de cuentas/categorías son personalizables al crearlas o editarlas.
- Este proyecto se generó y verificó por lectura de código en un entorno en la nube sin acceso al registro de npm, por lo que `npm install` no se pudo ejecutar aquí. Si al instalar ves algún error, pégamelo y lo resolvemos.
- `start.bat` (Windows) se escribió y revisó a mano igual que el resto del proyecto, pero no se pudo probar en un Windows real desde aquí — si al ejecutarlo ves algún error, copia el mensaje y lo arreglamos.
