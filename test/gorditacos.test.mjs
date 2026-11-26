import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { LIMIT, quantity, pricePlate, ticket } from "../src/precios.mjs";
import { render } from "../scripts/render.mjs";

const read = path => readFile(new URL(path, import.meta.url), "utf8").then(JSON.parse);
const [menu, business] = await Promise.all([read("../config/menu.json"), read("../config/negocio.json")]);
const taco = (guisos, bebidas = {}) => ({ categoria: "tacos", guisos, bebidas });
const breakfast = (desayuno, opciones, extras = {}) => ({ desayuno, opciones, extras, bebidas: {} });

test("09 · Cantidad editable y reparto de varios guisos", () => {
  assert.equal(quantity("-3"), 0);
  assert.equal(quantity("250"), LIMIT);
  const detail = pricePlate(menu, taco({ Deshebrada: quantity("2"), Discada: quantity("3") }));
  assert.deepEqual(detail.individual.map(({ name, qty }) => [name, qty]), [["Deshebrada", 2], ["Discada", 3]]);
  assert.equal(detail.subtotal, 120);
});

test("10 · Los combos directos aceptan todas las bebidas al precio anunciado", () => {
  for (const combo of menu.combos) {
    for (const drink of menu.bebidas) {
      const plate = { categoria: combo.categoria, combo: combo.id, guisos: { Deshebrada: combo.cantidad }, bebidaCombo: drink.id };
      const detail = pricePlate(menu, plate);
      assert.equal(detail.subtotal, combo.precio);
      assert.equal(detail.combos[0].drink, drink.nombre);
    }
  }
  const plate = { categoria: "tacos", combo: "tacos-5", guisos: { Deshebrada: 5 }, bebidaCombo: "agua" };
  assert.throws(() => pricePlate(menu, { ...plate, guisos: { Deshebrada: 4 } }), /cantidad/);
  assert.throws(() => pricePlate(menu, { ...plate, guisos: { Deshebrada: 6 } }), /cantidad/);
  for (const unavailable of ["refresco", "te", "cafe", "jugo"]) {
    assert.throws(() => pricePlate(menu, { ...plate, bebidaCombo: unavailable }), /bebida permitida/);
  }
});

test("11 · El combo de 15 gorditas ofrece también el refresco de 2 L", () => {
  const plate = { categoria: "gorditas", combo: "gorditas-15", guisos: { Picadillo: 9, Nopalitos: 6 }, bebidaCombo: "refresco-2l" };
  const detail = pricePlate(menu, plate);
  assert.equal(detail.subtotal, 450);
  assert.equal(detail.combos[0].drink, "Refresco de 2 litros");
  assert.throws(() => pricePlate(menu, { ...plate, combo: "gorditas-5", guisos: { Picadillo: 5 } }), /bebida permitida/);
});

test("12 · Bebidas solas viajan como renglón independiente", () => {
  const drinks = { soloBebidas: true, bebidas: { "pepsi-black": 1, agua: 2 } };
  const detail = pricePlate(menu, drinks);
  assert.equal(detail.subtotal, 90);
  assert.match(ticket(menu, [taco({ Discada: 5 }), drinks], business.nombre).text, /Platito 2 · Bebidas/);
  assert.equal(ticket(menu, [taco({ Discada: 5 }), drinks], business.nombre).total, 210);
});

test("13 · Chilaquiles con salsa, topping y complementos editables", () => {
  assert.equal(pricePlate(menu, breakfast("huevos", { ingrediente: "Jamón" })).subtotal, 130);
  assert.throws(() => pricePlate(menu, breakfast("huevos", { ingrediente: "Jamón" }, { Discada: 1 })), /complementos/);
  assert.throws(() => pricePlate(menu, breakfast("chilaquiles", { salsa: "Mixta", topping: "Pollo" })), /salsa/);
  const chilaquiles = breakfast("chilaquiles", { salsa: "Morita", topping: "Huevo estrellado" });
  assert.deepEqual(pricePlate(menu, chilaquiles).sinComplementos, []);
  const customized = { ...chilaquiles, sinComplementos: ["Queso panela", "Cebolla"] };
  assert.equal(pricePlate(menu, customized).subtotal, 130);
  assert.match(ticket(menu, [customized], business.nombre).text, /Salsa: Morita\n  Topping incluido: Huevo estrellado\n  Sin: Queso panela, Cebolla/);
  assert.throws(() => pricePlate(menu, { ...chilaquiles, sinComplementos: ["Frijolitos"] }), /complementos incluidos/);
});

test("14 · El ticket conserva el descuento, guisos sobrantes y toppings", () => {
  for (const drink of menu.bebidas) {
    const detail = pricePlate(menu, taco({ Deshebrada: 5 }, { [drink.id]: 2 }));
    assert.equal(detail.subtotal, 170);
    assert.equal(detail.combos[0].drink, drink.nombre);
    assert.deepEqual(detail.drinks, [{ name: drink.nombre, qty: 1, total: 30 }]);
  }
  const order = ticket(menu, [
    taco({ Deshebrada: 5, Discada: 1 }, { jamaica: 1 }),
    breakfast("chilaquiles", { salsa: "Verde", topping: "Pollo" }, { Picadillo: 2 })
  ], business.nombre);
  assert.equal(order.total, 354);
  assert.match(order.text, /Combo 5 tacos — \$140[\s\S]+1 × Discada — \$24/);
  assert.match(order.text, /Bebida incluida: Aguafiel Jamaica/);
  assert.doesNotMatch(order.text, /Suplemento/);
  assert.match(order.text, /Platito 2 · Chilaquiles[\s\S]+Topping adicional: 2 × Picadillo — \$60/);
  assert.match(order.text, /Total: \$354 MXN/);
});

test("15 · Actualizar o quitar un platito recalcula el ticket", () => {
  const initial = [taco({ Deshebrada: 5 }, { manzanita: 1 }), taco({ Discada: 2 })];
  const edited = [taco({ Deshebrada: 4 }, { manzanita: 1 }), initial[1]];
  assert.equal(ticket(menu, initial, business.nombre).total, 188);
  assert.equal(ticket(menu, edited, business.nombre).total, 174);
  const afterRemoval = ticket(menu, edited.slice(1), business.nombre);
  assert.equal(afterRemoval.total, 48);
  assert.match(afterRemoval.text, /Platito 1 · Tacos[\s\S]+2 × Discada/);
  assert.doesNotMatch(afterRemoval.text, /Platito 2/);
});

test("16 · Menú accesible en HTML base, contacto y contador de prueba", () => {
  const page = render(menu, business);
  for (const category of menu.categorias) assert.ok(page.includes('id="cat-' + category.id + '"'));
  for (const guiso of menu.guisos.opciones) assert.ok(page.includes("<li>" + guiso + "</li>"));
  assert.equal(menu.guisos.opciones.length, 15);
  assert.equal(page.match(/<h1\b/g).length, 1);
  assert.doesNotMatch(page.match(/<nav id="site-nav"[\s\S]*?<\/nav>/)[0], /Nosotros|#presentacion/);
  assert.match(page, /Incluye bebida a elegir\./);
  assert.doesNotMatch(page, /\b(?:Jugo|Té|Café)\b|\$7 extra/);
  assert.match(page, /<address>Pelícano 5604, Valle Verde 2\.º Sector, 64117 Monterrey, Nuevo León<\/address>/);
  assert.match(page, /Lunes a sábado, 8:00 a\. m\. a 3:30 p\. m\. · Domingo, 8:00 a\. m\. a 2:00 p\. m\./);
  assert.match(page, /href="https:\/\/wa\.me\/528132651667">WhatsApp de Gorditacos · \+528132651667/);
  assert.match(page, /<figcaption><span>Google Maps<\/span><a[^>]+href="https:\/\/maps\.app\.goo\.gl\/E4nKBzDEToMEdTVE9"[^>]*>Cómo llegar<\/a>/);
  const mapSource = page.match(/<iframe class="contact-map" title="Mapa de Gorditacos" src="([^\"]+)"/)[1];
  const map = new URL(mapSource.replaceAll("&amp;", "&"));
  assert.equal(map.origin + map.pathname, "https://www.google.com/maps/embed");
  assert.match(map.searchParams.get("pb"), /!2d-100\.3741525!3d25\.737801.*!1s0x866297a8d77f0def:0xcc33fabee77b954d/);
  assert.doesNotMatch(render(menu, { ...business, direccion: null, mapaEmbed: null }), /<iframe/);
  assert.doesNotMatch(page, /pendiente de confirmación/);
  const siteData = JSON.parse(page.match(/<script id="site-data" type="application\/json">(.*?)<\/script>/)[1]);
  assert.equal(siteData.business.whatsapp, "528132651667");
  assert.match(render(menu, { ...business, whatsapp: null }), /WhatsApp de pedidos pendiente de confirmación/);
  assert.match(page, /https:\/\/hits\.sh\/erozkruzpe248\.github\.io\/gorditacos\.svg/);
  assert.ok(page.includes('<link rel="canonical" href="' + business.url + '">'));
  assert.ok(page.includes('<meta name="robots" content="noindex">'));
});

