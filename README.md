# CAVALTEC Ley 1581 - Autodiagnóstico y Gateway WhatsApp

Plataforma de autodiagnóstico empresarial para el cumplimiento de la **Ley 1581 de 2012** en Colombia, con integración nativa a WhatsApp mediante Inteligencia Artificial.

## Arquitectura del Sistema

Este proyecto consta de dos partes principales:
1. **Frontend / Backend Web (Next.js)**: Alojado en la nube (Vercel), maneja la autenticación (Supabase OAuth), la interfaz de usuario, los formularios de diagnóstico interactivos, la generación de reportes en PDF y la comunicación con Anthropic (IA).
2. **WhatsApp Gateway (OpenWA)**: Servidor de Node.js local que actúa como puente (gateway) entre los servidores de WhatsApp y la plataforma en la nube, usando `localtunnel` para exponerse.

---

## Iniciar el Entorno Local Automáticamente

Si deseas arrancar tanto el servidor de WhatsApp como el túnel de comunicación con un solo clic:
1. Ejecuta el archivo **`conectar_wa.bat`** ubicado en la raíz.
2. Se abrirán dos ventanas: una con el túnel público apuntando a Vercel, y otra con la consola de OpenWA.
3. (Opcional) Si la aplicación web está corriendo en Vercel, solo necesitas esto. Si deseas correr la app web en local, abre otra terminal y ejecuta `npm run dev`.

---

## Configuración y Variables de Entorno

### 1. Proyecto Next.js (Vercel / Local)
Copia el archivo `.env.local.example` a `.env.local` y configura:
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY` o `GEMINI_API_KEY`
- `OPENWA_API_URL`: (Por defecto `https://cavaltec-wa-gateway-1234.loca.lt`)

### 2. WhatsApp Gateway (OpenWA)
Se encuentra dentro de la carpeta `/OpenWA-main`. 
No es necesario configurar base de datos ya que por defecto utiliza SQLite para guardar las sesiones locales.

---

## Despliegue (Deploy)

El proyecto incluye scripts automatizados para facilitar el despliegue en Vercel:
- `commit_all.bat`: Añade los cambios y los sube a GitHub para activar el auto-deploy de Vercel.
- `vercel_deploy_api.ps1`: Script PowerShell para desplegar de forma manual utilizando Vercel CLI.

## Estructura de Directorios Clave

```
/src
 ├── app/             # Rutas, API endpoints y UI de Next.js
 ├── components/      # Componentes UI (React)
 ├── lib/             # Lógica de negocio (whatsapp.ts, scoring, IA, Supabase)
/OpenWA-main          # Submódulo para el Gateway de WhatsApp (NestJS)
```

## Solución de Problemas (Troubleshooting)

- **Error 502 / Bad Gateway en WhatsApp:** Vercel está bloqueado por la pantalla "Friendly Reminder" de localtunnel. Asegúrate de tener la última versión del código donde se incluye la cabecera `Bypass-Tunnel-Reminder: true` en las peticiones de `src/lib/whatsapp.ts`.
- **OpenWA se cierra inmediatamente:** Asegúrate de no haber borrado la carpeta `dist` de OpenWA. Si ocurre, entra a `OpenWA-main` y ejecuta `npm run build`.
