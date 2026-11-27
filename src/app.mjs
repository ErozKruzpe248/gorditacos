import { money, LIMIT, quantity, count, comboDrinks, comboDrinkLabel, pricePlate, ticket } from "./precios.mjs";

const { menu, business } = JSON.parse(document.querySelector("#site-data").textContent);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const html = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const dialog = $("#order-dialog");
const dialogTitle = $("#dialog-title");
const content = $("#dialog-content");
const summary = $("#order-summary-body");
const storage = "presencia-web-carrito-v1:" + business.contador.prueba;
const drafts = new Map();
let cartDrinksChanged = false;
let plates = readCart();
let returnFocus = null;
let editedIndex = null;

function readCart() {
  try {
    const previous = JSON.parse(localStorage.getItem(storage) ?? "[]");
    if (!Array.isArray(previous)) return [];
    const restored = [];
    for (const saved of previous) {
      const combo = menu.combos.find(item => item.id === saved?.combo);
      const missingDrink = combo && !comboDrinks(menu, combo).some(drink => drink.id === saved.bebidaCombo);
      const plate = missingDrink ? { categoria: saved.categoria, guisos: saved.guisos, bebidas: {} } : saved;
      try {
        pricePlate(menu, plate);
        restored.push(plate);
        if (missingDrink) cartDrinksChanged = true;
      } catch { /* Ignora elementos guardados que el menú ya no puede recuperar. */ }
    }
    return restored;
  } catch { return []; }
}

function announce(message) {
  $("#feedback").textContent = message;
}

function commit(next, message) {
  plates = next;
  try { localStorage.setItem(storage, JSON.stringify(next)); } catch { /* El carrito sigue activo en esta visita. */ }
  const label = updateCart();
  announce(message + " " + label + ".");
}

function updateCart() {
  const order = ticket(menu, plates, business.nombre);
  const units = plates.reduce((total, plate) => total + count(plate.guisos ?? {}) + count(plate.bebidas ?? {})
    + Number(Boolean(plate.desayuno)) + Number(Boolean(plate.bebidaCombo)), 0);
  const label = "Carrito, " + units + (units === 1 ? " artículo" : " artículos");
  $(".floating-cart").setAttribute("aria-label", label);
  $("[data-cart-count]").textContent = units;
  $("[data-cart-total]").textContent = money(order.total);
  renderCart(order);
  return label;
}

function stepper(key, label, value = 0, price = "") {
  return '<div class="stepper" data-stepper><span>' + html(label) + (price ? '<small>' + html(price) + '</small>' : '') +
    '</span><div class="step-controls"><button type="button" data-delta="-1" aria-label="Quitar una unidad de ' + html(label) + '">−</button><input type="text" inputmode="numeric" pattern="[0-9]*" aria-label="Cantidad de ' + html(label) + '" data-choice="' + html(key) + '" value="' + value + '"><button type="button" data-delta="1" aria-label="Agregar una unidad de ' + html(label) + '">+</button></div></div>';
}

function bindSteppers(root, values, limit, onChange) {
  const inputs = $$("[data-choice]", root);
  const update = () => {
    const total = count(values);
    for (const input of inputs) {
      const row = input.closest("[data-stepper]");
      const value = values[input.dataset.choice] ?? 0;
      const minus = $('[data-delta="-1"]', row);
      const plus = $('[data-delta="1"]', row);
      minus.setAttribute("aria-disabled", String(!value));
      plus.setAttribute("aria-disabled", String(value >= LIMIT || total >= limit));
    }
    onChange(total);
  };
  const assign = (input, raw) => {
    const key = input.dataset.choice;
    const room = limit - count(values) + (values[key] ?? 0);
    values[key] = Math.min(quantity(raw), room);
    if (!values[key]) delete values[key];
    update();
  };
  root.addEventListener("click", event => {
    const control = event.target.closest("[data-delta]");
    if (!control || control.getAttribute("aria-disabled") === "true") return;
    const input = $("[data-choice]", control.closest("[data-stepper]"));
    assign(input, (values[input.dataset.choice] ?? 0) + Number(control.dataset.delta));
    input.value = values[input.dataset.choice] ?? 0;
  });
  root.addEventListener("input", event => {
    const input = event.target.closest("[data-choice]");
    if (!input) return;
    assign(input, input.value);
    if (input.value !== "" && String(values[input.dataset.choice] ?? 0) !== input.value) input.value = values[input.dataset.choice] ?? 0;
  });
  root.addEventListener("change", event => {
    const input = event.target.closest("[data-choice]");
    if (input) input.value = values[input.dataset.choice] ?? 0;
  });
  update();
}

function renderDraft(category) {
  const values = {};
  drafts.set(category.id, values);
  const old = $('[data-draft="' + category.id + '"]');
  const next = old.cloneNode(false);
  old.replaceWith(next);
  next.innerHTML = menu.guisos.opciones.map(name => stepper(name, name)).join("");
  const output = $('[data-draft-count="' + category.id + '"]');
  const action = $('[data-add-plate="' + category.id + '"]');
  bindSteppers(next, values, LIMIT, total => {
    output.value = total + (total === 1 ? " pieza" : " piezas");
    action.disabled = total === 0;
  });
}

function drinkRows(values) {
  return menu.bebidas.map(drink => stepper(drink.id, drink.nombre, values[drink.id], money(drink.precio) + " c/u")).join("");
}

function renderDrinkDraft() {
  const old = $("#drinks-draft");
  const next = old.cloneNode(false);
  const values = {};
  drafts.set("bebidas", values);
  old.replaceWith(next);
  next.innerHTML = drinkRows(values);
  bindSteppers(next, values, Infinity, total => { $("[data-add-drinks]").disabled = !total; });
}

function selectOptions(label, key, options, selected) {
  return '<label class="select-row"><span>' + html(label) + '</span><select data-option="' + html(key) + '" required>' +
    (options.length > 1 ? '<option value="">Selecciona una opción</option>' : '') +
    options.map(option => '<option value="' + html(option.id) + '"' + (option.id === selected ? ' selected' : '') + '>' +
      html(option.label) + '</option>').join("") + '</select></label>';
}

function openDialog(title, body) {
  if (!dialog.open) returnFocus = document.activeElement;
  dialogTitle.textContent = title;
  content.innerHTML = body;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  dialogTitle.focus();
}

function showEditor(plate, index = null) {
  const current = structuredClone(plate);
  const category = menu.categorias.find(item => item.id === current.categoria);
  const combo = menu.combos.find(item => item.id === current.combo);
  const breakfast = menu.desayunos.find(item => item.id === current.desayuno);
  const canEditGuisos = Boolean(combo || (category && index !== null));
  const name = breakfast?.nombre ?? (combo ? "Combo de " + combo.cantidad + " " + combo.nombre : category?.nombre ?? "Bebidas");
  let controls = "";
  if (category && !canEditGuisos) {
    controls += '<p class="selected-guisos">' + Object.entries(current.guisos).map(([key, value]) => html(value + " × " + key)).join(" · ") + '</p>';
  }
  if (canEditGuisos) {
    controls += '<fieldset><legend>Guisos</legend><div class="editor-grid" data-editor-group="guisos">' +
      menu.guisos.opciones.map(name => stepper(name, name, current.guisos[name])).join("") + '</div>' +
      (combo ? '<p class="hint" id="combo-progress" aria-live="polite"></p>' : '') + '</fieldset>';
  }
  if (breakfast) {
    controls += breakfast.opciones.map(group => selectOptions(group.etiqueta, group.id, group.opciones.map(id => ({ id, label: id })), current.opciones[group.id])).join("");
    if (breakfast.incluye?.length) {
      const excluded = current.sinComplementos ?? [];
      controls += '<fieldset data-included-group><legend>Incluye</legend><p class="hint">Desmarca lo que quieras quitar.</p><div class="included-options">' +
        breakfast.incluye.map(name => '<label class="included-option"><input type="checkbox" value="' + html(name) + '"' +
          (excluded.includes(name) ? "" : " checked") + '>' + html(name) + '</label>').join("") + '</div></fieldset>';
    }
    if (breakfast.extra) controls += '<details class="extras"><summary>' + html(breakfast.extra.nombre) + ' · ' + money(breakfast.extra.precio) + ' c/u</summary><div class="editor-grid" data-editor-group="extras">' +
      breakfast.extra.opciones.map(item => stepper(item, item, current.extras[item])).join("") + '</div></details>';
  }
  if (combo) {
    const options = comboDrinks(menu, combo).map(drink => ({ id: drink.id, label: comboDrinkLabel(drink.nombre, drink.suplementoCombo) }));
    controls += selectOptions("Bebida incluida", "bebidaCombo", options, current.bebidaCombo);
  } else {
    controls += '<fieldset><legend>' + (current.soloBebidas ? "Bebidas" : "Bebidas opcionales") + '</legend><div class="editor-grid" data-editor-group="bebidas">' + drinkRows(current.bebidas) + '</div></fieldset>';
  }
  openDialog(index === null ? name : "Editar " + name, '<form id="plate-form">' + controls +
    '<div id="plate-detail" class="live-detail" aria-live="polite"></div><div class="dialog-actions"><button type="submit" class="button primary">' +
    (index === null ? "Agregar al carrito" : "Guardar cambios") + '</button></div></form>');

  const form = $("#plate-form");
  const refresh = () => {
    const detail = $("#plate-detail");
    const button = $('button[type="submit"]', form);
    const remaining = combo ? combo.cantidad - count(current.guisos) : null;
    if (combo) $("#combo-progress").textContent = remaining ? "Faltan " + remaining + (remaining === 1 ? " pieza." : " piezas.") : combo.cantidad + " piezas seleccionadas.";
    try {
      const priced = pricePlate(menu, current);
      detail.innerHTML = breakdown(priced) + '<p class="split subtotal"><strong>Subtotal</strong><strong>' + money(priced.subtotal) + '</strong></p>';
      button.disabled = false;
    } catch {
      detail.textContent = "Completa la selección para calcular el subtotal.";
      button.disabled = true;
    }
  };
  $$("[data-option]", form).forEach(select => {
    const bind = () => {
      if (combo) current.bebidaCombo = select.value;
      else current.opciones[select.dataset.option] = select.value;
      refresh();
    };
    select.addEventListener("change", bind);
    if (combo) current.bebidaCombo = select.value;
    else current.opciones[select.dataset.option] = select.value;
  });
  const includedGroup = $("[data-included-group]", form);
  includedGroup?.addEventListener("change", () => {
    current.sinComplementos = $$("input:not(:checked)", includedGroup).map(input => input.value);
    refresh();
  });
  $$("[data-editor-group]", form).forEach(group => {
    const key = group.dataset.editorGroup;
    const limit = key === "guisos" ? (combo?.cantidad ?? LIMIT) : Infinity;
    bindSteppers(group, current[key], limit, refresh);
  });
  refresh();
  form.addEventListener("submit", event => {
    event.preventDefault();
    try { pricePlate(menu, current); } catch { return; }
    const next = plates.slice();
    if (index === null) next.push(current);
    else next[index] = current;
    commit(next, (index === null ? "Agregado al carrito. " : "Cambios guardados. ") + name + ".");
    if (index === null && category && !combo) renderDraft(category);
    editedIndex = index;
    dialog.close();
  });
}

function breakdown(detail) {
  const line = item => '<li><span>' + html(item.qty + " × " + item.name) + '</span><span>' + money(item.total) + '</span></li>';
  const groups = detail.combos.map(combo => '<div class="discount"><div class="split"><strong>Combo ' + html(combo.name) + '</strong><strong>' + money(combo.price) + '</strong></div><p>' +
    html(Object.entries(combo.guisos).filter(([, qty]) => qty).map(([name, qty]) => qty + " × " + name).join(" · ")) +
    '</p><p>Bebida incluida · ' + html(comboDrinkLabel(combo.drink, combo.supplement)) + '</p></div>').join("");
  const individual = detail.individual.length ? '<p class="line-label">Piezas individuales</p><ul class="lines">' + detail.individual.map(line).join("") + '</ul>' : '';
  const drinks = detail.drinks.length ? '<p class="line-label">Bebidas</p><ul class="lines">' + detail.drinks.map(line).join("") + '</ul>' : '';
  const extras = detail.extras.length ? '<p class="line-label">Toppings adicionales</p><ul class="lines">' + detail.extras.map(line).join("") + '</ul>' : '';
  const choices = detail.choices ? '<p class="split"><span>' + html(detail.name) + '</span><strong>' + money(detail.base) + '</strong></p><p class="hint">' + detail.choices.map(ch => html(ch.label + " · " + ch.value)).join(" · ") + '</p>' : '';
  const exclusions = detail.sinComplementos?.length ? '<p class="hint">Sin: ' + html(detail.sinComplementos.join(", ")) + '</p>' : '';
  return groups + individual + choices + exclusions + drinks + extras;
}

function renderCart(order) {
  const body = plates.map((plate, index) => {
    const detail = pricePlate(menu, plate);
    return '<article class="cart-item"><h4>Platito ' + (index + 1) + ' · ' + html(detail.name) + '</h4>' + breakdown(detail) +
      '<p class="split subtotal"><strong>Subtotal</strong><strong>' + money(detail.subtotal) + '</strong></p><div class="row-actions">' +
      '<button type="button" class="button outline" data-edit="' + index + '" aria-label="Editar platito ' + (index + 1) + '">Editar</button>' +
      '<button type="button" class="button outline" data-remove="' + index + '" aria-label="Eliminar platito ' + (index + 1) + '">Eliminar</button></div></article>';
  }).join("");
  const link = business.whatsapp ? '<a class="button primary" href="https://wa.me/' + business.whatsapp + '?text=' + encodeURIComponent(order.text) + '" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>' : '<p class="hint">WhatsApp de pedidos pendiente de confirmación.</p>';
  const notice = cartDrinksChanged ? '<p class="hint">Actualizamos las bebidas del menú. Puedes editar tus platitos para elegir una bebida disponible.</p>' : "";
  summary.innerHTML = body ? notice + '<div class="order-grid"><div class="order-items">' + body + '</div><div class="order-checkout">' +
    '<p class="split cart-grand"><strong>Total</strong><strong>' + money(order.total) + ' MXN</strong></p>' +
    '<label class="ticket-label" for="ticket">Ticket para WhatsApp</label><textarea id="ticket" rows="8" readonly></textarea>' +
    '<div class="row-actions"><button type="button" id="copy-ticket" class="button ' + (business.whatsapp ? "outline" : "primary") + '">Copiar ticket</button>' +
    link + '</div><p class="hint" id="copy-status" role="status"></p></div></div>' : '<p class="empty-cart">Tu carrito está vacío.</p>';
  if (!body) return;
  const ticketField = $("#ticket");
  ticketField.value = order.text;
  $("#copy-ticket").addEventListener("click", async () => {
    const status = $("#copy-status");
    try {
      await navigator.clipboard.writeText(order.text);
      status.textContent = "Ticket copiado.";
    } catch {
      ticketField.select();
      status.textContent = "El ticket está seleccionado. Puedes copiarlo con tu teclado o menú contextual.";
    }
  });
}

function showCart(focusIndex = null) {
  const rowButton = focusIndex === null ? null : $('[data-edit="' + Math.min(focusIndex, plates.length - 1) + '"]', summary);
  const target = rowButton ?? $("#order-summary-title");
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: rowButton ? "nearest" : "start" });
}

function initMenu() {
  const tabs = $$("[role=tab]");
  const select = active => tabs.forEach(tab => {
    const enabled = tab === active;
    const panel = document.getElementById(tab.getAttribute("aria-controls"));
    tab.setAttribute("aria-selected", String(enabled));
    tab.tabIndex = enabled ? 0 : -1;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    panel.tabIndex = -1;
    panel.hidden = !enabled;
  });
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", event => {
      const positions = { ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length, Home: 0, End: tabs.length - 1 };
      if (!Object.hasOwn(positions, event.key)) return;
      event.preventDefault();
      const next = tabs[positions[event.key]];
      next.focus();
      select(next);
    });
  });
  $$("[data-category-link]").forEach(link => {
    link.addEventListener("click", () => {
      const tab = document.getElementById("tab-" + link.dataset.categoryLink);
      select(tab);
      document.getElementById(tab.getAttribute("aria-controls")).focus({ preventScroll: true });
    });
  });
  select(tabs[0]);
  menu.categorias.filter(item => item.tipo === "guisos").forEach(renderDraft);
  renderDrinkDraft();
}

const nav = $(".nav-toggle");
function closeNav() {
  nav.setAttribute("aria-expanded", "false");
}
nav.addEventListener("click", () => nav.setAttribute("aria-expanded", String(nav.getAttribute("aria-expanded") === "false")));
$("#site-nav").addEventListener("click", event => { if (event.target.closest("a")) closeNav(); });
$(".site-header").addEventListener("keydown", event => {
  if (event.key === "Escape" && nav.getAttribute("aria-expanded") === "true") { closeNav(); nav.focus(); }
});

$("#close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  if (dialog.open) return;
  if (editedIndex !== null) {
    showCart(editedIndex);
    editedIndex = null;
  } else if (returnFocus?.isConnected && !returnFocus.disabled) returnFocus.focus();
  else $(".floating-cart").focus({ preventScroll: true });
  returnFocus = null;
});

document.addEventListener("click", event => {
  const action = event.target.closest("button");
  if (!action || action.disabled) return;
  const data = action.dataset;
  if (Object.hasOwn(data, "cart")) showCart();
  if (data.addPlate) showEditor({ categoria: data.addPlate, guisos: drafts.get(data.addPlate), bebidas: {} });
  if (data.breakfast) showEditor({ desayuno: data.breakfast, opciones: {}, extras: {}, bebidas: {} });
  if (data.combo) {
    const combo = menu.combos.find(item => item.id === data.combo);
    showEditor({ combo: combo.id, categoria: combo.categoria, guisos: {}, bebidaCombo: "" });
  }
  if (data.addDrinks) {
    commit([...plates, { soloBebidas: true, bebidas: { ...drafts.get("bebidas") } }], "Bebidas agregadas al carrito.");
    renderDrinkDraft();
    showCart();
  }
  if (data.edit !== undefined) showEditor(plates[Number(data.edit)], Number(data.edit));
  if (data.remove !== undefined) {
    const index = Number(data.remove);
    commit(plates.filter((_, position) => position !== index), "Platito eliminado.");
    showCart(index);
  }
});

function loadHits() {
  const img = $("#hits-image");
  const label = $("#hits-state");
  const error = () => { if (!label.hidden) label.textContent = "No disponible"; };
  img.addEventListener("load", () => { img.hidden = false; label.hidden = true; }, { once: true });
  img.addEventListener("error", error, { once: true });
  img.src = img.dataset.src;
  setTimeout(error, 9000);
}

initMenu();
updateCart();
document.body.classList.add("enhanced");
setTimeout(loadHits, 100);

