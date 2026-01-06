# Formulario de Declaración de Obras Dramáticas

Formulario web interactivo para declarar obras dramáticas, integrado con Power Automate.

## Características

- ✅ Formulario de una sola página
- ✅ 5 secciones visuales diferenciadas
- ✅ Validación en tiempo real
- ✅ Tabla dinámica de participaciones
- ✅ Validación de porcentajes por rol (máximo 100% por clase)
- ✅ Carga de imagen de firma (PNG, JPG, JPEG - máx. 5MB)
- ✅ Integración con Power Automate
- ✅ Diseño responsive
- ✅ Colores institucionales (#097137, #575656, #FFFFFF)

## Estructura de Archivos

```
Formulario Obras DM/
├── index.html          # Estructura HTML del formulario
├── styles.css          # Estilos CSS
├── script.js           # Lógica JavaScript
├── generos.json        # Datos de géneros dramáticos
├── autores.json        # Datos de autores (reemplazar con datos reales)
└── README.md           # Este archivo
```

## Configuración

### 1. Power Automate URL

Editar `script.js` línea 2:

```javascript
const POWER_AUTOMATE_URL = 'YOUR_POWER_AUTOMATE_URL_HERE';
```

Reemplazar con la URL real de Power Automate.

### 2. Datos JSON

#### Géneros (generos.json)
El archivo ya contiene géneros dramáticos comunes. Puede modificarse según necesidad.

#### Autores (autores.json)
**IMPORTANTE**: Reemplazar con los datos reales de autores. El formato debe ser:

```json
[
  {
    "id": "identificador_unico",
    "text": "Nombre del Autor"
  }
]
```

### 3. Logo

El formulario busca el logo en:
```
ObrasAV-mainTEST/assets/Logo-Fondo-Transparente@3x(1).png
```

Asegúrese de que esta ruta sea correcta o actualice la ruta en `index.html` línea 16.

## Secciones del Formulario

### Sección 1: Títulos de la Obra
- Título de la obra (obligatorio, máx. 300 caracteres)
- Título original (opcional)
- Otro título (opcional)

### Sección 2: Características de la Obra
- Género de la obra (obligatorio, desde JSON)
- Duración de la obra (obligatorio, 1-999 minutos)
- Número de actos (obligatorio, 1-99)
- Duración de la música (obligatorio, 0-999 minutos)
- Duración del texto (obligatorio, 0-999 minutos)

### Sección 3: Información de Estreno y Propiedad Intelectual
- Fecha de estreno (obligatorio)
- Lugar de estreno (obligatorio, máx. 200 caracteres)
- Nº de inscripción DIBAM (opcional, máx. 10 dígitos)
- Fecha de inscripción DIBAM (opcional)

### Sección 4: Participaciones
Tabla dinámica con:
- Clase: Texto, Coreografía, Música, Traducción, Adaptación
- Autor: Selección desde JSON
- % Participación: 0-100

**Validación especial**: La suma de porcentajes por cada clase no puede exceder 100%.

### Sección 5: Firma
- Carga de imagen de firma (PNG, JPG, JPEG)
- Tamaño máximo: 5MB
- Vista previa de la imagen
- Lugar específico (opcional, texto libre)

## Formato de Envío a Power Automate

```json
{
  "tituloObra": "string",
  "tituloOriginal": "string | null",
  "otroTitulo": "string | null",
  "genero": "string",
  "duracionObra": number,
  "numeroActos": number,
  "duracionMusica": number,
  "duracionTexto": number,
  "fechaEstreno": "YYYY-MM-DD",
  "lugarEstreno": "string",
  "numeroInscripcion": "string | null",
  "fechaInscripcion": "YYYY-MM-DD | null",
  "participaciones": [
    {
      "clase": "string",
      "autor": "string",
      "porcentaje": number
    }
  ],
  "firmaBase64": "string",
  "firmaFilename": "string",
  "lugarEspecifico": "string | null"
}
```

## Validaciones Implementadas

### Campos de Texto
- Validación de campos obligatorios
- Límites de caracteres
- Validación en tiempo real (al perder foco)

### Campos Numéricos
- Rangos mínimos y máximos
- Validación automática al escribir

### Participaciones
- Mínimo 1 participación requerida
- Suma de porcentajes por clase ≤ 100%
- Resumen visual de porcentajes

### Archivo de Firma
- Formatos permitidos: PNG, JPG, JPEG
- Tamaño máximo: 5MB
- Vista previa antes de enviar

## Uso

1. Abrir `index.html` en un navegador web
2. Completar todos los campos obligatorios
3. Agregar participaciones (mínimo 1)
4. Adjuntar imagen de firma
5. Hacer clic en "Enviar Declaración"

## Compatibilidad

- Chrome (recomendado)
- Firefox
- Edge
- Safari

## Dependencias

- jQuery 3.6.0
- Select2 4.1.0
- Font Awesome 6.0.0

Todas las dependencias se cargan desde CDN.

## Notas Técnicas

- La firma se envía como Base64
- Los campos opcionales se envían como `null` si están vacíos
- El formulario se resetea automáticamente después de un envío exitoso
- Overlay de carga durante el envío
- Modales de éxito/error con opciones de reintentar

## Personalización

### Colores
Los colores institucionales están definidos en `styles.css` como variables CSS:

```css
:root {
  --color-principal: #097137;
  --color-secundario: #575656;
  --color-fondo: #FFFFFF;
}
```

### Validaciones
Las validaciones se pueden ajustar en `script.js` en las funciones:
- `validateField()` - Validación de campos individuales
- `validateParticipaciones()` - Validación de tabla de participaciones

## Soporte

Para problemas o preguntas, contactar al equipo de desarrollo.
