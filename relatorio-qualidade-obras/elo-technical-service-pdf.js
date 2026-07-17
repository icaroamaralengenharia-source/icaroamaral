(function (root) {
  "use strict";

  const VERSION = "20260717-elo-technical-service-pdf-v3";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function escapeHtml(value) {
    return clean(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function numeric(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
  function br(value, digits) {
    const parsed = numeric(value);
    if (parsed === null) return "-";
    return parsed.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function quantity(value) { return br(value, 2); }
  function coefficient(value) {
    const parsed = numeric(value);
    if (parsed === null) return "-";
    return parsed.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  }
  function money(value) {
    const parsed = numeric(value);
    if (parsed === null) return "-";
    return "R$ " + parsed.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function unit(value) {
    const text = clean(value);
    if (/^m2$/i.test(text)) return "m\u00b2";
    if (/^m3$/i.test(text)) return "m\u00b3";
    return text || "-";
  }
  function formatDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return clean(value);
    return date.toLocaleString("pt-BR", { timeZone: "America/Bahia", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function formatDimensionNumbers(line) {
    return clean(line)
      .replace(/\bm2\b/g, "m\u00b2")
      .replace(/\bm3\b/g, "m\u00b3")
      .replace(/(\d+(?:[,.]\d+)?)\s*m\u00b2/g, function (_, number) { return quantity(String(number).replace(",", ".")) + " m\u00b2"; })
      .replace(/(\d+(?:[,.]\d+)?)\s*m\u00b3/g, function (_, number) { return quantity(String(number).replace(",", ".")) + " m\u00b3"; })
      .replace(/(\d+(?:[,.]\d+)?)\s*m(?=\s*(?:x|\u00d7|=|$))/gi, function (_, number) { return quantity(String(number).replace(",", ".")) + " m"; });
  }
  function normalizeLine(value) {
    return formatDimensionNumbers(value)
      .replace(/Area projetada/g, "\u00c1rea projetada")
      .replace(/Area inclinada/g, "\u00c1rea inclinada")
      .replace(/Area com perdas/g, "\u00c1rea com perdas")
      .replace(/inclinacao/g, "inclina\u00e7\u00e3o")
      .replace(/Aco estrutural nao incluido neste quantitativo\.?/gi, "A\u00e7o estrutural n\u00e3o inclu\u00eddo neste quantitativo.");
  }
  function serviceName(value) {
    const text = normalize(value);
    if (/alvenaria/.test(text)) return "Alvenaria de bloco cer\u00e2mico";
    if (/escavacao.*vala/.test(text)) return "Escava\u00e7\u00e3o manual de vala";
    if (/viga baldrame/.test(text)) return "Concreto para viga baldrame";
    if (/cobertura|telhado|telha/.test(text)) return "Cobertura cer\u00e2mica";
    return clean(value) || "Servi\u00e7o t\u00e9cnico";
  }
  function pendingText(value) {
    const text = clean(value);
    if (text === "cumeeira_length_missing") return "Comprimento da cumeeira n\u00e3o informado.";
    if (text === "loss_percent_not_informed") return "Percentual de perdas n\u00e3o informado.";
    if (text === "steel_not_included" || /aco estrutural nao incluido|a.o estrutural n.o inclu.do/i.test(text)) return "A\u00e7o estrutural n\u00e3o inclu\u00eddo.";
    if (/composition_not_found/.test(text)) return "Composi\u00e7\u00e3o complementar n\u00e3o localizada.";
    return text.replace(/_/g, " ");
  }
  function sentenceJoin(items) {
    const unique = [];
    (items || []).forEach(function (item) { const text = clean(item).replace(/[.\s]+$/g, ""); if (text && unique.indexOf(text) < 0) unique.push(text); });
    return unique.length ? unique.join("; ") + "." : "nenhuma.";
  }
  function roleText(value) {
    const text = clean(value);
    if (text === "telhamento") return "Telhamento";
    if (text === "estrutura_madeira") return "Trama de madeira";
    if (text === "cumeeira") return "Cumeeira";
    return "Composi\u00e7\u00e3o";
  }
  function compositionList(result) {
    const related = Array.isArray(result.relatedCompositions) ? result.relatedCompositions : [];
    if (related.length) return related;
    return result.composition ? [Object.assign({ role: "composicao" }, result.composition)] : [];
  }
  function isLabor(item) {
    const haystack = normalize([item && item.name, item && item.unit].join(" "));
    return /\bh\b|pedreiro|servente|telhadista|carpinteiro|ajudante|oficial|encargos complementares/.test(haystack);
  }
  function isEquipment(item) {
    const name = normalize(item && item.name);
    const itemUnit = normalize(item && item.unit);
    return /^(chp|chi)$/.test(itemUnit) || /vibrador|guincho|compactador|escavadeira|retroescavadeira|martelete/.test(name);
  }
  function isAuxiliaryComposition(item) {
    const name = normalize(item && item.name);
    return /argamassa traco|concreto fck|preparo mecanico|preparo em betoneira/.test(name);
  }
  function splitDisplayItems(result) {
    const buckets = { materials: [], labor: [], equipment: [], auxiliary: [] };
    function add(item) {
      if (!item) return;
      if (isEquipment(item)) buckets.equipment.push(item);
      else if (isLabor(item)) buckets.labor.push(item);
      else if (isAuxiliaryComposition(item)) buckets.auxiliary.push(item);
      else buckets.materials.push(item);
    }
    (result.materials || []).forEach(add);
    (result.labor || []).forEach(function (item) { buckets.labor.push(item); });
    (result.equipment || []).forEach(function (item) { buckets.equipment.push(item); });
    return buckets;
  }
  function itemKey(item, category) { return [category, clean(item.code || "sem-codigo"), unit(item.unit)].join("|"); }
  function consolidate(items, category) {
    const map = {};
    items.forEach(function (item) {
      const key = itemKey(item, category);
      if (!map[key]) map[key] = Object.assign({}, item, { quantity: 0 });
      map[key].quantity += Number(item.quantity || 0);
    });
    return Object.keys(map).sort().map(function (key) { return map[key]; });
  }
  function allDisplay(results) {
    const output = { materials: [], labor: [], equipment: [], auxiliary: [] };
    (results || []).forEach(function (result) {
      const split = splitDisplayItems(result);
      output.materials = output.materials.concat(split.materials);
      output.labor = output.labor.concat(split.labor);
      output.equipment = output.equipment.concat(split.equipment);
      output.auxiliary = output.auxiliary.concat(split.auxiliary);
    });
    return {
      materials: consolidate(output.materials, "materials"),
      labor: consolidate(output.labor, "labor"),
      equipment: consolidate(output.equipment, "equipment"),
      auxiliary: consolidate(output.auxiliary, "auxiliary")
    };
  }
  function tableRows(items, emptyText) {
    if (!items || !items.length) return "<tr><td colspan=\"5\">" + escapeHtml(emptyText || "Sem itens nesta categoria.") + "</td></tr>";
    return items.map(function (item) {
      return "<tr>" +
        "<td>" + escapeHtml(item.code || "-") + "</td>" +
        "<td>" + escapeHtml(item.name || "-") + "</td>" +
        "<td>" + escapeHtml(unit(item.unit)) + "</td>" +
        "<td class=\"num\">" + coefficient(item.coefficient) + "</td>" +
        "<td class=\"num\">" + quantity(item.quantity) + " " + unit(item.unit) + "</td>" +
      "</tr>";
    }).join("");
  }
  function consolidatedRows(items) {
    if (!items.length) return "<tr><td colspan=\"4\">Sem itens consolidados.</td></tr>";
    return items.map(function (item) {
      return "<tr><td>" + escapeHtml(item.code || "-") + "</td><td>" + escapeHtml(item.name || "-") + "</td><td>" + escapeHtml(unit(item.unit)) + "</td><td class=\"num\">" + quantity(item.quantity) + " " + unit(item.unit) + "</td></tr>";
    }).join("");
  }
  function minimumPurchase(item) {
    const itemUnit = normalize(item && item.unit);
    const name = normalize(item && item.name);
    if (itemUnit === "un" && /bloco|tijolo|telha/.test(name)) return Math.ceil(Number(item.quantity || 0)).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " un";
    return "-";
  }
  function materialUseRows(items) {
    if (!items.length) return "<tr><td colspan=\"6\">Sem materiais diretos de compra nesta sele\u00e7\u00e3o.</td></tr>";
    return items.map(function (item) {
      return "<tr><td>" + escapeHtml(item.code || "-") + "</td><td>" + escapeHtml(item.name || "-") + "</td><td>" + escapeHtml(unit(item.unit)) + "</td><td class=\"num\">" + quantity(item.quantity) + " " + unit(item.unit) + "</td><td class=\"num\">" + escapeHtml(minimumPurchase(item)) + "</td><td>Perdas n\u00e3o aplicadas.</td></tr>";
    }).join("");
  }
  function auxiliaryRows(items) {
    if (!items.length) return "<tr><td colspan=\"5\">Nenhuma composi\u00e7\u00e3o auxiliar identificada.</td></tr>";
    return items.map(function (item) {
      return "<tr><td>" + escapeHtml(item.code || "-") + "</td><td>" + escapeHtml(item.name || "-") + "</td><td>" + escapeHtml(unit(item.unit)) + "</td><td class=\"num\">" + quantity(item.quantity) + " " + unit(item.unit) + "</td><td>Composi\u00e7\u00e3o auxiliar ainda n\u00e3o detalhada em insumos de compra.</td></tr>";
    }).join("");
  }
  function memoryLines(result) {
    const lines = (result.calculationMemory || []).map(normalizeLine).filter(Boolean);
    if (!lines.length && result.dimensions && result.dimensions.length && result.dimensions.height && /alvenaria|parede|bloco/i.test(result.service || "")) {
      lines.push("\u00c1rea = " + quantity(result.dimensions.length) + " m \u00d7 " + quantity(result.dimensions.height) + " m = " + quantity(result.quantity) + " " + unit(result.unit));
    }
    return lines;
  }
  function priced(result) { return result && result.pricingStatus === "priced" && numeric(result.totalCost) !== null; }
  function baseReference(composition) {
    const item = composition || {};
    const globalMeta = root.EloPublicSinapiIndex || {};
    const meta = item.metadata || {};
    const source = item.source || meta.source || globalMeta.source;
    const state = item.uf || item.sourceRegion || meta.state || meta.uf || globalMeta.state;
    const reference = item.month || item.monthYear || item.referenceMonth || item.sourceDate || meta.referenceMonth || globalMeta.referenceMonth;
    const origin = [item.originPath, meta.originPath, meta.importedFrom, globalMeta.originPath].join(" ");
    const regime = /desonerado/i.test(origin) ? "Desonerado" : /nao.?desonerado|n\u00e3o.?desonerado/i.test(origin) ? "N\u00e3o desonerado" : "";
    if (!source || !state || !reference || !regime) return "Refer\u00eancia completa da base n\u00e3o informada.";
    return ["Base " + source, state, reference, regime].join(" | ");
  }
  function baseLabel(result) {
    return baseReference(result && result.composition);
  }
  function section(result, index) {
    const compositions = compositionList(result);
    const split = splitDisplayItems(result);
    const assumptions = (result.assumptions || []).map(pendingText).filter(Boolean);
    const pending = (result.pending || []).concat(result.warnings || []).map(pendingText).filter(Boolean);
    const memories = memoryLines(result);
    if (/viga baldrame/i.test(result.service || "")) {
      assumptions.push("A concretagem da viga baldrame n\u00e3o inclui a\u00e7o, formas, escava\u00e7\u00e3o, impermeabiliza\u00e7\u00e3o ou reaterro.");
    }
    return "<section class=\"stage\">" +
      "<h2>" + (index + 1) + ". " + escapeHtml(serviceName(result.service)) + "</h2>" +
      "<div class=\"summary\"><span>Quantidade final</span><strong>" + quantity(result.quantity) + " " + unit(result.unit) + "</strong></div>" +
      "<h3>Mem\u00f3ria de c\u00e1lculo</h3><ul>" + (memories.length ? memories.map(function (line) { return "<li>" + escapeHtml(line) + "</li>"; }).join("") : "<li>Sem mem\u00f3ria geom\u00e9trica informada.</li>") + "</ul>" +
      "<h3>Composi\u00e7\u00f5es SINAPI</h3><table><thead><tr><th>Papel</th><th>C\u00f3digo</th><th>Descri\u00e7\u00e3o</th><th>Un.</th><th>Fonte</th></tr></thead><tbody>" +
      (compositions.length ? compositions.map(function (item) { return "<tr><td>" + escapeHtml(roleText(item.role)) + "</td><td>" + escapeHtml(item.code || "-") + "</td><td>" + escapeHtml(item.description || "-") + "</td><td>" + unit(item.unit) + "</td><td>" + escapeHtml(item.source || "-") + "</td></tr>"; }).join("") : "<tr><td colspan=\"5\">Nenhuma composi\u00e7\u00e3o localizada.</td></tr>") + "</tbody></table>" +
      "<h3>Materiais diretos</h3><table><thead><tr><th>C\u00f3digo</th><th>Item</th><th>Un.</th><th>Coef.</th><th>Qtd.</th></tr></thead><tbody>" + tableRows(split.materials) + "</tbody></table>" +
      "<h3>Composi\u00e7\u00f5es auxiliares utilizadas</h3><table><thead><tr><th>C\u00f3digo</th><th>Composi\u00e7\u00e3o auxiliar</th><th>Un.</th><th>Consumo</th><th>Observa\u00e7\u00e3o</th></tr></thead><tbody>" + auxiliaryRows(split.auxiliary) + "</tbody></table>" +
      "<h3>M\u00e3o de obra</h3><table><thead><tr><th>C\u00f3digo</th><th>Item</th><th>Un.</th><th>Coef.</th><th>Qtd.</th></tr></thead><tbody>" + tableRows(split.labor) + "</tbody></table>" +
      "<h3>Equipamentos</h3><table><thead><tr><th>C\u00f3digo</th><th>Item</th><th>Un.</th><th>Coef.</th><th>Qtd.</th></tr></thead><tbody>" + tableRows(split.equipment) + "</tbody></table>" +
      "<h3>Custos</h3><p>" + (priced(result) ? "Custo unit\u00e1rio: <strong>" + money(result.unitCost) + "/" + unit(result.unit) + "</strong> | Subtotal: <strong>" + money(result.totalCost) + "</strong>" : "Servi\u00e7o sem pre\u00e7o confi\u00e1vel na base carregada. Nenhum pre\u00e7o foi inventado.") + "</p>" +
      (assumptions.length ? "<h3>Avisos</h3><ul>" + assumptions.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ul>" : "") +
      (pending.length ? "<h3>Pend\u00eancias</h3><ul>" + pending.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ul>" : "") +
    "</section>";
  }
  function itemCategoryLabel(category) {
    if (category === "labor") return "m\u00e3o de obra";
    if (category === "equipment") return "equipamento";
    if (category === "auxiliary") return "composi\u00e7\u00e3o auxiliar";
    return "material";
  }
  function pricedItems(results) {
    const items = [];
    (results || []).forEach(function (result) {
      const split = splitDisplayItems(result);
      [
        { category: "material", list: split.materials },
        { category: "auxiliary", list: split.auxiliary || [] },
        { category: "labor", list: split.labor },
        { category: "equipment", list: split.equipment }
      ].forEach(function (group) {
        (group.list || []).forEach(function (item) {
          if (numeric(item.unitPrice) !== null && numeric(item.itemSubtotal) !== null) items.push(Object.assign({ category: group.category }, item));
        });
      });
    });
    return items;
  }
  function pricedItemRows(items) {
    if (!items.length) return "<tr><td colspan=\"7\">Nenhum item com pre\u00e7o anal\u00edtico real na base carregada.</td></tr>";
    return items.map(function (item) {
      return "<tr><td>" + escapeHtml(item.code || "-") + "</td><td>" + escapeHtml(itemCategoryLabel(item.category)) + "</td><td>" + escapeHtml(item.name || "-") + "</td><td>" + escapeHtml(unit(item.unit)) + "</td><td class=\"num\">" + quantity(item.quantity) + "</td><td class=\"num\">" + money(item.unitPrice) + "</td><td class=\"num\">" + money(item.itemSubtotal) + "</td></tr>";
    }).join("");
  }
  function pricedItemsSection(results) {
    const items = pricedItems(results || []);
    const analyticSubtotal = items.reduce(function (sum, item) { return sum + Number(item.itemSubtotal || 0); }, 0);
    const officialSubtotal = (results || []).reduce(function (sum, item) { return sum + (priced(item) ? Number(item.totalCost) : 0); }, 0);
    const divergence = analyticSubtotal - officialSubtotal;
    const divergencePercent = officialSubtotal ? Math.abs(divergence) / officialSubtotal * 100 : 0;
    return "<section class=\"priced-items\"><h2>Itens precificados</h2>" +
      "<table><thead><tr><th>C\u00f3digo</th><th>Categoria</th><th>Item</th><th>Un.</th><th>Quantidade</th><th>Pre\u00e7o unit\u00e1rio</th><th>Subtotal</th></tr></thead><tbody>" + pricedItemRows(items) +
      "<tr class=\"total\"><td colspan=\"6\">Subtotal anal\u00edtico dos itens</td><td class=\"num\">" + money(analyticSubtotal) + "</td></tr>" +
      "<tr class=\"total\"><td colspan=\"6\">Subtotal oficial dos servi\u00e7os</td><td class=\"num\">" + money(officialSubtotal) + "</td></tr></tbody></table>" +
      "<p>Diverg\u00eancia anal\u00edtica: " + money(Math.abs(divergence)) + " (" + br(divergencePercent, 2) + "%). A soma anal\u00edtica pode divergir do pre\u00e7o total oficial da composi\u00e7\u00e3o por arredondamentos, encargos ou estrutura SINAPI. O subtotal oficial prevalece e n\u00e3o foi substitu\u00eddo.</p></section>";
  }
  function servicesWithValueSection(results) {
    const pricedList = (results || []).filter(priced);
    const total = pricedList.reduce(function (sum, item) { return sum + Number(item.totalCost || 0); }, 0);
    return "<section class=\"financial\"><h2>Servi\u00e7os com valor</h2>" +
      "<table><thead><tr><th>C\u00f3digo</th><th>Servi\u00e7o</th><th>Un.</th><th>Quantidade</th><th>Pre\u00e7o unit\u00e1rio</th><th>Subtotal</th></tr></thead><tbody>" +
      (pricedList.length ? pricedList.map(function (item) { const comp = item.composition || {}; return "<tr><td>" + escapeHtml(comp.code || "-") + "</td><td>" + escapeHtml(serviceName(item.service)) + "</td><td>" + unit(item.unit) + "</td><td class=\"num\">" + quantity(item.quantity) + " " + unit(item.unit) + "</td><td class=\"num\">" + money(item.unitCost) + "</td><td class=\"num\">" + money(item.totalCost) + "</td></tr>"; }).join("") : "<tr><td colspan=\"6\">Nenhum servi\u00e7o com pre\u00e7o confi\u00e1vel.</td></tr>") +
      "<tr class=\"total\"><td colspan=\"5\">Subtotal dos servi\u00e7os analisados</td><td class=\"num\">" + money(total) + "</td></tr></tbody></table>" +
      "<p>Foram usados apenas valores reais da base carregada. BDI e perdas n\u00e3o foram aplicados.</p></section>";
  }
  function materialsUseSection(results) {
    const grouped = allDisplay(results || []);
    return "<section class=\"materials-use\"><h2>Materiais que ser\u00e3o utilizados</h2>" +
      "<table><thead><tr><th>C\u00f3digo</th><th>Material</th><th>Un.</th><th>Consumo t\u00e9cnico</th><th>Compra m\u00ednima</th><th>Observa\u00e7\u00e3o</th></tr></thead><tbody>" + materialUseRows(grouped.materials) + "</tbody></table>" +
      "<h3>Composi\u00e7\u00f5es auxiliares utilizadas</h3><table><thead><tr><th>C\u00f3digo</th><th>Composi\u00e7\u00e3o auxiliar</th><th>Un.</th><th>Consumo t\u00e9cnico</th><th>Observa\u00e7\u00e3o</th></tr></thead><tbody>" + auxiliaryRows(grouped.auxiliary) + "</tbody></table></section>";
  }
  function executiveSummary(results) {
    const list = results || [];
    const total = list.reduce(function (sum, item) { return sum + (priced(item) ? Number(item.totalCost) : 0); }, 0);
    const unpriced = list.filter(function (item) { return !priced(item); }).map(function (item) { return serviceName(item.service); });
    const pendings = [];
    list.forEach(function (item) { (item.pending || []).concat(item.warnings || []).forEach(function (p) { const text = pendingText(p); if (pendings.indexOf(text) < 0) pendings.push(text); }); });
    const reference = baseLabel(list.find(function (item) { return item && item.composition; }) || list[0] || {});
    return "<section class=\"executive\"><h2>Resumo executivo</h2>" +
      "<p><strong>Refer\u00eancia da base:</strong> " + escapeHtml(reference) + "</p>" +
      "<p><strong>Servi\u00e7os analisados:</strong> " + list.length + "</p>" +
      "<p><strong>Subtotal dos servi\u00e7os analisados:</strong> " + money(total) + "</p>" +
      "<p><strong>Servi\u00e7os sem pre\u00e7o:</strong> " + (unpriced.length ? escapeHtml(unpriced.join(", ")) : "nenhum") + ".</p>" +
      "<p><strong>Pend\u00eancias principais:</strong> " + escapeHtml(sentenceJoin(pendings)) + "</p>" +
      "<p>Nenhum pre\u00e7o foi inventado. N\u00e3o foram aplicados BDI, perdas autom\u00e1ticas ou dimensionamento estrutural.</p></section>";
  }
  function technicalAnnex(results) {
    const list = results || [];
    const reference = baseLabel(list.find(function (item) { return item && item.composition; }) || list[0] || {});
    return "<section class=\"technical-annex\"><h2>Anexo t\u00e9cnico</h2><p class=\"base\"><strong>Refer\u00eancia da base:</strong> " + escapeHtml(reference) + "</p></section>" + list.map(section).join("");
  }
  function identificationBlock(identification) {
    const id = identification || {};
    const lines = [];
    if (clean(id.displayName)) lines.push("<strong>" + escapeHtml(id.displayName) + "</strong>");
    if (clean(id.phone)) lines.push("Telefone: " + escapeHtml(id.phone));
    if (clean(id.email)) lines.push("E-mail: " + escapeHtml(id.email));
    return lines.length ? "<div class=\"identity\">" + lines.join("<br>") + "</div>" : "";
  }
  function buildHtmlDocument(results, options) {
    const settings = options || {};
    const list = Array.isArray(results) ? results : [];
    const generatedAt = settings.generatedAt || new Date().toISOString();
    const css = "@page{size:A4;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;color:#172033;font-size:10.5px;line-height:1.32}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:12px 0 6px;break-after:avoid;border-bottom:1px solid #aeb9c9;padding-bottom:4px}h3{font-size:11.5px;margin:9px 0 4px;break-after:avoid}.meta,.identity,.base{color:#4e5d70;margin-bottom:8px}.identity{border:1px solid #ccd5e2;padding:8px}.stage,.executive,.consolidated,.financial,.priced-items,.materials-use{break-inside:auto;margin-bottom:12px}.summary{display:inline-block;border:1px solid #c7d0de;padding:6px 9px;margin:3px 0 6px;background:#f7f9fc}.summary span{display:block;color:#526071;font-size:9.5px}table{width:100%;border-collapse:collapse;table-layout:fixed;margin:4px 0 7px;break-inside:auto}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #d5dce7;padding:3px 4px;vertical-align:top;word-break:break-word}th{background:#eef3f8;text-align:left}.num{text-align:right;white-space:nowrap}.total td{font-weight:700;background:#f1f5f9}ul{margin:3px 0 7px 16px;padding:0}li{margin:1px 0}.grand-total,.footer{border-top:1px solid #aeb9c9;padding-top:7px}.footer{margin-top:12px;color:#687386}";
    return "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Quantitativos t\u00e9cnicos do ELO</title><style>" + css + "</style></head><body>" +
      "<h1>Quantitativos t\u00e9cnicos do ELO</h1>" +
      identificationBlock(settings.identification) +
      "<div class=\"meta\">Or\u00e7amento preliminar e quantitativos t\u00e9cnicos. Gerado em " + escapeHtml(formatDate(generatedAt)) + ".</div>" +
      executiveSummary(list) + servicesWithValueSection(list) + pricedItemsSection(list) + materialsUseSection(list) + technicalAnnex(list) +
      "<div class=\"footer\">Pre\u00e7os exibidos somente quando a base carregada informou valores confi\u00e1veis. Nenhum pre\u00e7o foi inventado. BDI e perdas n\u00e3o foram aplicados. A\u00e7o estrutural, formas, escava\u00e7\u00e3o, impermeabiliza\u00e7\u00e3o e reaterro permanecem fora do escopo quando n\u00e3o fizerem parte da composi\u00e7\u00e3o selecionada.</div>" +
      "</body></html>";
  }

  root.EloTechnicalServicePdf = { version: VERSION, buildHtmlDocument: buildHtmlDocument };
})(typeof window !== "undefined" ? window : globalThis);
