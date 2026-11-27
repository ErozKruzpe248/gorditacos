import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const browser = process.env.GORDITACOS_BROWSER ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const output = resolve("test", "browser-output");
const mode = process.argv[2] ?? "all";
const source = await readFile("dist/index.html", "utf8");
await mkdir(output, { recursive: true });
let browserRun = 0;

function run(page, flags) {
  const result = spawnSync(browser, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--disable-sync",
    "--disable-background-networking", "--disable-component-update", "--disable-breakpad", "--virtual-time-budget=4500",
    "--user-data-dir=" + resolve(output, "profile-" + process.pid + "-" + ++browserRun), ...flags,
    pathToFileURL(resolve(page)).href
  ], { encoding: "utf8", timeout: 30000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  if (result.error || (result.status !== 0 && !result.stdout)) throw new Error(result.error?.message ?? "El navegador terminó con código " + result.status);
  return result.stdout;
}

const wrap = (body, width) => '<!doctype html><html lang="es-MX"><meta charset="utf-8"><title>Revisión móvil de Gorditacos</title><style>body{margin:0;background:#fbf6eb}iframe{width:' + width + 'px;height:844px;border:0;display:block}</style>' + body + '</html>';
const helpers = `const $ = (s, root = document) => root.querySelector(s);
const click = s => { const node = $(s); if (!node || node.disabled) throw new Error("Control no disponible: " + s); node.click(); };
const field = (name, root = document) => [...root.querySelectorAll("[data-choice]")].find(input => input.dataset.choice === name);
const change = (input, value) => { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); };
const finish = () => click('#plate-form [type=submit]');
const text = s => $(s).textContent;
const check = (condition, why) => { if (!condition) throw new Error(why); };`;
const addTacos = `
  const tacos = $("#cat-tacos");
  change(field("Deshebrada", tacos), "5");
  field("Discada", tacos).closest("[data-stepper]").querySelector('[data-delta="1"]').click();
  click('[data-add-plate="tacos"]'); change(field("jamaica", $("#plate-form")), "1");`;
const cases = {
  "17": `
    document.documentElement.style.scrollBehavior = "auto";
    const first = $('[role="tab"][aria-selected="true"]');
    window.scrollTo(0, $("#menu").offsetTop);
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    check($("#tab-tacos").getAttribute("aria-selected") === "true", "La pestaña de tacos debe activarse con el teclado");
    ${addTacos}
    check(text("#plate-detail").includes("$164"), "El combo con una pieza extra debe sumar $164");
    finish();
    check(field("Discada", tacos).value === "0" && field("Deshebrada", tacos).value === "0", "Se debe reiniciar el platito");
    const documentWidth = document.documentElement.clientWidth;
    check(document.documentElement.scrollWidth <= documentWidth && innerWidth === 1280, "Ancho de escritorio: " + [innerWidth, documentWidth, document.documentElement.scrollWidth].join("/"));
  `,
  "18": `
    click("#tab-tacos");
    ${addTacos}
    finish();
    change(field("Nopalitos", $("#cat-tacos")), "2");
    click('[data-add-plate="tacos"]'); finish(); click("[data-cart]");
    check(text(".cart-grand").includes("$212"), "Los platitos deben conservar sus subtotales");
    click('[data-edit="0"]'); change(field("Deshebrada", $("#plate-form")), "3"); finish();
    check(text(".cart-grand").includes("$174"), "Editar debe quitar el combo que dejó de calificar");
    click('[data-remove="0"]');
    check(text(".cart-grand").includes("$48") && !$("#ticket").value.includes("Platito 2"), "Eliminar debe recalcular y renumerar");
  `,
  "19": `
    click("#tab-combos"); click('[data-combo="tacos-5"]');
    const regular = $('[data-option="bebidaCombo"]');
    const drinks = ["pepsi-regular", "pepsi-black", "manzanita", "limon", "naranja", "jamaica", "agua", "cafe-americano"];
    check([...regular.options].slice(1).map(item => item.value).join(",") === drinks.join(","), "El combo muestra todo el catálogo");
    change(field("Picadillo", $("#plate-form")), "5");
    regular.value = "agua"; regular.dispatchEvent(new Event("change", { bubbles: true }));
    check(text("#plate-detail").includes("$140"), "El agua natural mantiene el precio del combo");
    regular.value = "cafe-americano"; regular.dispatchEvent(new Event("change", { bubbles: true }));
    check(regular.selectedOptions[0].textContent === "Café Americano (+$10)" && text("#plate-detail").includes("$150"), "El café se muestra con el suplemento y actualiza el precio");
    finish();
    click('[data-combo="gorditas-15"]');
    check($("#plate-form [type=submit]").disabled, "El combo incompleto se mantiene bloqueado");
    const option = $('[data-option="bebidaCombo"]');
    check([...option.options].slice(1).map(item => item.value).join(",") === [...drinks, "refresco-2l"].join(","), "El combo especial ofrece el catálogo y el refresco de 2 L");
    const guiso = field("Picadillo", $("#plate-form")); change(guiso, "16");
    check(guiso.value === "15", "Se limita a 15 piezas");
    check(guiso.closest("[data-stepper]").querySelector('[data-delta="1"]').getAttribute("aria-disabled") === "true", "Se deshabilita sumar");
    option.value = "refresco-2l"; option.dispatchEvent(new Event("change", { bubbles: true }));
    check(text("#plate-detail").includes("$450"), "El precio es $450");
    finish(); click("[data-cart]");
    check($("#ticket").value.includes("Refresco de 2 litros"), "El ticket indica la presentación especial");
    check($("#ticket").value.includes("Bebida incluida: Café Americano (+$10)"), "El ticket incluye el café y su suplemento");
  `,
  "20": `
    check(getComputedStyle($("#site-nav")).display === "none", "La navegación móvil inicia cerrada");
    click(".nav-toggle"); check(getComputedStyle($("#site-nav")).display !== "none", "La navegación móvil se abre");
    $(".nav-toggle").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    check($(".nav-toggle").getAttribute("aria-expanded") === "false", "Escape cierra la navegación");
    const documentWidth = document.documentElement.clientWidth;
    check(document.documentElement.scrollWidth <= documentWidth && innerWidth === 375, "Ancho móvil: " + [innerWidth, documentWidth, document.documentElement.scrollWidth].join("/"));
    click("#tab-desayunos"); click('[data-breakfast="chilaquiles"]');
    const salsa = $('[data-option="salsa"]'); const topping = $('[data-option="topping"]');
    check([...salsa.options].slice(1).map(option => option.value).join(",") === "Roja,Verde,Morita", "El selector muestra las tres salsas del cartel");
    check(topping.options.length === 14, "El selector muestra los trece toppings del cartel");
    salsa.value = "Morita"; salsa.dispatchEvent(new Event("change", { bubbles: true }));
    topping.value = "Machacado con huevo"; topping.dispatchEvent(new Event("change", { bubbles: true }));
    const included = [...document.querySelectorAll("[data-included-group] input")];
    check(included.map(input => input.value).join(",") === "Crema,Queso para gratinar,Queso panela,Cebolla,Cilantro" && included.every(input => input.checked), "Los cinco complementos del cartel se incluyen por defecto");
    click('[data-included-group] input[value="Cebolla"]');
    check(text("#plate-detail").includes("Sin: Cebolla") && text("#plate-detail").includes("$130"), "Quitar un complemento se refleja sin cambiar el precio");
    $(".extras").open = true; change(field("Discada", $("#plate-form")), "2");
    check(text("#plate-detail").includes("$190"), "El desayuno suma dos toppings");
    finish(); click("[data-cart]");
    click('[data-edit="0"]');
    check($('[data-option="salsa"]').value === "Morita" && $('[data-option="topping"]').value === "Machacado con huevo", "Editar conserva la salsa y el topping seleccionados");
    check(!$('[data-included-group] input[value="Cebolla"]').checked, "Editar conserva los complementos quitados");
    click('[data-included-group] input[value="Queso panela"]'); finish();
    check($("#ticket").value.includes("Salsa: Morita") && $("#ticket").value.includes("Topping incluido: Machacado con huevo") &&
      $("#ticket").value.includes("Sin: Queso panela, Cebolla"), "El ticket incluye la personalización actualizada");
    check($("#ticket").value.includes("Topping adicional: 2 × Discada — $60"), "Los toppings llegan al ticket");
    const whatsapp = new URL($('#order-summary a[href*="wa.me"]').href);
    check(whatsapp.pathname === "/528132651667", "El pedido abre el WhatsApp de Gorditacos");
    check(whatsapp.searchParams.get("text") === $("#ticket").value, "WhatsApp recibe el ticket completo");
  `,
  "21": `
    click("#tab-tacos");
    ${addTacos}
    finish();
    const floating = $(".floating-cart");
    check(floating.getAttribute("aria-label") === "Carrito, 7 artículos", "El contador suma piezas y bebidas, incluidos los artículos de la promoción");
    click("#tab-gorditas");
    check(text(".cart-grand").includes("$164") && text("[data-cart-count]") === "7", "La selección y el total persisten al cambiar de categoría");
    document.documentElement.style.scrollBehavior = "auto";
    const panel = $("#cat-gorditas");
    const picture = panel.querySelector("figure");
    const columns = getComputedStyle(panel).gridTemplateColumns.split(" ").map(parseFloat);
    const measure = "foto/espacio/contenido=" + [columns[0], parseFloat(getComputedStyle(panel).columnGap), columns[1]].join("/");
    check(Math.abs(picture.getBoundingClientRect().width - (panel.clientWidth - 40) * .32) < 1, "Proporción de escritorio fuera de estándar: " + measure);
    check(Math.abs($(".hero-photo img").offsetHeight - 354) <= 1, "La portada debe medir 354 px");
    const bounds = panel.getBoundingClientRect();
    window.scrollTo(0, bounds.top + scrollY + 190);
    const rail = floating.getBoundingClientRect();
    check(rail.top >= 0 && rail.bottom <= innerHeight && rail.left >= panel.getBoundingClientRect().right, "El carrito lateral debe mantenerse visible sin cubrir los productos");
    click(".floating-cart");
    check(document.activeElement === $("#order-summary-title") && $("#order-summary").getBoundingClientRect().top < innerHeight, "El acceso desplaza y enfoca el resumen integrado");
    const map = $(".contact-map").getBoundingClientRect();
    const contact = $(".contact-card > div").getBoundingClientRect();
    check(map.left >= contact.right && map.height >= 240, "El mapa debe quedar al lado de los datos en escritorio");
    report("OK " + measure + " portada=" + $(".hero-photo img").offsetHeight);
    return;
  `,
  "22": `
    document.documentElement.style.scrollBehavior = "auto";
    const menu = $("#cat-gorditas");
    const photo = menu.querySelector("figure").getBoundingClientRect();
    const content = menu.querySelector(".category-content").getBoundingClientRect();
    const heroPhoto = $(".hero-photo img");
    check(content.top >= photo.bottom && Math.abs(heroPhoto.offsetHeight - 232.5) < 1, "Foto y productos deben apilarse y la portada debe medir aproximadamente 233 px");
    check(document.documentElement.scrollWidth <= document.documentElement.clientWidth, "El catálogo móvil no debe desbordar");
    const map = $(".contact-map").getBoundingClientRect();
    const contact = $(".contact-card > div").getBoundingClientRect();
    const mapPanel = $(".contact-map-panel").getBoundingClientRect();
    check(mapPanel.top >= contact.bottom && Math.abs(mapPanel.width - contact.width) < 1 && map.height >= 240, "El mapa móvil debe quedar debajo de los datos y ocupar todo el ancho disponible");
    const directions = $(".contact-map-panel a");
    check(directions.getBoundingClientRect().height >= 44 && directions.href === "https://maps.app.goo.gl/E4nKBzDEToMEdTVE9", "El acceso a la ficha de Google Maps es visible aunque el mapa integrado no cargue");
    window.scrollTo(0, menu.getBoundingClientRect().top + scrollY + 160);
    const cart = $(".floating-cart");
    const buttonRect = cart.getBoundingClientRect();
    check(buttonRect.top >= 0 && buttonRect.bottom <= innerHeight && buttonRect.left >= menu.getBoundingClientRect().right, "El acceso móvil debe quedar dentro del viewport y fuera de los controles");
    check(buttonRect.height >= 44 && buttonRect.width >= 44, "El acceso móvil debe tener al menos 44 por 44 px");
    window.scrollTo(0, document.documentElement.scrollHeight);
    check(cart.getBoundingClientRect().bottom <= $(".site-footer").getBoundingClientRect().top, "El carrito no debe alcanzar el footer");
    report("OK portada=" + heroPhoto.offsetHeight + " control=" + buttonRect.width + "x" + buttonRect.height);
    return;
  `
};

function testScript(id, code, mobile) {
  return `<script>
  window.addEventListener("error", event => report("ERROR " + (event.message || "Javascript")));
  function report(text) {
    const result = "CASO ${id} " + text;
    ${mobile ? 'window.parent.postMessage(result, "*");' : 'document.getElementById("result").textContent = result;'}
  }
  window.addEventListener("DOMContentLoaded", () => {
    try {
      ${helpers}
      check(document.body.classList.contains("enhanced"), "La interfaz debe iniciar");
      ${code}
      report("OK");
    } catch (error) { report("ERROR " + error.message); }
  });
  </script>`;
}

let failures = 0;
for (const [id, code] of Object.entries(cases)) {
  if (mode !== "all" && mode !== id) continue;
  const viewport = ["17", "21"].includes(id) ? 1280 : ["20", "22"].includes(id) ? 375 : null;
  const fixture = resolve(output, "caso-" + id + ".html");
  const html = source.replace("<head>", '<head><base href="../../dist/">')
    .replace("</body>", '<pre id="result"></pre>' + testScript(id, code, Boolean(viewport)) + "</body>");
  await writeFile(fixture, html);
  const outer = resolve(output, "vista-caso-" + id + ".html");
  if (viewport) await writeFile(outer, wrap('<pre id="result" hidden></pre><script>window.addEventListener("message", event => { if (event.source === document.querySelector("iframe").contentWindow) document.getElementById("result").textContent = event.data; });</script><iframe src="caso-' + id + '.html" title="Vista de prueba"></iframe>', viewport));
  let dom;
  try {
    dom = run(viewport ? outer : fixture, ["--window-size=1400,1000", "--dump-dom"]);
  } catch (error) {
    console.log("CASO " + id + " SIN RESULTADO · " + error.message);
    failures++;
    continue;
  }
  const verdict = dom.match(/<pre id="result"[^>]*>(.*?)<\/pre>/)?.[1] || "Sin resultado de navegador";
  console.log(verdict);
  if (!verdict.startsWith("CASO " + id + " OK")) failures++;
}
if (mode === "visual") {
  const mobileFrame = resolve(output, "movil.html");
  await writeFile(mobileFrame, wrap('<iframe src="../../dist/index.html" title="Vista móvil"></iframe>', 375));
  run("dist/index.html", ["--window-size=1280,1000", "--screenshot=" + resolve(output, "escritorio.png")]);
  run(mobileFrame, ["--window-size=560,930", "--screenshot=" + resolve(output, "movil.png")]);
  const snapshot = await readFile(resolve(output, "escritorio.png"));
  const mobileSnapshot = await readFile(resolve(output, "movil.png"));
  assert.ok(snapshot.length > 10000 && mobileSnapshot.length > 10000);
  console.log("Capturas listas en test/browser-output");
}
if (mode === "all" || mode === "sin-js") {
  const scriptless = resolve(output, "sin-js.html");
  await writeFile(scriptless, source.replace("<head>", '<head><base href="../../dist/">').replace('<script src="./app.js" defer></script>', ""));
  try {
    const dom = run(scriptless, ["--window-size=1280,1000", "--dump-dom"]);
    assert.ok(dom.includes("<li>Deshebrada</li>") && !dom.includes('body id="inicio" class="enhanced"'));
    console.log("Contenido esencial con JavaScript deshabilitado · OK");
  } catch (error) {
    console.log("Contenido esencial con JavaScript deshabilitado · SIN RESULTADO · " + error.message);
    failures++;
  }
}
if (failures) process.exitCode = 1;

