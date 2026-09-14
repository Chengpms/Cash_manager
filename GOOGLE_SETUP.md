# Conectar Gestor de Dinero con Google Drive (Sheets)

Para que el botón "Conectar con Google" de la pestaña **Ajustes** funcione, Google exige que cada aplicación tenga sus propias credenciales. Esto se crea gratis en unos 5 minutos desde tu propia cuenta de Google y solo tú tendrás acceso.

## 1. Crea un proyecto en Google Cloud

1. Ve a [console.cloud.google.com](https://console.cloud.google.com/) e inicia sesión con la cuenta de Google donde quieras guardar tus hojas de cálculo.
2. Arriba a la izquierda, en el selector de proyectos, pulsa **"Proyecto nuevo"**.
3. Ponle un nombre, por ejemplo `Gestor de Dinero`, y pulsa **Crear**. Espera unos segundos a que se cree y selecciónalo.

## 2. Activa la API de Google Sheets

1. En el menú lateral (☰), ve a **APIs y servicios → Biblioteca**.
2. Busca `Google Sheets API` y ábrela.
3. Pulsa **Habilitar**.

## 3. Configura la pantalla de consentimiento OAuth

1. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth**.
2. Tipo de usuario: **Externo** → Crear.
3. Rellena lo mínimo obligatorio: nombre de la app (`Gestor de Dinero`), tu correo en "Correo electrónico de asistencia" y en "Datos de contacto del desarrollador". Pulsa **Guardar y continuar** en cada pantalla (scopes, usuarios de prueba los añadimos ahora, resumen).
4. En el paso **"Usuarios de prueba"**, pulsa **Añadir usuarios** y escribe tu propia dirección de Gmail (la misma que usarás para iniciar sesión desde la app). Guarda.

   > Mientras la app esté en modo **Pruebas** (Testing), solo las cuentas que añadas aquí como usuarias de prueba podrán conectarse. Esto evita el proceso largo de verificación de Google — perfecto para uso personal, no hace falta publicar la app.

## 4. Crea las credenciales (Client ID y Client Secret)

1. Ve a **APIs y servicios → Credenciales**.
2. Pulsa **Crear credenciales → ID de cliente de OAuth**.
3. Tipo de aplicación: **Aplicación web**.
4. Nombre: `Gestor de Dinero backend` (o el que prefieras).
5. En **"URIs de redirección autorizados"** pulsa **Añadir URI** y escribe exactamente:
   ```
   http://localhost:4000/api/google/callback
   ```
6. Pulsa **Crear**. Google te mostrará un **Client ID** (termina en `.apps.googleusercontent.com`) y un **Client Secret**. Cópialos — puedes volver a verlos luego en la lista de credenciales.

## 5. Añade las credenciales al proyecto

Abre `backend/.env` (si no existe, créalo copiando `backend/.env.example`) y rellena estas líneas con tus valores:

```env
GOOGLE_CLIENT_ID="tu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="tu-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:4000/api/google/callback"
FRONTEND_URL="http://localhost:5173"
```

## 6. Aplica el nuevo modelo de base de datos

Esta función añadió una tabla nueva (`GoogleAccount`) al esquema. Si es la primera vez que arrancas el proyecto, `./start.sh` ya se encarga de crearla. Si ya habías ejecutado `npm run db:migrate` antes de esta actualización, aplica la migración nueva manualmente:

```bash
cd backend
npx prisma migrate dev --name add_google_account
cd ..
```

## 7. Conéctate

1. Arranca la app (`./start.sh` o `npm run dev`).
2. Ve a la pestaña **Ajustes** y pulsa **Conectar con Google**.
3. Verás un aviso de Google que dice algo como *"Google no ha verificado esta app"* — es normal porque la app está en modo Pruebas y es tuya. Pulsa **Avanzado** → **Ir a Gestor de Dinero (no seguro)** para continuar.
4. Acepta los permisos de Google Sheets. Volverás automáticamente a la app, ya conectado.
5. Pulsa **Sincronizar ahora**. Se creará una hoja de cálculo llamada "Gestor de Dinero" en tu Google Drive con 4 pestañas (Cuentas, Categorías, Transacciones, Transferencias). Puedes abrirla directamente desde el botón "Abrir hoja de cálculo".

## Notas

- La sincronización es manual: pulsa "Sincronizar ahora" cuando quieras actualizar la hoja con el estado actual de tus datos. No hay sincronización automática en segundo plano.
- Cada sincronización sobrescribe el contenido de las 4 pestañas — no seas tú quien edite la hoja directamente, porque se perderían esos cambios en la siguiente sincronización.
- Puedes desconectar tu cuenta en cualquier momento desde Ajustes; esto no borra la hoja de cálculo, solo deja de estar vinculada a la app.
- Todo esto es gratuito: la API de Google Sheets no tiene coste para este nivel de uso y no hace falta activar facturación en el proyecto de Google Cloud.
