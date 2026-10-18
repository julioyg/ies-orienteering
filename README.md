# 🧭 IES Sierra Almijara · Tarjeta Virtual SPORTident (PWA)

Aplicación web progresiva (**PWA Zero-Backend, 100 % Offline-First**) diseñada para las clases de **Orientación Deportiva** en el **IES Sierra Almijara**. Convierte cualquier teléfono móvil (iOS Safari / Android Chrome) en una tarjeta electrónica **SPORTident (SI-Card)** con lectura de códigos QR, códigos manuales de respaldo de 3 letras, retroalimentación acústica (`2400 Hz` vía Web Audio API) y vibración háptica.

---

## ✨ Características Principales

- **100 % Ejecución en Cliente y Persistencia Offline:** Todo el estado de la carrera se guarda en `localStorage` bajo la clave `ies_orienteering_state_v1`. Si el alumno cierra la pestaña por error, recarga la página o pierde cobertura móvil en el patio/parque, el cronómetro y los parciales continúan intactos.
- **Interfaz de Alto Contraste para Exteriores:** Diseñada específicamente para lectura bajo luz solar directa con botones grandes y tipografía monoespaciada de alta visibilidad.
- **Máquina de Estados en 4 Etapas:**
  1. `REGISTRATION`: Identificación del alumno/pareja, curso/grupo y número de mapa/recorrido.
  2. `READY_TO_START`: Espera activa hasta escanear o introducir el código de la baliza `SALIDA`. Bloquea cualquier intento de picar balizas antes de iniciar.
  3. `IN_RACE`: Cronómetro en vivo (`MM:SS`), escáner de cámara trasera (`facingMode: "environment"`), alternativa manual de 3 letras («Plan B»), bloqueo de balizas duplicadas, secuencia en tiempo real y sonido SPORTident (`2400 Hz`).
  4. `FINISHED`: **Ticket Oficial SPORTident** bloqueado con resumen visual de secuencia, tabla completa de tiempos parciales y acumulados, código hash determinista antifraude (`#XXXXXX`) y botón para compartir directamente por WhatsApp / Telegram / Classroom.

---

## 🖨️ Cómo Imprimir las 22 Balizas Oficiales (Formato A4)

El repositorio incluye un generador de fichas A4 listas para imprimir y plastificar (`SALIDA`, `Balizas 31–50` y `META`) con el triángulo diagonal blanco/naranja oficial de la IOF, código QR vectorial de alto contraste y código manual de respaldo:

- **En producción (GitHub Pages):**
  - `https://julioyg.github.io/ies-orienteering/?print=true`
  - `https://julioyg.github.io/ies-orienteering/printable-controls.html`
- **En desarrollo local:**
  - `http://localhost:5173/ies-orienteering/?print=true`
  - `http://localhost:5173/ies-orienteering/printable-controls.html`

> **Consejo de impresión:** En el cuadro de diálogo de impresión del navegador (`Ctrl+P` / `Cmd+P`), selecciona **Tamaño A4**, **Vertical (Portrait)** y activa **«Gráficos de fondo» (Background graphics)** para conservar los colores naranjas oficiales de las balizas.

---

## 📋 Tabla Oficial de Balizas y Códigos Manuales (`src/data/controls.ts`)

Se han evitado caracteres ambiguos (`0/O`, `1/I`) para facilitar la lectura rápida en carrera:

| Control | Payload QR | Código Manual (3 Letras) |
| :--- | :--- | :---: |
| **SALIDA** | `ORI:START:S7X` | `S7X` |
| **META** | `ORI:FINISH:M9Z` | `M9Z` |
| **Baliza 31** | `ORI:31:K3P` | `K3P` |
| **Baliza 32** | `ORI:32:R8W` | `R8W` |
| **Baliza 33** | `ORI:33:T4N` | `T4N` |
| **Baliza 34** | `ORI:34:B6M` | `B6M` |
| **Baliza 35** | `ORI:35:H2V` | `H2V` |
| **Baliza 36** | `ORI:36:J9C` | `J9C` |
| **Baliza 37** | `ORI:37:L5D` | `L5D` |
| **Baliza 38** | `ORI:38:P7F` | `P7F` |
| **Baliza 39** | `ORI:39:Q3G` | `Q3G` |
| **Baliza 40** | `ORI:40:W8K` | `W8K` |
| **Baliza 41** | `ORI:41:X4L` | `X4L` |
| **Baliza 42** | `ORI:42:Y6N` | `Y6N` |
| **Baliza 43** | `ORI:43:Z2P` | `Z2P` |
| **Baliza 44** | `ORI:44:C9R` | `C9R` |
| **Baliza 45** | `ORI:45:D5T` | `D5T` |
| **Baliza 46** | `ORI:46:F7V` | `F7V` |
| **Baliza 47** | `ORI:47:G3W` | `G3W` |
| **Baliza 48** | `ORI:48:M8X` | `M8X` |
| **Baliza 49** | `ORI:49:N4Y` | `N4Y` |
| **Baliza 50** | `ORI:50:V6Z` | `V6Z` |

---

## 🛠️ Desarrollo Local y Compilación

### Requisitos previos
- Node.js 18+ y npm

### Comandos

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo (http://localhost:5173/ies-orienteering/)
npm run dev

# 3. Compilar versión de producción en dist/ (verifica tipos TypeScript + bundle Vite)
npm run build

# 4. Previsualizar compilación de producción
npm run preview
```

---

## 🚀 Despliegue en GitHub Pages

El proyecto incluye el flujo `.github/workflows/deploy.yml` configurado para compilar y publicar automáticamente la carpeta `dist/` en **GitHub Pages** cada vez que se hace `push` a la rama `main`.
En la configuración del repositorio en GitHub (`Settings -> Pages`), asegúrate de seleccionar **Source: GitHub Actions**.
