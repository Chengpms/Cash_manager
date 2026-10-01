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
4. Nombre: `Gestor de Dinero` (o el que prefieras).
5. En **"URIs de redirección autorizados"** pulsa **Añadir URI** y escribe exactamente:
   ```
   http://localhost:4000/api/google/callback
   ```
   (Si ya tenías credenciales de la versión anterior con este URI, sirven tal cual.)
6. Pulsa **Crear**. Google te mostrará un **Client ID** (termina en `.apps.googleusercontent.com`) y un **Client Secret**. Cópialos — puedes volver a verlos luego en la lista de credenciales.

## 5. Introduce las credenciales en la app

La sincronización con Google Sheets está disponible en la **versión de escritorio** (Linux y Windows). En Android usa *Exportar copia / Restaurar copia* para mover datos.

1. Abre la app y ve a **Ajustes → Google Drive · Sheets → Credenciales**.
2. Pega el **Client ID** y el **Client Secret** y pulsa **Guardar credenciales**. Se guardan solo en este ordenador, junto a tus datos.

> Si compilas la app tú mismo, también puedes incluirlas de serie creando `frontend/.env.local` con `VITE_GOOGLE_CLIENT_ID=...` y `VITE_GOOGLE_CLIENT_SECRET=...` antes de `npm run build`. No lo hagas en instaladores que vayas a compartir con otras personas.

## 6. Conéctate

1. Pulsa **Conectar con Google**. Se abrirá tu navegador con la página de Google (la app espera la respuesta en el puerto 4000 del propio ordenador; si otro programa lo está usando, ciérralo primero).
2. Verás un aviso de Google que dice algo como *"Google no ha verificado esta app"* — es normal porque la app está en modo Pruebas y es tuya. Pulsa **Avanzado** → **Ir a Gestor de Dinero (no seguro)** para continuar.
3. Acepta los permisos de Google Sheets. El navegador mostrará "¡Conectado!" y la app quedará conectada.
4. Pulsa **Sincronizar ahora**. Se creará una hoja de cálculo llamada "Gestor de Dinero" en tu Google Drive con 4 pestañas (Cuentas, Categorías, Transacciones, Transferencias). Puedes abrirla con el botón "Abrir hoja de cálculo".

## Cómo se sincroniza

- Mientras la app está abierta, **tus cambios se suben solos** a los pocos segundos.
- Cada ~45 segundos la app revisa la hoja y **trae los cambios hechos allí** (filas editadas o nuevas). Esta revisión automática nunca borra nada.
- Si hay cambios pendientes en la app y en la hoja a la vez, **los de la app tienen prioridad**.
- Para aplicar en la app las filas que borraste en la hoja, pulsa **Importar cambios**. Solo se borran registros que ya estaban en la hoja (nunca algo que aún no se había subido); las cuentas con movimientos se archivan en vez de borrarse.
- Si borras la hoja de tu Drive, la siguiente sincronización crea una nueva. Si borras una pestaña, se vuelve a crear.
- No borres ni edites la columna **ID**: es lo que usa la app para reconocer cada fila. Una fila con el ID vacío se trata como un registro nuevo.
- La pestaña Categorías incluye la columna **Presupuesto mensual**.
- Puedes desconectar tu cuenta en cualquier momento desde Ajustes; esto no borra la hoja de cálculo.
- Todo esto es gratuito: la API de Google Sheets no tiene coste para este nivel de uso y no hace falta activar facturación en el proyecto de Google Cloud.
