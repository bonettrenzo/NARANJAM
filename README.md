# NARANJAM - Control de YouTube

Extensión de Chrome (Manifest V3) con React que agrega un panel de control
de velocidad de reproducción sobre el reproductor de YouTube.

## Funcionalidades

- Panel flotante con botones de velocidad: 0.5x a 3x.
- Atajos de teclado:
  - `+` / `-` : subir / bajar velocidad en pasos de 0.25
  - `r` : resetear a 1x
  - `c` : cambiar a 2x
- La velocidad elegida se recuerda y se re-aplica al navegar entre videos.
- Si cambias la velocidad desde el menú nativo de YouTube, también se recuerda.
- En YouTube Music, **Siguiente** baja el volumen de la pista actual antes de
  avanzar y lo sube al empezar la nueva. En **NARANJAM → Crossfade** puedes
  ajustar cada fundido entre 0 y 10 segundos o desactivar la función. El valor
  inicial es de 2 segundos por fundido.
- **Omitir silencio inicial** está desactivada por defecto. Al pulsar
  **Siguiente**, analiza hasta los primeros 4 segundos de la próxima pista y
  arranca el fundido de entrada cerca del primer sonido. Si no detecta audio
  en ese tramo, vuelve al inicio de la pista.

## Cargar la extensión en Chrome

1. Compilar: `npm install && npm run build`
2. Abrir `chrome://extensions`
3. Activar "Modo de desarrollador" (arriba a la derecha).
4. "Cargar descomprimida" y seleccionar la carpeta `dist/` de este proyecto.
5. Abrir cualquier video de YouTube; el panel aparece sobre el reproductor.

## Desarrollo

- `npm run dev` : recompila automáticamente al cambiar archivos
  (luego recargar la extensión en `chrome://extensions`).

## Estructura

- `public/manifest.json` : manifest MV3 (se copia a `dist/`).
- `src/content/index.jsx` : bootstrap del content script (SPA, atajos, montaje).
- `src/content/App.jsx` : UI de React (panel de botones + toast).
- `src/content/speed.js` : utilidades de velocidad y persistencia.
- `src/content/styles.js` : CSS inyectado en Shadow DOM (aislado de YouTube).
