(function (window) {
  "use strict";

  const core = window.StockFullCore || {};
  const stock = window.StockFullStock || {};
  const clean = core.clean || function (value) { return String(value || "").trim(); };
  const parseNumber = core.parseNumber || function (value) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; };

  function getBalanceQuantity(balance) {
    return parseNumber(balance && balance.balance);
  }

  function getItemCost(item) {
    return parseNumber(item && (item.costPrice || item.averageCost || item.unitCost));
  }

  function buildSecondaryMetrics(data, activity) {
    const balances = data.balances || [];
    const itemsInStock = balances.filter(function (balance) {
      return getBalanceQuantity(balance) > 0;
    }).length;
    const alertItems = balances.filter(function (balance) {
      const quantity = getBalanceQuantity(balance);
      const minimum = parseNumber(balance.item && balance.item.minimumStock);
      return quantity <= 0 || (minimum > 0 && quantity <= minimum);
    }).length;
    const today = new Date();
    const stalledItems = balances.filter(function (balance) {
      const lastExit = clean(balance.lastExitDate || balance.item && balance.item.lastExitDate);
      if (!lastExit) return getBalanceQuantity(balance) > 0;
      const age = Math.floor((today.getTime() - new Date(lastExit).getTime()) / 86400000);
      return age >= 60 && getBalanceQuantity(balance) > 0;
    }).length;
    return [
      { label: "Produtos com saldo", value: String(itemsInStock), detail: "Itens reais disponíveis para venda ou uso." },
      { label: "Alertas de reposição", value: String(alertItems), detail: "Produtos zerados ou abaixo do mínimo cadastrado." },
      { label: "Produtos parados", value: String(stalledItems), detail: "Itens com saldo e sem saída recente registrada." },
      { label: "Movimento hoje", value: String((activity.todayEntries || 0) + (activity.todayExits || 0)), detail: "Entradas e saídas registradas hoje." }
    ];
  }

  function buildCategoryMetrics(data) {
    const groups = {};
    (data.balances || []).forEach(function (balance) {
      const item = balance.item || {};
      const category = clean(item.category) || "Sem categoria";
      const key = category.toLowerCase();
      const quantity = Math.max(0, getBalanceQuantity(balance));
      const value = quantity * getItemCost(item);
      if (!groups[key]) groups[key] = { label: category, count: 0, quantity: 0, value: 0 };
      groups[key].count += 1;
      groups[key].quantity += quantity;
      groups[key].value += value;
    });
    return Object.keys(groups).map(function (key) { return groups[key]; }).sort(function (a, b) {
      return b.count - a.count || clean(a.label).localeCompare(clean(b.label));
    });
  }

  function buildRecommendations(data, todayManualEntries, todayExits, todayInitialStock, todayCsvImports) {
    const balances = data.balances || [];
    const alerts = balances.filter(function (balance) {
      const quantity = getBalanceQuantity(balance);
      const minimum = parseNumber(balance.item && balance.item.minimumStock);
      return quantity <= 0 || (minimum > 0 && quantity <= minimum);
    }).length;
    const messages = [];
    if (!balances.length) {
      messages.push({ label: "Cadastro", text: "Cadastre seus primeiros produtos para gerar análises." });
      return messages;
    }
    if (alerts) {
      messages.push({ label: "Comprar", text: alerts + " produto(s) precisam de decisão de reposição com base no saldo real." });
    }
    if (!todayManualEntries.length && !todayExits.length && !todayInitialStock.length && !todayCsvImports.length) {
      messages.push({ label: "Hoje", text: "Nenhuma movimentação registrada hoje. Se houve venda ou recebimento, atualize o estoque." });
    }
    if (todayExits.length) {
      messages.push({ label: "Saídas", text: todayExits.length + " saída(s) registradas hoje. Confira produtos próximos do mínimo." });
    }
    messages.push({ label: "Auditoria", text: "Use o histórico real para revisar entradas, saídas, responsáveis e documentos." });
    return messages;
  }

  function buildViewModel(input) {
    const dashboard = input.dashboard || {};
    const data = input.data || dashboard.data || {};
    const todayMovements = input.todayMovements || [];
    const todayManualEntries = input.todayManualEntries || todayMovements.filter(stock.isManualEntry || function () { return false; });
    const todayInitialStock = input.todayInitialStock || todayMovements.filter(stock.isInitialStock || function () { return false; });
    const todayCsvImports = input.todayCsvImports || todayMovements.filter(stock.isCsvImport || function () { return false; });
    const todayExits = input.todayExits || todayMovements.filter(function (movement) { return movement.type === "saida"; });
    const totalBalance = (data.balances || []).reduce(function (sum, balance) {
      return sum + Math.max(0, parseNumber(balance.balance));
    }, 0);
    const periodExitQuantity = (dashboard.periodExits || []).reduce(function (sum, movement) {
      return sum + Math.max(0, parseNumber(movement.quantity));
    }, 0);
    return {
      dashboard,
      data,
      totalBalance,
      periodExitQuantity,
      secondary: buildSecondaryMetrics(data, {
        todayEntries: todayManualEntries.length + todayInitialStock.length + todayCsvImports.length,
        todayExits: todayExits.length
      }),
      categories: buildCategoryMetrics(data),
      recommendations: buildRecommendations(data, todayManualEntries, todayExits, todayInitialStock, todayCsvImports)
    };
  }

  window.StockFullDashboard = {
    getBalanceQuantity,
    getItemCost,
    buildSecondaryMetrics,
    buildCategoryMetrics,
    buildRecommendations,
    buildViewModel
  };
})(window);
