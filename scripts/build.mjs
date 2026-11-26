import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { render } from "./render.mjs";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [menu, business] = await Promise.all([
  read("../config/menu.json").then(JSON.parse),
  read("../config/negocio.json").then(JSON.parse)
]);

const ids = new Set();
for (const entry of [...menu.categorias, ...menu.combos, ...menu.desayunos, ...menu.bebidas]) {
  if (!/^[a-z][a-z0-9-]*$/.test(entry.id) || ids.has(entry.id)) throw new Error("Identificador inválido o duplicado: " + entry.id);
  ids.add(entry.id);
  if (entry.precio !== undefined && (!Number.isInteger(entry.precio) || entry.precio <= 0)) throw new Error("Precio inválido: " + entry.id);
}
for (const combo of menu.combos) {
  if (!menu.categorias.some(item => item.id === combo.categoria && item.tipo === "guisos") || !menu.bebidas.length || !Number.isInteger(combo.cantidad) || combo.cantidad < 1 || combo.cantidad > 99) throw new Error("Requisitos de combo inválidos: " + combo.id);
  const special = combo.bebidaEspecial;
  if (special && (typeof special.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(special.id)
    || typeof special.nombre !== "string" || !special.nombre.trim()
    || menu.bebidas.some(drink => drink.id === special.id))) throw new Error("Bebida especial inválida: " + combo.id);
}
for (const file of [business.logo, business.portada.imagen, ...menu.categorias.map(c => c.imagen), "matangazo.png"].filter(Boolean)) {
  if (!/^[a-z0-9][a-z0-9._-]*\.(?:png|jpg|jpeg|webp|avif)$/i.test(file)) throw new Error("Nombre de recurso inválido: " + file);
  if (!(await stat(new URL("../src/assets/" + file, import.meta.url))).isFile()) throw new Error("Falta " + file);
}
for (const number of [business.whatsapp, business.agenciaWhatsApp].filter(Boolean)) {
  if (typeof number !== "string" || !/^[1-9]\d{7,14}$/.test(number)) throw new Error("Usa un número internacional confirmado sin símbolos.");
}
for (const value of [business.url, business.mapa, business.mapaEmbed].filter(Boolean)) {
  if (new URL(value).protocol !== "https:") throw new Error("Usa HTTPS en la configuración.");
}
if (business.url && (!business.url.endsWith("/") || /[?#]/.test(business.url))) throw new Error("La URL final debe terminar en / y carecer de consulta o fragmento.");
const counterKey = business.url ? business.contador.permanente : business.contador.prueba;
const keyPattern = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\/[a-z0-9][a-z0-9._/-]*$/i;
if (typeof counterKey !== "string" || !keyPattern.test(counterKey) || counterKey.split("/").some(part => !part || part === "." || part === ".." || part.endsWith(".svg"))) throw new Error("Configura la clave estable de Hits para este modo.");

const pages = process.argv.includes("--pages");
const output = pages ? "docs" : "dist";
const dist = new URL("../" + output + "/", import.meta.url);
await mkdir(dist, { recursive: true });
const [engine, ui] = await Promise.all([read("../src/precios.mjs"), read("../src/app.mjs")]);
const app = '"use strict";\n(() => {\n' + engine.replace(/^export /gm, "") + "\n" + ui.replace(/^import .*;\r?\n/m, "") + "\n})();\n";
new Function(app);
await writeFile(new URL("index.html", dist), render(menu, business));
await writeFile(new URL("app.js", dist), app);
await cp(new URL("../src/styles.css", import.meta.url), new URL("styles.css", dist));
await cp(new URL("../src/assets/", import.meta.url), new URL("assets/", dist), { recursive: true });
if (pages) await writeFile(new URL(".nojekyll", dist), "");
console.log("Compilado: " + output + "/index.html");

