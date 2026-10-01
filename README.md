# Gestor de Dinero

App para gestionar ingresos y gastos con soporte multicuenta, categorías personalizables con presupuesto mensual, transferencias entre cuentas y un dashboard visual e interactivo.

Funciona como **app nativa en Linux, Windows y Android**, sin servidor ni instalación de Node.js: tus datos se guardan en el propio dispositivo.

| Plataforma | Archivo | Notas |
|---|---|---|
| Linux | `Gestor-de-Dinero-X.Y.Z-linux-x86_64.AppImage` | Un solo archivo: dale permiso de ejecución y ábrelo |
| Linux (Debian/Ubuntu) | `Gestor-de-Dinero-X.Y.Z-amd64.deb` | `sudo apt install ./Gestor-de-Dinero-*.deb` — aparece en el menú de aplicaciones |
| Windows | `Gestor-de-Dinero-X.Y.Z-Setup.exe` | Instalador con acceso directo en el escritorio |
| Windows (portable) | `Gestor-de-Dinero-X.Y.Z-Portable.exe` | Sin instalar, ideal para un USB |
| Android | `Gestor-de-Dinero-X.Y.Z.apk` | Android 5.1 o superior. Activa "Instalar apps desconocidas" para el navegador o gestor de archivos con el que lo abras |

Los instaladores se generan automáticamente con GitHub Actions: cada push a `main` los deja en la pestaña **Actions** (sección *Artifacts*), y al subir una etiqueta (`git tag v2.0.0 && git push --tags`) se publican en una **Release**.

## Funciones

- **Cuentas** (corriente, ahorros, efectivo, tarjeta, inversión) con balance calculado al momento. Eliminar una cuenta con movimientos la **archiva**; las archivadas se pueden ver y **restaurar**.
- **Movimientos** de ingreso/gasto con categoría, descripción y fecha. Filtros por cuenta, categoría, tipo, texto y **rango de fechas**, con totales (ingresos, gastos y neto) del resultado filtrado y **exportación a CSV** (abre bien en Excel/LibreOffice en español).
- **Categorías** con icono, color y **presupuesto mensual** opcional. El resumen muestra el progreso de cada presupuesto y avisa al pasarte.
- **Transferencias** entre tus cuentas (crear, **editar** y borrar) que no cuentan como ingreso/gasto.
- **Resumen**: balance total, ingresos/gastos del mes **comparados con el mes anterior**, tendencia de 6 meses y gasto por categoría.
- **Copias de seguridad**: exporta/restaura todos tus datos en un archivo JSON. Sirve también para pasar los datos del ordenador al móvil y al revés.
- **Google Sheets** (versión de escritorio): sincronización en los dos sentidos con una hoja de cálculo de tu Drive. Ver [`GOOGLE_SETUP.md`](./GOOGLE_SETUP.md).

## Dónde se guardan los datos

- **Linux**: `~/.config/Gestor de Dinero/gestor-data.json`
- **Windows**: `%APPDATA%\Gestor de Dinero\gestor-data.json`
- **Android**: dentro del almacenamiento privado de la app. Desinstalar la app los borra: exporta una copia antes.

La ruta exacta aparece en **Ajustes → Tus datos**. En escritorio, cada guardado es atómico (nunca queda un archivo a medias), se conserva la versión anterior como `gestor-data.json.bak` y se guarda una copia diaria en la subcarpeta `copias/` (últimos 14 días). Si el archivo se dañase, la app se recupera sola desde la copia.

**Modo portable (USB)**: crea una carpeta llamada `gestor-data` junto al `.exe` portable o al `.AppImage` y la app guardará ahí los datos en vez de en la carpeta del usuario, así viajan con el USB.

## ¿Vienes de la versión anterior (con backend)?

La versión 1 guardaba los datos en `backend/prisma/dev.db`. Para pasarlos a la nueva:

```bash
python3 scripts/migrar-datos-antiguos.py
```

Genera `gestor-dinero-migrado.json`; ábrelo desde la app en **Ajustes → Restaurar copia** (en el ordenador, o pásalo al móvil y restáuralo allí). Las credenciales de Google ya no se leen de `backend/.env`: introdúcelas en **Ajustes → Google Drive → Credenciales**.

## Arquitectura

```
gestor/
├── frontend/              App (React + Vite + TypeScript + Tailwind + Recharts)
│   ├── src/data/          Base de datos local y lógica de negocio
│   │   ├── db.ts          Esquema, validación, guardado transaccional
│   │   ├── storage.ts     Persistencia: archivo (escritorio) o IndexedDB (Android/web)
│   │   ├── service.ts     Cuentas, categorías, movimientos, transferencias, estadísticas
│   │   ├── google.ts      Sincronización con Google Sheets
│   │   └── backup.ts      Copias JSON y exportación CSV
│   └── android/           Proyecto Android (Capacitor)
├── desktop/               Envoltorio de escritorio (Electron + electron-builder)
│   ├── main.cjs           Archivo de datos, OAuth de Google, diálogos
│   └── preload.cjs        Puente seguro entre la app y el sistema
└── scripts/               Iconos y migración de datos antiguos
```

Toda la lógica vive en la app (`frontend/src/data`), así que las tres plataformas comparten exactamente el mismo código. Cada cambio se aplica sobre una copia y solo se confirma si se guarda bien en disco, y todos los datos que entran (al arrancar o al restaurar una copia) se validan: filas inválidas o huérfanas se descartan en lugar de romper la app.

## Desarrollo

Requisitos: Node.js 18+ (20 recomendado).

```bash
npm run install:all     # instala dependencias de frontend y desktop
npm run dev             # app en el navegador: http://localhost:5173 (datos en IndexedDB)
npm run desktop         # compila y abre la app de escritorio
```

O simplemente `./start.sh` (Linux) / `start.bat` (Windows), que instalan lo necesario y abren la app de escritorio.

### Generar los instaladores

```bash
npm run dist:linux      # release/*.AppImage y *.deb
npm run dist:win        # release/*.exe (en Linux requiere Wine; mejor en Windows o en GitHub Actions)
npm run android:apk     # frontend/android/app/build/outputs/apk/release/app-release.apk
```

Para el APK hace falta JDK 17 y el Android SDK (variable `ANDROID_HOME`), o abrir `frontend/android` con Android Studio.

### Firma del APK

Android solo permite actualizar una app si la nueva versión está firmada con **la misma clave**. La clave de release está en `frontend/android/gestor-release.jks` con sus contraseñas en `frontend/android/keystore.properties` — ninguno de los dos se sube a git. **Guárdalos en un sitio seguro**: si los pierdes, para instalar una versión nueva habría que desinstalar la app (y se borrarían los datos del móvil, salvo que antes exportes una copia).

Para que GitHub Actions firme con esa misma clave, añade estos *secrets* en el repositorio (Settings → Secrets and variables → Actions):

| Secret | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | salida de `base64 -w0 frontend/android/gestor-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | `storePassword` de `keystore.properties` |
| `ANDROID_KEY_ALIAS` | `gestor` |
| `ANDROID_KEY_PASSWORD` | `keyPassword` de `keystore.properties` |

Sin ellos, el APK de GitHub se firma con una clave temporal (se instala bien, pero no puede actualizar uno firmado con otra clave).

### Iconos

`python3 scripts/generate-icons.py` (requiere Pillow) regenera los iconos de escritorio y Android y las pantallas de arranque.

## Notas

- Los balances de cuenta se calculan dinámicamente (no se almacenan), por lo que siempre están en sincronía con tus movimientos.
- En Ubuntu 24.04+ el AppImage arranca sin el sandbox de Chromium, porque el sistema bloquea los *user namespaces* que necesita. El paquete `.deb` sí lo mantiene. La app solo carga su propio contenido local.
