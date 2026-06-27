# Guía de Instalación y Ejecución - CAVALTEC Ley 1581

Esta guía contiene los pasos necesarios para descargar, instalar y ejecutar el proyecto en su equipo local de forma exitosa.

## Requisitos Previos

Antes de comenzar, asegúrese de tener instalado lo siguiente en su equipo:
1. **Node.js**: Versión 18 o superior. Puede descargarlo desde [nodejs.org](https://nodejs.org/).
2. **Git**: Opcional, pero recomendado para clonar o descargar actualizaciones.
3. **WhatsApp**: Su dispositivo móvil con WhatsApp abierto para vincular la aplicación (lectura de código QR).

---

## Paso 1: Descargar el Proyecto

1. Descargue el archivo ZIP proporcionado con el proyecto y extráigalo en una carpeta de su elección (por ejemplo, en `Documentos/CavaltecApp`).
2. Solicite el archivo de configuración `.env.local` a su proveedor/administrador y colóquelo en la carpeta principal del proyecto. **Nota:** Este archivo contiene las credenciales de acceso a la base de datos y los servicios de Inteligencia Artificial que garantizan el funcionamiento y la licencia del software.

---

## Paso 2: Ejecutar el Servidor Principal (Aplicación Web)

1. Abra una terminal (Símbolo del sistema o PowerShell en Windows, o Terminal en Mac).
2. Navegue hasta la carpeta principal del proyecto:
   ```bash
   cd ruta/a/la/carpeta/del/proyecto
   ```
3. Instale las dependencias necesarias ejecutando:
   ```bash
   npm install
   ```
4. Inicie la aplicación en modo producción:
   ```bash
   npm run build
   npm start
   ```
   *La aplicación ahora estará disponible ingresando a http://localhost:3000 en su navegador.*

---

## Paso 3: Ejecutar el Servicio de WhatsApp (Gateway)

El sistema incluye un servicio encargado de la comunicación con WhatsApp (OpenWA). Es necesario iniciarlo en paralelo.

1. Abra **otra ventana de terminal** (manteniendo abierta la anterior).
2. Navegue a la subcarpeta `OpenWA-main` dentro del proyecto:
   ```bash
   cd ruta/a/la/carpeta/del/proyecto/OpenWA-main
   ```
3. Instale las dependencias del gateway:
   ```bash
   npm install
   ```
4. Inicie el servicio de WhatsApp:
   ```bash
   npm run dev
   ```

---

## Paso 4: Vincular su WhatsApp

Una vez que el servicio de WhatsApp (OpenWA) esté ejecutándose:
1. Revise los mensajes en la segunda terminal que abrió. 
2. El sistema generará un **Código QR**. 
3. Abra WhatsApp en su teléfono móvil, vaya a **Dispositivos Vinculados** y seleccione **Vincular un dispositivo**.
4. Escanee el código QR que aparece en la pantalla de su terminal o en el panel de control del gateway.
5. Una vez escaneado, el estado en la terminal cambiará a `CONNECTED`. 

**¡Listo!** El sistema ya puede interactuar vía WhatsApp y la aplicación web estará disponible localmente para realizar los diagnósticos de la Ley 1581.

---

## Notas de Licenciamiento y Control

- **Control del Software:** El funcionamiento completo de este sistema depende de las credenciales remotas (Bases de datos Supabase, Servicios IA) provistas en el archivo `.env.local`. Si por algún motivo se requiere pausar o suspender la operación, el administrador del sistema desactivará los accesos de la base de datos remota, interrumpiendo el funcionamiento local de la aplicación.
- No altere ni comparta el archivo `.env.local` con terceros, ya que su uso está monitoreado.
