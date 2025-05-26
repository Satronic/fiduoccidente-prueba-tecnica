# Prueba Técnica: Flujo de Aprobaciones Fiduoccidente

Este proyecto es una implementación Fullstack de un flujo de aprobaciones con firma digital concatenadas, desarrollado como parte de la prueba técnica para Fiduoccidente. La aplicación web permite a un usuario "Solicitante" crear solicitudes de compra que luego deben ser aprobadas por tres "Aprobadores" designados, culminando en la generación de un PDF de evidencia.

## Tabla de Contenidos

1.  [Visión General de la Funcionalidad](#visión-general-de-la-funcionalidad)
2.  [Arquitectura y Stack Tecnológico](#arquitectura-y-stack-tecnológico)
3.  [Estructura del Proyecto](#estructura-del-proyecto)
4.  [Configuración y Despliegue](#configuración-y-despliegue)
    * [Prerrequisitos](#prerrequisitos)
    * [Backend](#backend)
    * [Frontend](#frontend)
5.  [Cómo Probar la Aplicación](#cómo-probar-la-aplicación)
    * [Flujo del Solicitante](#flujo-del-solicitante)
    * [Flujo del Aprobador](#flujo-del-aprobador)
6.  [Decisiones de Diseño y Supuestos](#decisiones-de-diseño-y-supuestos)
7.  [Posibles Mejoras y Funcionalidades Futuras](#posibles-mejoras-y-funcionalidades-futuras)
8.  [Información del Desarrollador](#información-del-desarrollador)

## Visión General de la Funcionalidad

La aplicación implementa el siguiente flujo principal:

1.  **Creación de Solicitud:** Un usuario "Solicitante" crea una solicitud de compra ingresando título, descripción, monto y los correos electrónicos de tres aprobadores.
2.  **Generación de Flujo de Aprobaciones:** El sistema registra la solicitud con estado "Pendiente" y genera un token único (UUID) para cada aprobador, que se usaría para un link de aprobación enviado por email (simulado).
3.  **Proceso de Aprobación con OTP:** El aprobador accede al link, llega a una pantalla donde debe ingresar un OTP generado por el sistema (simulado, único y válido por 3 minutos).
4.  **Decisión del Aprobador:** Si el OTP es correcto, visualiza el detalle de la compra y puede aprobar (registrando firma simulada: nombre + fecha) o rechazar.
5.  **Visualización del Estado:** El solicitante puede ver el estado de sus solicitudes y el estado de cada aprobador.
6.  **Generación de PDF:** Al completarse las 3 firmas, el backend genera un PDF con los datos de la solicitud y las firmas. (Actualmente, el flujo de estados se completa hasta "FullyApproved", la generación y descarga del PDF es una funcionalidad pendiente/simplificada).
7.  **Cierre del Proceso:** La solicitud pasa a "Completada" (o "CompletedPdfGenerated" si el PDF se generara) y el frontend muestra un botón para descargar el PDF.

## Arquitectura y Stack Tecnológico

La aplicación sigue un patrón de arquitectura cliente-servidor.

**Backend:**
* **Lenguaje/Runtime:** Node.js con TypeScript.
* **Framework/Plataforma:** AWS Serverless (AWS Lambda, API Gateway).
* **Base de Datos:** Amazon DynamoDB (NoSQL).
* **Almacenamiento de Archivos:** Amazon S3 (para el PDF de evidencia).
* **Infraestructura como Código (IaC):** AWS CDK (Cloud Development Kit) con TypeScript.
* **Principales Librerías SDK:** `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`.

**Frontend:**
* **Framework/Librería:** React v18+ con TypeScript.
* **Enrutamiento:** React Router DOM.
* **Peticiones HTTP:** Axios.
* **Gestor de Paquetes:** npm.
* **Herramienta de Build:** Vite.

**Principios y Buenas Prácticas:**
* Código Limpio y principios SOLID (donde aplica).
* Separación de responsabilidades en capas (handlers, services, repositories en backend; features, components, pages, services en frontend).
* Nomenclatura en inglés para código fuente, variables, funciones, tablas y atributos.
* Commits convencionales para el control de versiones.
* Manejo de ambientes (dev, evaluation/prod) en el backend con CDK.

## Estructura del Proyecto

El repositorio está organizado en dos directorios principales: `backend/` y `frontend/`. Se incluye un archivo `PROJECT_STRUCTURE.md` con el detalle y justificación de la estructura interna de cada uno.

* `backend/`: Contiene el proyecto AWS CDK y el código fuente de las funciones Lambda.
    * `lib/`: Definición del Stack de CDK.
    * `src/handlers/`: Código de las funciones Lambda.
* `frontend/`: Contiene el proyecto React (Vite).
    * `src/`: Código fuente de la aplicación React.
    * `src/features/`: Componentes y lógica agrupados por funcionalidad.
* `docs/`: Documentación del proyecto, incluyendo `data-model.md` y `openapi.yaml`/`openapi.json`.

## Configuración y Despliegue

### Prerrequisitos

* Node.js (v18 o superior) y npm.
* AWS CLI configurada con credenciales de un usuario IAM con permisos suficientes y una región por defecto (ej. `us-east-1`).
* AWS CDK Toolkit instalado globalmente (`npm install -g aws-cdk`).
* Docker (instalado y en ejecución, requerido por AWS CDK para empaquetar algunas Lambdas `NodejsFunction`).
* Git.

### Backend

1.  **Bootstrap de CDK (si es la primera vez en la cuenta/región):**
    ```bash
    # Desde la raíz del proyecto
    cd backend/
    cdk bootstrap aws://TU_ID_DE_CUENTA_AWS/TU_REGION # ej. us-east-1
    ```
2.  **Instalar Dependencias:**
    ```bash
    # Desde la carpeta backend/
    npm install
    ```
3.  **Desplegar el Stack (para el ambiente de evaluación `dev`):**
    ```bash
    # Desde la carpeta backend/
    cdk deploy --context environment=dev 
    ```
    Esto desplegará las tablas DynamoDB, el bucket S3, las funciones Lambda y la API Gateway. La URL base de la API (`https://ojk7frnju0.execute-api.us-east-1.amazonaws.com/dev`) se mostrará en los outputs del despliegue.

### Frontend

1.  **Instalar Dependencias:**
    ```bash
    # Desde la raíz del proyecto
    cd frontend/
    npm install
    ```
2.  **Configurar Variables de Entorno:**
    * Crea un archivo `.env` en la raíz de la carpeta `frontend/`.
    * Añade la URL base de tu API Gateway desplegada:
        ```
        VITE_API_BASE_URL=[https://ojk7frnju0.execute-api.us-east-1.amazonaws.com/dev](https://ojk7frnju0.execute-api.us-east-1.amazonaws.com/dev)
        ```
3.  **Ejecutar en Desarrollo Local:**
    ```bash
    # Desde la carpeta frontend/
    npm run dev
    ```
    La aplicación estará disponible en `http://localhost:xxxx` (Vite usualmente usa el puerto 5173 por defecto).
4.  **Construir para Producción:**
    ```bash
    # Desde la carpeta frontend/
    npm run build
    ```
    Esto generará la carpeta `dist/`.
5.  **Despliegue del Frontend (Netlify):**
    * El sitio está desplegado en Netlify.
    * **URL del Frontend Desplegado:** `https://6834a238c3c24a138e437eb9--silly-lolly-b4f6ed.netlify.app/`

## Cómo Probar la Aplicación

**URL del Frontend:** `https://6834a238c3c24a138e437eb9--silly-lolly-b4f6ed.netlify.app/`
**URL Base de la API:** `https://ojk7frnju0.execute-api.us-east-1.amazonaws.com/dev`

### Flujo del Solicitante

1.  **Configurar Email del Solicitante:** En la barra de navegación del frontend, hay un campo para ingresar un email. Este email se usará para el header `X-Requester-Email` en las llamadas API. Ingresa un email de prueba (ej. `solicitante@example.com`) y haz clic en "Configurar".
2.  **Crear una Solicitud:**
    * Navega a "Crear Solicitud".
    * Completa el formulario (Título, Descripción, Monto, 3 correos de aprobadores).
    * Envía el formulario. Deberías ver un mensaje de éxito.
3.  **Ver Lista de Solicitudes:**
    * Navega al "Dashboard Solicitudes" (ruta principal `/`).
    * Deberías ver la solicitud creada en la lista, con su estado y un botón "Ver Detalles".
4.  **Ver Detalle de Solicitud:**
    * Haz clic en "Ver Detalles" para una solicitud.
    * Se mostrará la información completa de la solicitud en un panel y el estado de cada uno de los 3 aprobadores (inicialmente "Pendiente OTP" o similar) en otro panel.

### Flujo del Aprobador

1.  **Obtener el Link de Aprobación:**
    * Después de crear una solicitud, la función Lambda `CreatePurchaseRequestFunction` (en el backend) loguea en **CloudWatch Logs** los links de aprobación simulados para cada uno de los tres aprobadores.
    * Para probar, necesitarás acceder a CloudWatch Logs:
        * Ve a la consola de AWS -> CloudWatch -> Log Groups.
        * Busca el grupo de logs `/aws/lambda/CreatePurchaseRequestFunction-dev` (o el ambiente correspondiente).
        * Abre el stream de logs más reciente y busca los links generados. El link utilizará la `FRONTEND_URL` configurada en las variables de entorno de la Lambda.
2.  **Acceder al Link:** Copia y pega uno de los links de aprobación en tu navegador. Esto te llevará a la página `/approve` del frontend.
3.  **Ingresar OTP:**
    * La página de aprobación primero llamará al backend para obtener los detalles de la solicitud y el backend generará y guardará un OTP (válido por 3 minutos).
    * Para esta prueba, el OTP **NO** se muestra en el frontend. Deberás obtenerlo de los **CloudWatch Logs** de la función Lambda `GetApprovalInfoFunction-dev` (o el ambiente correspondiente). Busca el log que dice "OTP generado para ... : XXXXXX".
    * Ingresa este OTP de 6 dígitos en el formulario del frontend.
4.  **Tomar Decisión:**
    * Si el OTP es válido, se mostrarán los detalles de la compra y los botones "Aprobar" y "Rechazar", junto con un campo para tu nombre (firma).
    * Ingresa tu nombre y toma una decisión.
5.  **Verificar Actualización de Estado:**
    * Después de que los tres aprobadores hayan tomado su decisión (o uno haya rechazado), puedes volver al Dashboard del Solicitante en el frontend y ver cómo se actualizó el estado de la solicitud y de los aprobadores.

## Decisiones de Diseño y Supuestos

* **Autenticación Simplificada:** Para los endpoints del solicitante, se utiliza un header `X-Requester-Email` para simular la identidad del usuario. Para los aprobadores, la autorización inicial se basa en la unicidad del `approver_token` en el link, y luego el `X-Approver-Token` en headers para las acciones subsecuentes. En un sistema de producción, se implementaría un sistema de autenticación robusto (ej. AWS Cognito, JWT).
* **Simulación de Envío de Correos:** El envío de correos electrónicos con los links de aprobación y OTPs se simula mediante logs en CloudWatch.
* **Simulación de OTP:** El OTP se genera y se loguea en CloudWatch para fines de prueba. No se envía por un canal secundario real.
* **Generación de PDF:** El flujo de estados contempla la finalización para la generación del PDF (`FullyApproved`). La generación del archivo PDF en sí y su descarga (`GET /purchase-requests/{id}/evidence.pdf`) **no está implementada** en esta versión debido a restricciones de tiempo. El botón de descarga en el frontend podría aparecer si el estado es el correcto, pero el endpoint de descarga del PDF no está funcional.
* **Aprobadores:** Se asume que los aprobadores se definen por su correo electrónico al momento de crear la solicitud, no son usuarios preexistentes en un sistema de gestión de usuarios.
* **Flujo de Aprobación:** Se ha implementado un flujo donde los tres aprobadores deben aprobar para que la solicitud se considere "Totalmente Aprobada". Si uno rechaza, la solicitud general se marca como "Rechazada".
* **Manejo de Errores:** Se ha implementado manejo básico de errores y validaciones. En producción, se añadiría un logging más detallado y posiblemente un sistema de monitoreo más robusto.
* **Cobertura de Pruebas:** El requisito de >60% de cobertura de pruebas unitarias es un objetivo que se abordaría con más tiempo.

## Posibles Mejoras y Funcionalidades Futuras

* Implementación de un sistema de autenticación y autorización completo (ej. AWS Cognito).
* Envío real de notificaciones por correo electrónico (ej. con Amazon SES).
* Implementación completa de la generación, almacenamiento en S3 y descarga segura de PDFs de evidencia.
* Flujo de aprobación secuencial si fuera un requisito.
* Interfaz de administración para gestionar usuarios/roles.
* Pruebas unitarias y de integración exhaustivas.
* Pipeline de CI/CD para despliegues automatizados.
* Mejoras en la interfaz de usuario y experiencia de usuario, incluyendo manejo más robusto de estados de carga y errores.
