# Gorditacos

Menú de Gorditacos con pedidos por WhatsApp. El cliente puede armar platitos, elegir bebidas, personalizar chilaquiles y revisar el ticket antes de enviarlo.

## Desarrollo local

Requiere Node.js 20 o posterior. Desde la raíz del proyecto, ejecuta:

```sh
npm test
npm run build
npm run preview
```

Abre [la vista previa](http://127.0.0.1:4173/). El catálogo y los precios están en `config/menu.json`. La dirección, los horarios y los datos de contacto están en `config/negocio.json`.

## GitHub Pages

La fuente de publicación es la carpeta `docs/` de la rama `main`. Después de modificar el sitio, ejecuta `npm test` y `npm run build:pages`, y sube en el mismo commit el código fuente y el contenido generado de `docs/`.

La URL asignada a esta publicación es [erozkruzpe248.github.io/gorditacos](https://erozkruzpe248.github.io/gorditacos/). La página conserva `noindex` durante la revisión con el cliente.
