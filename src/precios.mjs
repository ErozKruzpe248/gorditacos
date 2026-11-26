const format = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
export const money = value => format.format(value);
export const LIMIT = 99;
export const quantity = value => Math.max(0, Math.min(LIMIT, Math.trunc(Number(value)) || 0));
export const count = values => Object.values(values).reduce((sum, value) => sum + value, 0);
const sameOptions = (values, allowed) => Object.keys(values).every(key => allowed.includes(key));
const validCounts = values => values && typeof values === "object" && Object.values(values).every(value => quantity(value) === value);
const rows = values => Object.entries(values).filter(([, value]) => value > 0);
const line = (name, qty, each) => ({ name, qty, total: qty * each });

export function comboDrinks(menu, combo) {
  return combo.bebidaEspecial ? [...menu.bebidas, combo.bebidaEspecial] : menu.bebidas;
}

function automaticCombos(combos, drinks, units, unitPrice) {
  if (!combos.length) return [];
  // Each stage can consume the current drink at most once. States track units
  // consumed and retain the greatest saving for that total.
  let states = new Map([[0, { saving: 0, selected: [] }]]);
  for (const drink of drinks) {
    // At least one product is required per promotion. Beyond this bound,
    // identical drinks cannot provide another way to combine the plate.
    for (let index = 0; index < Math.min(drink.qty, units); index++) {
      const next = new Map(states);
      for (const [used, state] of states) {
        for (const combo of combos) {
          const total = used + combo.cantidad;
          if (total > units) continue;
          const saving = state.saving + combo.cantidad * unitPrice + drink.precio - combo.precio;
          if (saving > (next.get(total)?.saving ?? 0)) {
            next.set(total, { saving, selected: [...state.selected, { combo, drink }] });
          }
        }
      }
      states = next;
    }
  }
  const best = [...states.values()].reduce((best, state) => state.saving > best.saving ? state : best);
  return best.selected;
}

function takeGuisos(remaining, units) {
  const guisos = {};
  for (const [name, remainingQty] of rows(remaining)) {
    const taken = Math.min(remainingQty, units);
    guisos[name] = taken;
    remaining[name] -= taken;
    units -= taken;
    if (!units) break;
  }
  return guisos;
}

function priceGuisos(menu, plate) {
  const category = menu.categorias.find(item => item.id === plate.categoria && item.tipo === "guisos");
  if (!category || !validCounts(plate.guisos) || !sameOptions(plate.guisos, menu.guisos.opciones)) throw new Error("Revisa los guisos.");
  const units = count(plate.guisos);
  if (units < 1 || units > LIMIT) throw new Error("Revisa la cantidad del platito.");
  const remaining = Object.fromEntries(menu.guisos.opciones.map(name => [name, plate.guisos[name] ?? 0]));
  const direct = menu.combos.find(combo => combo.id === plate.combo);
  if (plate.combo) {
    if (!direct || direct.categoria !== category.id || direct.cantidad !== units) throw new Error("Completa la cantidad indicada para el combo.");
    const drink = comboDrinks(menu, direct).find(item => item.id === plate.bebidaCombo);
    if (!drink) throw new Error("Elige la bebida permitida para el combo.");
    const detail = { name: direct.cantidad + " " + direct.nombre, guisos: remaining, drink: drink.nombre, price: direct.precio };
    return { name: category.nombre, combos: [detail], individual: [], drinks: [], extras: [], subtotal: direct.precio };
  }

  if (!validCounts(plate.bebidas) || !sameOptions(plate.bebidas, menu.bebidas.map(drink => drink.id))) throw new Error("Revisa las bebidas.");
  const drinks = menu.bebidas.map(drink => ({ ...drink, qty: plate.bebidas[drink.id] ?? 0 }));
  const available = menu.combos.filter(combo => combo.categoria === category.id);
  const promos = automaticCombos(available, drinks, units, category.precio).map(({ combo, drink }) => {
    drink.qty--;
    return { name: combo.cantidad + " " + combo.nombre, guisos: takeGuisos(remaining, combo.cantidad), drink: drink.nombre, price: combo.precio };
  });
  const individual = rows(remaining).map(([name, qty]) => line(name, qty, category.precio));
  const separateDrinks = drinks.filter(drink => drink.qty).map(drink => line(drink.nombre, drink.qty, drink.precio));
  const subtotal = [...individual, ...separateDrinks].reduce((sum, item) => sum + item.total, 0) + promos.reduce((sum, combo) => sum + combo.price, 0);
  return { name: category.nombre, combos: promos, individual, drinks: separateDrinks, extras: [], subtotal };
}

function priceBreakfast(menu, plate) {
  const item = menu.desayunos.find(option => option.id === plate.desayuno);
  if (!item) throw new Error("Elige un desayuno.");
  const choices = item.opciones.map(group => {
    const value = plate.opciones?.[group.id];
    if (!group.opciones.includes(value)) throw new Error("Elige " + group.etiqueta.toLowerCase() + ".");
    return { label: group.etiqueta, value };
  });
  const allowed = item.extra?.opciones ?? [];
  if (!validCounts(plate.extras) || !sameOptions(plate.extras, allowed)) throw new Error("Revisa los complementos.");
  const included = item.incluye ?? [];
  const { sinComplementos = [] } = plate;
  if (!Array.isArray(sinComplementos) || !sinComplementos.every(name => included.includes(name))) throw new Error("Revisa los complementos incluidos.");
  if (!validCounts(plate.bebidas) || !sameOptions(plate.bebidas, menu.bebidas.map(drink => drink.id))) throw new Error("Revisa las bebidas.");
  const extras = rows(plate.extras).map(([name, qty]) => line(name, qty, item.extra.precio));
  const drinks = menu.bebidas.filter(drink => plate.bebidas[drink.id]).map(drink => line(drink.nombre, plate.bebidas[drink.id], drink.precio));
  const subtotal = [...extras, ...drinks].reduce((sum, item) => sum + item.total, item.precio);
  return { name: item.nombre, base: item.precio, choices, sinComplementos: included.filter(name => sinComplementos.includes(name)), extras, drinks, combos: [], individual: [], subtotal };
}

export function pricePlate(menu, plate) {
  if (!plate || typeof plate !== "object") throw new Error("Selecciona un platito.");
  if (plate.soloBebidas) {
    const choices = menu.bebidas;
    if (!validCounts(plate.bebidas) || !sameOptions(plate.bebidas, choices.map(drink => drink.id)) || !count(plate.bebidas)) {
      throw new Error("Elige al menos una bebida.");
    }
    const drinks = choices.filter(drink => plate.bebidas[drink.id]).map(drink => line(drink.nombre, plate.bebidas[drink.id], drink.precio));
    const subtotal = drinks.reduce((sum, drink) => sum + drink.total, 0);
    return { name: "Bebidas", combos: [], individual: [], drinks, extras: [], subtotal };
  }
  return plate.desayuno ? priceBreakfast(menu, plate) : priceGuisos(menu, plate);
}

export function ticket(menu, plates, businessName) {
  let total = 0;
  const lines = plates.map((plate, index) => {
    const detail = pricePlate(menu, plate);
    total += detail.subtotal;
    const content = ["*Platito " + (index + 1) + " · " + detail.name + "*"];
    for (const combo of detail.combos) {
      content.push("Combo " + combo.name + " — " + money(combo.price));
      for (const [guiso, qty] of rows(combo.guisos)) content.push("  • " + qty + " × " + guiso);
      content.push("  Bebida incluida: " + combo.drink);
    }
    if (detail.individual.length) content.push("Piezas individuales");
    for (const item of detail.individual) content.push("• " + item.qty + " × " + item.name + " — " + money(item.total));
    if (detail.choices) {
      content.push("1 × " + detail.name + " — " + money(detail.base));
      for (const choice of detail.choices) content.push("  " + choice.label + ": " + choice.value);
      if (detail.sinComplementos.length) content.push("  Sin: " + detail.sinComplementos.join(", "));
    }
    for (const item of detail.drinks) content.push("Bebida: " + item.qty + " × " + item.name + " — " + money(item.total));
    for (const item of detail.extras) content.push("Topping adicional: " + item.qty + " × " + item.name + " — " + money(item.total));
    content.push("Subtotal: " + money(detail.subtotal));
    return content.join("\n");
  });
  return { total, text: ["Hola, " + businessName + ". Me gustaría solicitar este pedido:", ...lines, "*Total: " + money(total) + " " + menu.moneda + "*"].join("\n\n") };
}

