(function () {
  "use strict";

  const unlimited = null;
  const plans = {
    gratuito: {
      id: "gratuito",
      name: "Gratuito",
      priceLabel: "R$ 0/mês",
      cta: "Plano atual",
      limits: {
        clients: 2,
        works: 2,
        reportsPerMonth: 5,
        photosPerReport: 10,
        aiCallsPerMonth: 10
      },
      features: [
        "Até 2 clientes",
        "Até 2 obras",
        "Até 5 relatórios por mês",
        "Até 10 fotos por relatório",
        "IA limitada",
        "PDF com marca d'água"
      ],
      pdfWatermark: true,
      companyLogo: false
    },
    profissional: {
      id: "profissional",
      name: "Profissional",
      priceLabel: "R$ 49,90/mês",
      cta: "Simular Profissional",
      limits: {
        clients: unlimited,
        works: unlimited,
        reportsPerMonth: 100,
        photosPerReport: 50,
        aiCallsPerMonth: unlimited
      },
      features: [
        "Clientes ilimitados",
        "Obras ilimitadas",
        "Até 100 relatórios por mês",
        "Até 50 fotos por relatório",
        "IA liberada",
        "PDF sem marca d'água",
        "Logo da empresa no PDF"
      ],
      pdfWatermark: false,
      companyLogo: true
    },
    empresa: {
      id: "empresa",
      name: "Empresa",
      priceLabel: "R$ 149,90/mês",
      cta: "Simular Empresa",
      limits: {
        clients: unlimited,
        works: unlimited,
        reportsPerMonth: unlimited,
        photosPerReport: unlimited,
        aiCallsPerMonth: unlimited
      },
      features: [
        "Estrutura preparada para equipes",
        "Relatórios ilimitados",
        "Múltiplos usuários futuramente",
        "IA liberada",
        "Base para gestão empresarial"
      ],
      pdfWatermark: false,
      companyLogo: true,
      future: true
    }
  };

  function listPlans() {
    return [plans.gratuito, plans.profissional, plans.empresa];
  }

  function getPlan(planId) {
    return plans[planId] || plans.gratuito;
  }

  function formatLimit(value) {
    return value === null ? "Ilimitado" : String(value);
  }

  window.ObraReportPlans = {
    defaultPlanId: "gratuito",
    plans: plans,
    listPlans: listPlans,
    getPlan: getPlan,
    formatLimit: formatLimit
  };
})();
