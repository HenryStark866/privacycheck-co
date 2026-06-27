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
