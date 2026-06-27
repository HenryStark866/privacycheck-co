# Guía de Conexión: Vercel (Nube) a WhatsApp (Local)

Para que tu aplicación web alojada en **Vercel** pueda enviar mensajes de WhatsApp y reaccionar a los mensajes que tus usuarios envían a tu número, tu servidor local de WhatsApp (OpenWA) debe estar expuesto a Internet.

He configurado un **túnel seguro** automático (`localtunnel`) con un dominio fijo para que nunca tengas que estar cambiando las variables en Vercel.

## URL Pública de tu Gateway
Tu enlace fijo y público para la API de WhatsApp ahora es:
**`https://cavaltec-wa-gateway-1234.loca.lt`**

---

## 1. Pasos en tu Equipo (Diario)

Cada vez que vayas a operar el sistema y necesites el bot de WhatsApp activo, debes hacer **dos cosas**:

1. **Iniciar la API de WhatsApp:**
   (Si ya la iniciaste como se indica en las instrucciones, omite este paso).
   Abre una terminal en `OpenWA-main` y ejecuta `npm run dev`. Espera a escanear el QR si no está vinculado, y asegúrate de que diga `CONNECTED`.

2. **Abrir el Túnel de Comunicación:**
   He creado un archivo automático para ti en la raíz del proyecto.
   Haz doble clic en el archivo **`conectar_wa.bat`**.
   *Se abrirá una ventana negra indicando que el túnel está conectado a la URL pública. ¡No la cierres! Vercel usará esta ventana para hablar con tu WhatsApp.*

---

## 2. Configurar Vercel (Solo se hace una vez)

Dado que la URL de tu túnel ahora es fija, solo tienes que configurar Vercel una vez y listo:

1. Entra a tu panel de control en [Vercel](https://vercel.com/) y selecciona tu proyecto `privacycheck-co`.
2. Ve a la pestaña **Settings** (Configuración) -> **Environment Variables** (Variables de Entorno).
3. Busca la variable llamada `OPENWA_API_URL` (o añádela si no existe) e ingresa exactamente este valor:
   `https://cavaltec-wa-gateway-1234.loca.lt`
4. Guarda los cambios.
5. **Importante:** Para que el cambio surta efecto de inmediato, ve a la pestaña **Deployments**, haz clic en los 3 puntitos verticales de tu último despliegue y selecciona **Redeploy** (o utiliza tu script `vercel_deploy_api.ps1` localmente para forzar un nuevo despliegue).

---

## 3. ¿Cómo funciona esta arquitectura?

* **Mensaje Saliente:** Cuando un cliente se registra en la web (Vercel), Vercel envía una petición POST a `https://cavaltec-wa-gateway-1234.loca.lt`. El túnel (`conectar_wa.bat`) la recibe, la pasa a tu puerto 2785 local y el gateway envía el mensaje por tu teléfono vinculado.
* **Mensaje Entrante:** Cuando alguien envía un mensaje a tu número, el gateway lo capta. Gracias a la configuración automática de Webhooks, el gateway envía el mensaje al endpoint `/api/whatsapp/webhook` de tu Vercel en la nube para que la Inteligencia Artificial responda, devolviendo la respuesta por la misma vía.

> **¡Advertencia Localtunnel!** La primera vez que Vercel intenta comunicarse con la URL de localtunnel, Localtunnel suele mostrar una pantalla de advertencia ("Friendly Reminder") para confirmar que estás visitando un sitio. Dado que Vercel hace llamadas API y no puede hacer clic en "Aceptar", es necesario que **tú abras en tu navegador web la URL `https://cavaltec-wa-gateway-1234.loca.lt`** al menos una vez desde la misma IP (tu red) y hagas clic en el botón azul "Click to Continue". ¡Haz esto después de abrir `conectar_wa.bat`!

---

## 4. ✅ PRODUCCIÓN — Gateway en un VPS (recomendado para el reto)

El túnel local es práctico para demos, pero **el requisito de producción es correr el
gateway OpenWA en un VPS accesible 24/7** y apuntar `OPENWA_API_URL` (en Vercel) a esa
URL pública con HTTPS. Así el WhatsApp funciona aunque tu PC esté apagado.

### 4.1. Elige un VPS

Cualquier proveedor con Docker sirve. Opciones rápidas y económicas:

| Proveedor      | Plan mínimo sugerido | Notas |
|----------------|----------------------|-------|
| **Railway**    | Hobby ($5/mes)       | El más rápido: deploy por Git + dominio HTTPS gratis |
| **Render**     | Web Service ($7/mes) | HTTPS automático, disco persistente para la sesión |
| **DigitalOcean / Hetzner / EC2** | Droplet 1–2 GB RAM | Control total, requiere instalar Docker tú mismo |

> Mínimo **1 GB de RAM** (el gateway levanta Chromium para WhatsApp Web). 2 GB es lo ideal.

### 4.2. Desplegar con Docker (VPS propio: DigitalOcean / Hetzner / EC2)

```bash
# En el VPS, ya con Docker y docker-compose instalados:
git clone <tu-repo> && cd OpenWA-main

# Configura las variables del gateway
cp .env.example .env
nano .env          # define API_KEY, sesión, puerto 2785, etc.

# Levanta el gateway (queda corriendo en segundo plano y se reinicia solo)
docker compose up -d

# Verifica que responde
curl http://localhost:2785/api/sessions
```

Luego pon un **reverse proxy con HTTPS** (Caddy o Nginx) delante del puerto 2785 para
obtener una URL pública tipo `https://wa-gateway.tudominio.com`. Con **Caddy** son 2 líneas:

```
# /etc/caddy/Caddyfile
wa-gateway.tudominio.com {
    reverse_proxy localhost:2785
}
```

### 4.3. Desplegar en Railway / Render (sin servidor propio)

1. Crea un nuevo proyecto y conéctalo a la carpeta `OpenWA-main` del repo.
2. El proveedor detecta el `Dockerfile` y construye la imagen automáticamente.
3. Añade un **volumen/disco persistente** montado en la carpeta de datos de sesión
   (`/app/data`) para no perder la vinculación de WhatsApp en cada redeploy.
4. Define las variables de entorno del gateway (API key, puerto `2785`, sesión).
5. Railway/Render te entregan una URL pública HTTPS, p. ej.
   `https://privacycheck-wa.up.railway.app`.

### 4.4. Conectar Vercel al VPS

En Vercel → **Settings → Environment Variables**, define (Production):

| Variable              | Valor                                            |
|-----------------------|--------------------------------------------------|
| `OPENWA_API_URL`      | `https://wa-gateway.tudominio.com` (tu URL VPS)  |
| `OPENWA_API_KEY`      | la misma API key configurada en el gateway       |
| `OPENWA_SESSION_NAME` | `walle` (o el nombre de tu sesión vinculada)     |
| `ADMIN_WHATSAPP_NUMBER` | `57XXXXXXXXXX` (número administrador)           |

Haz **Redeploy** del proyecto en Vercel para que tome las variables.

### 4.5. Vincular el WhatsApp (una sola vez)

Abre el panel de la app → **WhatsApp**, o el dashboard del gateway en
`https://wa-gateway.tudominio.com`, escanea el **QR** con el teléfono y espera el
estado **CONNECTED**. Como el VPS es persistente, la sesión queda vinculada de forma
permanente; no hay que volver a escanear salvo que cierres sesión.

### 4.6. Verificación

```bash
# Debe devolver la lista de sesiones con status "CONNECTED"
curl -H "X-API-Key: TU_API_KEY" https://wa-gateway.tudominio.com/api/sessions
```

En la app, el indicador de estado de WhatsApp debe pasar a **Conectado**. Si el VPS
está caído o `OPENWA_API_URL` es incorrecta, la app **degrada con elegancia**: el resto
del producto (diagnóstico, IA, PDF) sigue funcionando y solo se desactiva el envío de
mensajes.
