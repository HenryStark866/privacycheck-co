# APIs que necesita el proyecto — Paso a paso completo
## Proyecto Firebase: cavaltec-proyect

El proyecto usa **3 APIs externas**. Aquí el paso a paso exacto para activar cada una.

---

## API 1 — Firebase Admin SDK (clave del servidor)

Esta es la única clave que te falta de Firebase. La necesitas para que el servidor
de Next.js pueda verificar sesiones y leer Firestore de forma segura.

### Cómo obtenerla:

**1.** Ve a → https://console.firebase.google.com/project/cavaltec-proyect/settings/serviceaccounts/adminsdk

*(O manualmente: Firebase Console → ⚙️ arriba izquierda → Configuración del proyecto → pestaña "Cuentas de servicio")*

**2.** Haz clic en el botón azul **"Generar nueva clave privada"**

**3.** Confirma en el popup → se descarga un archivo `.json` llamado algo así:
```
cavaltec-proyect-firebase-adminsdk-xxxxx-yyyyyyyyyy.json
```

**4.** Abre ese archivo con un editor de texto (Bloc de notas, VS Code). Verás algo así:

```json
{
  "type": "service_account",
  "project_id": "cavaltec-proyect",
  "private_key_id": "abc123def456...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMIIEoAIBAAKCAQ...(muchas líneas)...\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@cavaltec-proyect.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  ...
}
```

**5.** Copia estos valores exactos al archivo `.env.local`:

```env
FIREBASE_ADMIN_PROJECT_ID=cavaltec-proyect
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@cavaltec-proyect.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEoAIBAAKCAQ...\n-----END RSA PRIVATE KEY-----\n"
```

> ⚠️ **IMPORTANTE con el `private_key`**:
> - Pégalo **entre comillas dobles** `"..."` en el .env.local
> - Incluye los `\n` exactamente como aparecen en el JSON (NO los conviertas a saltos de línea reales)
> - Es una línea muy larga, no la partas

> 🔒 **Seguridad**: guarda el archivo `.json` en un lugar seguro y NO lo subas a GitHub.
> El `.gitignore` ya está configurado para ignorarlo.

---

## API 2 — Firebase Authentication (Google OAuth)

Tu app ya tiene Firebase Auth activado porque creaste el proyecto.
Ahora debes habilitar el proveedor de Google:

**1.** Ve a → https://console.firebase.google.com/project/cavaltec-proyect/authentication/providers

**2.** En la lista, haz clic en **Google**

**3.** Activa el toggle **"Habilitar"**

**4.** Configura:
   - **Nombre público del proyecto**: `Autodiagnóstico Ley 1581`
   - **Correo electrónico de asistencia del proyecto**: `henrytaborda57@gmail.com`

**5.** Haz clic en **Guardar** ✅

**6.** Agrega los dominios autorizados en Authentication → Settings → **Authorized domains**:
   - `localhost` (ya está por defecto)
   - Cuando despliegues en Vercel: `tu-app.vercel.app`

> ✅ Firebase configura automáticamente las credenciales OAuth de Google.
> No necesitas ir a Google Cloud Console.

---

## API 2B — Firebase Authentication (Microsoft OAuth) — Opcional

Si quieres el botón "Continuar con Microsoft":

### Paso A: Registrar app en Azure

**1.** Ve a → https://portal.azure.com

**2.** En el buscador arriba escribe **"Registros de aplicaciones"** → clic en el resultado

**3.** Clic en **"+ Nuevo registro"**

**4.** Completa el formulario:
   - **Nombre**: `Autodiagnóstico Ley 1581 CAVALTEC`
   - **Tipos de cuenta admitidos**: selecciona la tercera opción:
     *"Cuentas en cualquier directorio organizacional... y cuentas personales de Microsoft"*
   - **URI de redirección**: selecciona `Web` y escribe:
     ```
     https://cavaltec-proyect.firebaseapp.com/__/auth/handler
     ```

**5.** Clic en **Registrar**

**6.** En la pantalla que aparece, copia el **"Id. de aplicación (cliente)"** — se ve así:
   ```
   xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

**7.** En el menú izquierdo ve a **Certificados y secretos** → **+ Nuevo secreto de cliente**
   - Descripción: `firebase-auth`
   - Expiración: 24 meses
   - Clic en **Agregar**
   - **COPIA EL VALOR AHORA** (solo se muestra una vez)

### Paso B: Conectar con Firebase

**8.** Vuelve a → https://console.firebase.google.com/project/cavaltec-proyect/authentication/providers

**9.** Clic en **Microsoft** → activa el toggle

**10.** Pega:
   - **ID de aplicación**: el Id. de aplicación de Azure
   - **Secreto de aplicación**: el Valor del secreto de Azure

**11.** Guarda ✅

---

## API 3 — Firestore Database

**1.** Ve a → https://console.firebase.google.com/project/cavaltec-proyect/firestore

**2.** Clic en **"Crear base de datos"**

**3.** Selecciona **"Iniciar en modo de producción"** (NO modo de prueba)

**4.** Ubicación: selecciona `us-east1` o `southamerica-east1` (São Paulo)
   > São Paulo es la región más cercana a Colombia y tiene menor latencia.

**5.** Clic en **Listo** ✅

### Configurar Security Rules (aislamiento multi-tenant):

**6.** En Firestore → pestaña **"Rules"**

**7.** Borra todo el contenido actual

**8.** Pega el contenido del archivo `firestore.rules` del proyecto

**9.** Clic en **"Publicar"** ✅

---

## API 4 — Anthropic (IA del proyecto)

Esta API le da la inteligencia al diagnóstico: explica preguntas, genera el plan de acción
y el análisis de brechas.

**1.** Ve a → https://console.anthropic.com

**2.** Crea una cuenta o inicia sesión (puedes usar Google)

**3.** Ve a **"API Keys"** en el menú izquierdo

**4.** Clic en **"Create Key"**
   - Nombre: `cavaltec-ley1581`
   - Clic en **Create**

**5.** **COPIA LA CLAVE AHORA** — empieza con `sk-ant-api03-...`
   (solo se muestra una vez)

**6.** Pégala en `.env.local`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxx
   ```

> 💡 Anthropic da $5 USD de crédito gratuito para nuevas cuentas — más que suficiente para el hackathon.

---

## Resultado final: tu `.env.local` completo

```env
# ── Firebase Web (ya tienes estos) ─────────────────────────────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCx2iDmKNK0rxHVqry4MubGsQmbr4_tNEU
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=cavaltec-proyect.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=cavaltec-proyect
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=cavaltec-proyect.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=806618767640
NEXT_PUBLIC_FIREBASE_APP_ID=1:806618767640:web:fab73d34e54c28066dfe6d

# ── Firebase Admin (del JSON descargado) ────────────────────────────────────
FIREBASE_ADMIN_PROJECT_ID=cavaltec-proyect
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@cavaltec-proyect.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEo...\n-----END RSA PRIVATE KEY-----\n"

# ── Anthropic ────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxx

# ── App ────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Checklist para arrancar el proyecto

- [ ] **Firebase Admin SDK**: descargué el JSON → copié `client_email` y `private_key` al `.env.local`
- [ ] **Firebase Auth Google**: activado en Authentication → Sign-in method
- [ ] **Firestore**: base de datos creada en modo producción
- [ ] **Firestore Rules**: contenido de `firestore.rules` publicado
- [ ] **Anthropic**: clave `sk-ant-api03-...` copiada al `.env.local`
- [ ] Ejecutar `npm install` en la carpeta del proyecto
- [ ] Ejecutar `npm run dev` → abrir http://localhost:3000

---

## Para desplegar en Vercel

**1.** Ve a → https://vercel.com/new → importa tu repositorio de GitHub

**2.** En **"Environment Variables"** agrega exactamente las mismas variables del `.env.local`

**3.** Para el `FIREBASE_ADMIN_PRIVATE_KEY` en Vercel:
   - En el campo Name: `FIREBASE_ADMIN_PRIVATE_KEY`
   - En el campo Value: pega la clave **incluyendo** `-----BEGIN...-----END-----` y los `\n`

**4.** En Firebase Console → Authentication → Settings → **Authorized domains**:
   - Agrega `tu-app.vercel.app`

**5.** Deploy ✅
