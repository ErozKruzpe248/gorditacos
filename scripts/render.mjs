import { money, comboDrinkLabel } from "../src/precios.mjs";

const replacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = value => String(value).replace(/[&<>"']/g, char => replacements[char]);
const asset = file => "./assets/" + esc(file);
const list = items => "<ul>" + items.map(item => "<li>" + esc(item) + "</li>").join("") + "</ul>";
const fixed = (value, size) => '<span class="price">' + money(value) + (size ? ' <small>' + size + '</small>' : "") + '</span>';
const safeJson = data => JSON.stringify(data).replace(/</g, "\\u003c");
const button = (key, item, label) => '<button type="button" class="button primary only-js" data-' + key + '="' + esc(item) + '">' + esc(label) + '</button>';
const cartIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h3l2.5 11.5h11.7L22 6H5.7"/><circle cx="9" cy="19" r="1.4"/><circle cx="18" cy="19" r="1.4"/></svg>';

function categoryContent(menu, category) {
  if (category.tipo === "guisos") {
    return fixed(category.precio, "c/u") +
      '<p class="only-js">Escoge los guisos y las cantidades para tu platito.</p>' +
      '<div class="choices only-js" data-draft="' + category.id + '"></div>' +
      '<div class="only-js panel-action"><output data-draft-count="' + category.id + '">0 piezas</output>' +
      button("add-plate", category.id, "Continuar con mi platito") + '</div>' +
      '<div class="no-js static-options"><p>Guisos disponibles</p>' + list(menu.guisos.opciones) + '</div>';
  }
  if (category.tipo === "desayunos") {
    return menu.desayunos.map(item => '<article class="menu-item"><div class="split"><h4>' + esc(item.nombre) + '</h4>' + fixed(item.precio) + '</div>' +
      item.opciones.map(group => '<p><strong>' + esc(group.etiqueta) + '</strong> · ' + esc(group.opciones.join(", ")) + '</p>').join("") +
      (item.incluye ? '<p>Incluye ' + esc(item.incluye.join(", ")) + '.</p>' : '') +
      (item.extra ? '<p>' + esc(item.extra.nombre) + ' · ' + money(item.extra.precio) + ' c/u</p>' : '') +
      button("breakfast", item.id, "Personalizar") + '</article>').join("");
  }
  if (category.tipo === "combos") {
    const upgrades = menu.bebidas.filter(drink => drink.suplementoCombo)
      .map(drink => comboDrinkLabel(drink.nombre, drink.suplementoCombo));
    return menu.combos.map(combo => {
      const description = combo.bebidaEspecial
        ? "Incluye bebida a elegir. También puedes elegir " + combo.bebidaEspecial.nombre.toLowerCase() + "."
        : "Incluye bebida a elegir.";
      return '<article class="menu-item"><div class="split"><h4>' + esc(combo.cantidad + " " + combo.nombre) + '</h4>' + fixed(combo.precio) + '</div>' +
        '<p>' + esc([description, ...upgrades].join(" · ")) + '</p>' +
        button("combo", combo.id, "Elegir combo") + '</article>';
    }).join("");
  }
  return '<div class="choices only-js" id="drinks-draft"></div>' +
    '<div class="only-js panel-action">' + button("add-drinks", "bebidas", "Agregar bebidas") + '</div>' +
    '<div class="no-js static-options">' + list(menu.bebidas.map(drink => drink.nombre + " · " + money(drink.precio))) + '</div>' +
    (category.nota ? '<p class="fine">' + esc(category.nota) + '</p>' : "");
}

function image(file, name, main = false) {
  return '<img src="' + asset(file) + '" width="502" height="502" alt="' + esc(name) + '" ' +
    (main ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"') + '>';
}

export function render(menu, business) {
  const { nombre, descripcion, oferta, portada, whatsapp, direccion, horario, mapa, mapaEmbed, url, contador } = business;
  const pageTitle = nombre + " | Menú y pedidos";
  const socialImage = url ? new URL("assets/" + portada.imagen, url).href : asset(portada.imagen);
  const schema = { "@context": "https://schema.org", "@type": "Restaurant", name: nombre, description: descripcion };
  if (url) schema.url = url;
  if (direccion) schema.address = direccion;
  if (whatsapp) schema.telephone = "+" + whatsapp;
  const logo = business.logo ? '<img class="logo" src="' + asset(business.logo) + '" alt="' + esc(nombre) + '" width="300" height="300">' : '<span class="wordmark">' + esc(nombre) + '</span>';
  const logoIcon = business.logo || portada.imagen;
  const socialUrl = url ? '<link rel="canonical" href="' + esc(url) + '"><meta property="og:url" content="' + esc(url) + '">' : "";
  const orderLink = whatsapp ? '<a class="button primary" href="https://wa.me/' + whatsapp + '">WhatsApp de ' + esc(nombre) + ' · +' + whatsapp + '</a>' : "";
  const address = direccion ? '<address>' + esc(direccion) + '</address>' : '<p>Dirección pendiente de confirmación.</p>';
  const hours = horario ? '<p>' + esc(horario) + '</p>' : '<p>Horario pendiente de confirmación.</p>';
  const mapLink = mapa ? '<a class="button outline" href="' + esc(mapa) + '" target="_blank" rel="noopener noreferrer">Cómo llegar</a>' : "";
  const mapSource = mapaEmbed || (direccion ? "https://www.google.com/maps?q=" + encodeURIComponent(direccion) + "&output=embed" : "");
  const map = mapSource ? '<figure class="contact-map-panel">' +
    '<figcaption><span>Google Maps</span>' + mapLink + '</figcaption>' +
    '<iframe class="contact-map" title="Mapa de ' + esc(nombre) + '" src="' + esc(mapSource) +
    '" width="600" height="320" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></figure>' : "";
  const agencyMessage = encodeURIComponent("Hola, Matangazo. Vi la página de " + nombre + " y me interesa Presencia Web para mi negocio.");
  const hits = "https://hits.sh/" + (url ? contador.permanente : contador.prueba) + ".svg?label=%20&color=e30613&labelColor=e30613&style=flat-square";
  const { fuentes, variantesPendientes, ...orderMenu } = menu;
  const orderBusiness = { nombre, whatsapp, contador: { prueba: contador.prueba } };
  const featuredCategories = menu.categorias.filter(category => ["gorditas", "tacos", "desayunos", "combos"].includes(category.id));
  return `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#fffaf4">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(descripcion)}">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_MX">
<meta property="og:image" content="${esc(socialImage)}">
<meta property="og:image:alt" content="${esc(portada.alt)}">
${socialUrl}
<link rel="icon" href="${asset(logoIcon)}">
<link rel="stylesheet" href="./styles.css">
<script type="application/ld+json">${safeJson(schema)}</script>
<script src="./app.js" defer></script>
</head>
<body id="inicio">
<a class="skip button" href="#main">Saltar al contenido</a>
<header class="site-header">
  <div class="shell header-inner">
    <a class="brand" href="#inicio">${logo}</a>
    <button class="button outline nav-toggle only-js" type="button" aria-controls="site-nav" aria-expanded="false">Navegación</button>
    <nav id="site-nav" aria-label="Principal">
      <a class="button outline" href="#menu">Menú</a>
      <a class="button primary" href="#ubicacion">Ubicación y contacto</a>
    </nav>
  </div>
</header>
<main id="main" tabindex="-1">
  <section class="shell hero" aria-labelledby="headline">
      <div class="hero-copy">
        <h1 id="headline">${esc(nombre)}</h1>
        <p class="hero-offer">${esc(oferta)}</p>
        ${business.frase ? '<p class="hero-note">' + esc(business.frase) + '</p>' : ""}
        <a class="button hero-button" href="#menu">Ver menú y armar pedido</a>
      </div>
      <div class="hero-photo">${image(portada.imagen, portada.alt, true)}${business.fotografiasIlustrativas ? '<span>Foto ilustrativa</span>' : ""}</div>
  </section>
  <section class="shell intro" id="presentacion" aria-labelledby="intro-title">
    <h2 id="intro-title">Sobre ${esc(nombre)}</h2>
    <div class="overview-card">
      <p>${esc(descripcion)}</p>
      <ul aria-label="Accesos al menú">${featuredCategories.map(category => '<li><a href="#cat-' + category.id + '" data-category-link="' + category.id + '">' + esc(category.titulo) + '</a></li>').join("")}</ul>
    </div>
  </section>
  <section class="shell catalog" id="menu" aria-labelledby="menu-title">
    <div class="section-heading"><div><h2 id="menu-title">Menú y pedidos</h2><p>Precios en pesos mexicanos.</p></div><button class="button outline only-js" type="button" data-cart aria-controls="order-summary">Ver pedido <strong data-cart-total>$0</strong></button></div>
    <noscript><p>Activa JavaScript para armar y editar tu pedido. Puedes consultar todos los productos y precios en esta página.</p></noscript>
    <div class="tabs only-js" role="tablist" aria-label="Categorías del menú">${menu.categorias.map((c, i) => '<button type="button" role="tab" id="tab-' + c.id + '" aria-controls="cat-' + c.id + '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? "0" : "-1") + '">' + esc(c.titulo) + '</button>').join("")}</div>
    <div class="catalog-layout">
      <div class="catalog-products">
    ${menu.categorias.map(c => '<section class="category' + (c.imagen ? "" : " text-category") + '" id="cat-' + c.id + '" data-category="' + c.id + '" aria-labelledby="heading-' + c.id + '">' +
      (c.imagen ? '<figure class="category-photo">' + image(c.imagen, c.alt) + (business.fotografiasIlustrativas ? '<figcaption>Foto ilustrativa</figcaption>' : '') + '</figure>' : '') +
      '<div class="category-content"><h3 id="heading-' + c.id + '">' + esc(c.nombre ?? c.titulo) + '</h3>' + categoryContent(menu, c) + '</div></section>').join("")}
      </div>
      <div class="cart-rail only-js">
        <button type="button" class="button primary floating-cart" data-cart aria-controls="order-summary" aria-label="Carrito, 0 artículos">
          ${cartIcon}<span data-cart-count aria-hidden="true">0</span>
        </button>
      </div>
    </div>
    <section class="order-summary only-js" id="order-summary" aria-labelledby="order-summary-title">
      <h3 id="order-summary-title" tabindex="-1">Resumen del pedido</h3>
      <div id="order-summary-body"></div>
    </section>
  </section>
  <section class="shell contact" id="ubicacion" aria-labelledby="contact-title">
    <h2 id="contact-title">Ubicación y contacto</h2>
    ${orderLink ? '<div class="contact-actions">' + orderLink + '</div>' : ""}
    <div class="contact-card${map ? " has-map" : ""}">
      <div>${address}${hours}${whatsapp ? "" : '<p>WhatsApp de pedidos pendiente de confirmación.</p>'}${map ? "" : mapLink}</div>
      ${map}
    </div>
  </section>
</main>
<footer class="site-footer">
  <div class="shell footer-grid">
    <div class="visits"><span>Visitas acumuladas</span><div class="hits" role="status"><img id="hits-image" data-src="${esc(hits)}" alt="Visitas acumuladas" width="100" height="24" fetchpriority="low" decoding="async" hidden><span id="hits-state">Cargando…</span></div><noscript><span>Contador disponible con JavaScript.</span><style>.hits{display:none}</style></noscript></div>
    <a class="agency" href="https://matangazo.mx/"><img src="./assets/matangazo.png" alt="Matangazo" width="120" height="82" loading="lazy" decoding="async"></a>
    <div class="agency-copy"><strong>¿Te gustó esta página?</strong><p>Tu negocio también puede tener la suya con Presencia Web de Matangazo.</p></div>
    <a class="button agency-button" href="https://wa.me/${business.agenciaWhatsApp}?text=${agencyMessage}">¡Quiero mi página web!</a>
  </div>
</footer>
<dialog id="order-dialog" aria-labelledby="dialog-title">
  <div class="dialog-top"><h2 id="dialog-title" tabindex="-1"></h2><button type="button" class="button outline" id="close-dialog">Cerrar</button></div>
  <div id="dialog-content"></div>
</dialog>
<p role="status" id="feedback" class="visually-hidden"></p>
<script id="site-data" type="application/json">${safeJson({ menu: orderMenu, business: orderBusiness })}</script>
</body>
</html>`;
}

