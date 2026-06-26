# Guía completa: Obtener credenciales de Firebase
## Para el proyecto Autodiagnóstico Ley 1581 — CAVALTEC

Necesitas **dos grupos de claves**:
- **Firebase Web App** (cliente/browser): para autenticación y Firestore desde Next.js
- **Firebase Admin SDK** (servidor): para las API routes en Next.js (nunca se expone al cliente)

---

## PARTE 1 — Crear el proyecto en Firebase

### Paso 1: Acceder a Firebase Console

1. Ve a **https://console.firebase.google.com**
2. Inicia sesión con tu cuenta de Google (henrytaborda57@gmail.com)
3. Haz clic en **"Crear un proyecto"** (o "Add project")

### Paso 2: Configurar el proyecto

1. **Nombre del proyecto**: `cavaltec-ley1581` (o el nombre que prefieras)
2. **Google Analytics**: puedes desactivarlo para este proyecto (toggle OFF)
3. Haz clic en **"Crear proyecto"** y espera ~30 segundos

---

## PARTE 2 — Obtener claves de la Web App (cliente)

Estas claves van en las variables `NEXT_PUBLIC_*` y son seguras para el cliente.

### Paso 3: Registrar la aplicación web

1. En la pantalla principal del proyecto, haz clic en el ícono **`</>`** (Web)
2. **Nombre de la app**: `ley1581-web`
3. **Firebase Hosting**: NO lo actives (usaremos Vercel)
4. Haz clic en **"Registrar app"**

### Paso 4: Copiar la configuración

Verás un bloque como este — **copia estos valores**:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "cavaltec-ley1581.firebaseapp.com",
  projectId: "cavaltec-ley1581",
  storageBucket: "cavaltec-ley1581.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};
```

Estos valores se usarán en tu `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=cavaltec-ley1581.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=cavaltec-ley1581
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=cavaltec-ley1581.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

---

## PARTE 3 — Obtener claves del Admin SDK (servidor)

Estas claves son **secretas** — nunca van en el cliente ni en el repositorio.

### Paso 5: Generar la Service Account Key

1. En Firebase Console, ve a ⚙️ **Configuración del proyecto** (engranaje arriba a la izquierda)
2. Selecciona la pestaña **"Cuentas de servicio"** (Service accounts)
3. Haz clic en **"Generar nueva clave privada"**
4. Confirma en el popup → se descargará un archivo `.json` llamado algo como:
   `cavaltec-ley1581-firebase-adminsdk-xxxxx.json`

5. Abre ese archivo JSON. Tendrá esta estructura:

```json
{
  "type": "service_account",
  "project_id": "cavaltec-ley1581",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMIIEo...\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@cavaltec-ley1581.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

6. Copia estos tres valores al `.env.local`:

```env
FIREBASE_ADMIN_PROJECT_ID=cavaltec-ley1581
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@cavaltec-ley1581.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEo...\n-----END RSA PRIVATE KEY-----\n"
```

> ⚠️ **IMPORTANTE**: El `private_key` contiene saltos de línea `\n`. En el `.env.local`
> escríbelo entre comillas dobles exactamente como aparece en el JSON.

---

## PARTE 4 — Activar Firebase Authentication

### Paso 6: Habilitar el servicio de Auth

1. En el menú izquierdo, ve a **"Authentication"** → **"Comenzar"**
2. Ve a la pestaña **"Sign-in method"**

### Paso 7: Activar proveedor Google

1. Haz clic en **Google** → toggle **Habilitar**
2. **Nombre público del proyecto**: `Autodiagnóstico Ley 1581`
3. **Email de soporte**: `henrytaborda57@gmail.com`
4. Haz clic en **Guardar**

✅ Firebase usa automáticamente las credenciales OAuth de Google — no necesitas ir a Google Cloud Console.

### Paso 8: Activar proveedor Microsoft (Azure)

1. Haz clic en **Microsoft** → toggle **Habilitar**
2. Necesitas credenciales de Azure AD:

#### Obtener credenciales de Microsoft Azure:

**a)** Ve a **https://portal.azure.com**
**b)** Busca **"Registros de aplicaciones"** → **"Nuevo registro"**
**c)** Configura:
   - Nombre: `Autodiagnóstico Ley 1581`
   - Tipos de cuenta: **"Cuentas en cualquier directorio organizacional y cuentas personales de Microsoft"**
   - URI de redirección: `https://cavaltec-ley1581.firebaseapp.com/__/auth/handler`
**d)** Haz clic en **Registrar**
**e)** Copia el **ID de aplicación (cliente)** → es tu `Application (client) ID`
**f)** Ve a **Certificados y secretos** → **Nuevo secreto de cliente** → copia el **Valor** (no el ID)

**g)** Vuelve a Firebase Console → Microsoft provider:
   - **ID de aplicación**: pega el Application (client) ID
   - **Secreto de aplicación**: pega el Valor del secreto
   - Guarda

### Paso 9: Configurar dominios autorizados

1. En Authentication → **"Settings"** → **"Authorized domains"**
2. Agrega tu dominio de Vercel: `tu-app.vercel.app`
3. `localhost` ya está por defecto

---

## PARTE 5 — Configurar Firestore

### Paso 10: Crear la base de datos

1. En el menú izquierdo, ve a **"Firestore Database"** → **"Crear base de datos"**
2. **Modo de inicio**: selecciona **"Iniciar en modo de producción"**
3. **Ubicación**: selecciona `us-east1` o `southamerica-east1` (São Paulo, más cercano a Colombia)
4. Haz clic en **"Listo"**

### Paso 11: Desplegar las Security Rules

Las reglas de seguridad (equivalente al RLS de Supabase) se configuran en el archivo
`firestore.rules` que ya está en el proyecto. Para aplicarlas:

**Opción A — Desde la consola** (más fácil para el hackathon):
1. Ve a Firestore → **"Rules"**
2. Borra el contenido actual y pega el contenido de `firestore.rules`
3. Haz clic en **"Publicar"**

**Opción B — Firebase CLI**:
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # selecciona tu proyecto
firebase deploy --only firestore:rules
```

---

## PARTE 6 — Archivo .env.local completo

Crea el archivo `.env.local` en la raíz del proyecto con todas las claves:

```env
# ─── Firebase Web App (cliente — NEXT_PUBLIC son seguros) ─────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=cavaltec-ley1581.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=cavaltec-ley1581
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=cavaltec-ley1581.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890

# ─── Firebase Admin SDK (servidor — NUNCA exponer al cliente) ─────────────
FIREBASE_ADMIN_PROJECT_ID=cavaltec-ley1581
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@cavaltec-ley1581.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEoAIBAAK...\n-----END RSA PRIVATE KEY-----\n"

# ─── Anthropic ────────────────────────────────────────────────────────────
# Obtén tu clave en https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXXXXXX

# ─── App ──────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## PARTE 7 — Configurar en Vercel (despliegue)

Cuando despliegues en Vercel, agrega las mismas variables en:
**Vercel Dashboard → tu proyecto → Settings → Environment Variables**

Para el `FIREBASE_ADMIN_PRIVATE_KEY` en Vercel:
- En el campo "Value" pega la clave **incluyendo** los `\n` — Vercel los interpreta correctamente.

---

## Resumen de URLs importantes

| Servicio | URL |
|----------|-----|
| Firebase Console | https://console.firebase.google.com |
| Azure Portal (Microsoft OAuth) | https://portal.azure.com |
| Anthropic API Keys | https://console.anthropic.com |
| Vercel Dashboard | https://vercel.com/dashboard |

---

## Checklist final ✅

- [ ] Proyecto Firebase creado
- [ ] Web App registrada → 6 variables `NEXT_PUBLIC_FIREBASE_*` copiadas
- [ ] Service Account JSON descargado → 3 variables `FIREBASE_ADMIN_*` copiadas
- [ ] Firebase Auth activado con Google
- [ ] Firebase Auth activado con Microsoft (opcional para demo)
- [ ] Firestore creado en modo producción
- [ ] Security Rules publicadas desde `firestore.rules`
- [ ] Anthropic API Key obtenida
- [ ] `.env.local` creado con todas las variables
