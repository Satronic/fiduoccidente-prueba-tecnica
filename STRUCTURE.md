# Estructura del Proyecto y Justificación

Este documento describe la estructura de directorios propuesta para el proyecto de Flujo de Aprobaciones y la justificación detrás de cada decisión, buscando promover la modularidad, mantenibilidad y escalabilidad.

## Principios Generales

* **Modularidad:** Agrupación del código por funcionalidad/característica o por capa técnica.
* **Separación de Responsabilidades (SoC):** Cada módulo/directorio tiene una responsabilidad clara.
* **Nomenclatura en Inglés:** Todos los nombres de archivos y directorios que contienen código fuente se mantendrán en inglés para consistencia y comprensión universal. Los comentarios y la documentación textual (como este archivo) se mantendrán en español.

## Estructura General del Proyecto

```text
fiduoccidente-prueba-tecnica/
├── backend/                                # Código fuente y configuración del Backend (AWS Lambda, API Gateway, etc.)
├── frontend/                               # Código fuente y configuración del Frontend (React)
├── docs/                                   # Documentación general del proyecto (modelo de datos, API, bocetos)
├── .gitignore                              # Especifica archivos y directorios ignorados por Git
└── README.md                               # README principal del proyecto
```

## Backend (`backend/`)

La estructura del backend está diseñada para una aplicación serverless utilizando AWS Lambda, API Gateway y DynamoDB.

```
backend/
│   ├── .aws-sam/                           # (Generado por AWS SAM si se usa)
│   ├── .serverless/                        # (Generado por Serverless Framework si se usa)
│   ├── src/                                # Código fuente de la aplicación backend
│   │   ├── handlers/                       # Funciones Lambda individuales (puntos de entrada para API Gateway)
│   │   │   ├── purchaseRequests/           # Agrupación por recurso/característica
│   │   │   │   ├── createRequest.ts
│   │   │   │   ├── getRequestById.ts
│   │   │   │   └── listUserRequests.ts
│   │   │   ├── approvals/
│   │   │   │   ├── getApprovalInfo.ts
│   │   │   │   ├── validateOtp.ts
│   │   │   │   └── submitDecision.ts
│   │   │   ├── evidence/
│   │   │   │   └── generatePdf.ts
│   │   │   └── utils/                      # Handlers para utilidades (ej. mockMail.ts)
│   │   │       └── mockMail.ts
│   │   ├── services/                       # Lógica de negocio, desacoplada de los handlers
│   │   │   ├── purchaseRequestService.ts
│   │   │   ├── approvalService.ts
│   │   │   └── pdfService.ts
│   │   ├── repositories/                   # (Opcional) Abstracción para la interacción con DynamoDB
│   │   │   ├── purchaseRequestRepository.ts
│   │   │   └── approverRepository.ts
│   │   ├── utils/                          # Funciones de utilidad compartidas
│   │   │   └── otpGenerator.ts
│   │   ├── models/                         # (Opcional) Definiciones de tipos/interfaces para entidades
│   │   │   ├── IPurchaseRequest.ts
│   │   │   └── IApprover.ts
│   │   └── common/                         # Código común (respuestas HTTP, errores personalizados)
│   │       ├── httpResponses.ts
│   │       └── customErrors.ts
│   ├── tests/                              # Pruebas (unitarias, integración)
│   │   ├── unit/
│   │   │   ├── handlers/
│   │   │   └── services/
│   │   └── integration/
│   ├── template.yaml                       # (Si usas AWS SAM)
│   ├── serverless.yml                      # (Si usas Serverless Framework)
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md                           # README específico del backend
```

### Justificación (Backend):

* **`src/handlers/`**:
    * **Propósito:** Contiene las funciones Lambda que actúan como puntos de entrada directos para las rutas de API Gateway.
    * **Modularidad:** Cada handler es pequeño y se enfoca en recibir el evento, validar/transformar la entrada básica, invocar un servicio y formatear la respuesta HTTP. Agruparlos por recurso (ej. `purchaseRequests`, `approvals`) mejora la organización.
* **`src/services/`**:
    * **Propósito:** Alberga la lógica de negocio principal de la aplicación. Los handlers delegan las operaciones complejas a estos servicios.
    * **Calidad y Testeabilidad:** Esta separación permite probar la lógica de negocio de forma aislada, sin depender directamente del formato de evento/contexto de Lambda, lo que facilita las pruebas unitarias.
* **`src/repositories/`**:
    * **Propósito:** Abstrae la comunicación con la base de datos (DynamoDB). Proporciona una capa de acceso a datos.
    * **Mantenibilidad:** Si la forma de interactuar con la base de datos cambia, o si se decidiera cambiar de base de datos (aunque DynamoDB es un requisito aquí), las modificaciones se concentrarían en esta capa.
* **`src/utils/`**, **`src/models/`**, **`src/common/`**:
    * **Propósito:** Proveen utilidades reutilizables, definiciones de tipos de datos (interfaces TypeScript) y elementos comunes como formateadores de respuestas o manejo de errores personalizados, respectivamente, promoviendo el principio DRY (Don't Repeat Yourself).
* **`tests/`**:
    * **Propósito:** Contiene todas las pruebas automatizadas, con subdirectorios para pruebas unitarias e de integración, reflejando la estructura de `src/` para facilitar la localización de las pruebas correspondientes a cada módulo.
* **`template.yaml` / `serverless.yml`**:
    * **Propósito:** Archivo de definición de Infraestructura como Código (IaC) para AWS SAM o Serverless Framework. Describe todos los recursos de AWS necesarios (Lambdas, API Gateway, DynamoDB, S3, roles IAM, etc.).

---

## Frontend (`frontend/`)

Estructura para una aplicación React moderna, enfocada en la modularidad por características (feature-based).

```
frontend/
│   ├── public/                           # Assets estáticos y HTML raíz
│   │   ├── index.html
│   │   └── ...
│   ├── src/                              # Código fuente de la aplicación React
│   │   ├── assets/                       # Imágenes, fuentes, etc.
│   │   ├── components/                   # Componentes de UI reutilizables
│   │   │   ├── common/                   # Componentes muy genéricos (Button, Input, Modal)
│   │   │   ├── layout/                   # Componentes de estructura (Navbar, PageLayout)
│   │   │   └── ui/                       # (Opcional) Componentes de UI más específicos pero reutilizables
│   │   ├── features/                     # (O Módulos) Componentes y lógica agrupados por característica
│   │   │   ├── purchaseRequests/
│   │   │   │   ├── CreateRequestForm.tsx
│   │   │   │   ├── RequestsList.tsx
│   │   │   │   └── requestService.ts     # Lógica de API específica de esta feature
│   │   │   ├── approvals/
│   │   │   │   ├── OtpForm.tsx
│   │   │   │   └── ApprovalDecision.tsx
│   │   │   └── evidence/
│   │   │       └── DownloadPdfButton.tsx
│   │   ├── hooks/                        # Custom Hooks de React reutilizables
│   │   ├── pages/                        # Componentes que representan vistas/páginas completas
│   │   │   ├── CreateRequestPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   └── ApprovalPage.tsx
│   │   ├── services/                     # Servicios generales (cliente API, etc.)
│   │   │   └── apiClient.ts
│   │   ├── contexts/                     # Manejo de estado global con Context API
│   │   │   └── NotificationContext.tsx
│   │   ├── routes/                       # Configuración de rutas (React Router)
│   │   │   └── AppRoutes.tsx
│   │   ├── styles/                       # Estilos globales, temas
│   │   ├── utils/                        # Funciones de utilidad generales
│   │   ├── App.tsx                       # Componente raíz de la aplicación
│   │   ├── index.tsx                     # Punto de entrada de React
│   │   └── react-app-env.d.ts
│   ├── tests/                            # Pruebas del frontend
│   │   ├── unit/
│   │   │   ├── components/
│   │   │   └── features/
│   │   └── e2e/                          # (Opcional) Pruebas End-to-End
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md                         # README específico del frontend
```

### Justificación (Frontend):

* **`src/components/`**:
    * **Propósito:** Contiene componentes de UI puros y reutilizables.
    * **`common/`**: Para componentes atómicos como botones, inputs, que se usan en múltiples lugares.
    * **`layout/`**: Para la estructura visual principal de la aplicación.
* **`src/features/` (o `src/modules/`)**:
    * **Propósito:** Esta es la clave para la modularidad. Cada "feature" (característica principal como `purchaseRequests` o `approvals`) tiene su propio directorio con todos los componentes, hooks, y lógica de servicios que le pertenecen exclusivamente.
    * **Escalabilidad y Mantenibilidad:** Facilita encontrar y modificar el código relacionado con una funcionalidad específica. Reduce el acoplamiento entre diferentes partes de la aplicación.
* **`src/pages/`**:
    * **Propósito:** Componentes que representan una vista completa o una "página" a la que el usuario navega. Usualmente, estos componentes importan y orquestan varios componentes de `features/` y `components/common/`.
* **`src/hooks/`**, **`src/services/`**, **`src/contexts/`**, **`src/routes/`**, **`src/styles/`**, **`src/utils/`**:
    * **Propósito:** Proveen funcionalidades transversales y bien definidas: hooks personalizados para lógica reutilizable, servicios para la comunicación con el backend, manejo de estado global, configuración de enrutamiento, estilos globales y utilidades genéricas, respectivamente.
* **`tests/`**:
    * **Propósito:** Similar al backend, estructura paralela a `src/` para las pruebas, separando unitarias y (opcionalmente) E2E.

---

