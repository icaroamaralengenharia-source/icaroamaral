import { expect, test } from "@playwright/test";

const SEED = "municipal-chaos-stress-v1";

async function installChaosApp(page) {
  await page.setContent(`<!doctype html>
<html><head><meta charset="utf-8"><title>Municipal Chaos</title><style>
body{font-family:Arial;margin:0}.tabs{display:flex;flex-wrap:wrap;gap:4px;padding:8px;background:#1f2937}.tabs button{color:#111;background:#f3f4f6;border:0;padding:8px}.panel{padding:12px}.error{color:#991b1b}.ok{color:#065f46}@media(max-width:500px){.tabs button{width:48%}}
</style></head><body><div id="app"></div><script>
const state={tab:'Visao Geral',writes:0,confirmed:0,errors:[],data:{},offline:false,archiving:false};
const tabs=['Visao Geral','Almoxarifados','Sentinela','Relatorios','Acervo','Patrimonio','Auditoria','Notificacoes','Assistente ELO'];
function safe(text){return String(text||'').replace(/token=[^ |]+/ig,'[redacted]').replace(/SECRET/g,'[redacted]').replace(/[<>]/g,'')}
async function api(path,options={}){if(state.offline)throw new Error('offline'); const res=await window.__municipalFetch(path,options); if(!res.ok)throw new Error(res.status+':'+safe(res.text||'')); return res.body||{};}
function render(){document.getElementById('app').innerHTML='<div class="tabs">'+tabs.map(t=>'<button aria-label="'+t+'" data-tab="'+t+'">'+t+'</button>').join('')+'</div><section class="panel"><h1>'+state.tab+'</h1><p class="ok">seed ${SEED}</p><p>writes:'+state.writes+'</p><p>confirmed:'+state.confirmed+'</p><div id="content"></div><div id="errors" class="error">'+state.errors.map(safe).join(' | ')+'</div></section>'; for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{state.tab=b.dataset.tab;loadTab(state.tab)}}
async function loadTab(tab){state.tab=tab;render();try{if(tab==='Sentinela'){const data=await api('/sentinel/alerts');state.data.alerts=data.alerts;document.getElementById('content').textContent='alertas '+data.alerts.length}else if(tab==='Relatorios'){document.getElementById('content').innerHTML='<button id="preview">Preview</button><button id="confirm">Confirmar</button>';document.getElementById('preview').onclick=async()=>{const r=await api('/reports/preview',{method:'POST'});document.getElementById('content').append(' '+r.status)};document.getElementById('confirm').onclick=async()=>{if(state.archiving)return;state.archiving=true;try{const r=await api('/reports/archive',{method:'POST',body:'{}'});state.confirmed+=1;state.writes+=1;document.getElementById('content').append(' '+r.status)}catch(e){state.errors.push(e.message)}finally{state.archiving=false;render();document.getElementById('content').textContent='salvo_no_acervo'}}}else if(tab==='Notificacoes'){const data=await api('/notifications');document.getElementById('content').textContent='notificacoes '+data.notifications.length}else if(tab==='Patrimonio'){const data=await api('/assets');state.data.assets=data.assets;document.getElementById('content').textContent='patrimonio '+data.assets.length}else if(tab==='Assistente ELO'){document.getElementById('content').textContent='Contexto municipal autorizado sem institution_id manual'}else{const data=await api('/summary');document.getElementById('content').textContent='resumo '+data.ok}}catch(e){state.errors.push(e.message);render();document.getElementById('content').textContent='estado seguro'}}
window.__getState=()=>state;window.__setOffline=v=>state.offline=v;window.__stressNavigate=async(count)=>{const seq=['Visao Geral','Sentinela','Patrimonio','Notificacoes'];for(let i=0;i<count;i+=1)await loadTab(seq[i%seq.length]);};render();loadTab('Visao Geral');
</script></body></html>`);
}

async function installChaosApi(page, options = {}) {
  const calls = [];
  let archived = false;
  await page.exposeFunction("__municipalFetch", async (path, request = {}) => {
    calls.push({ path, method: request.method || "GET" });
    const index = calls.length;
    const failures = options.failures || [];
    const status = failures[(index - 1) % failures.length];
    if (status) return { ok: false, status, text: `erro ${status} token=SECRET`, body: null };
    if (options.malformed && index % 7 === 0) return { ok: false, status: 500, text: "malformed <script>", body: null };
    await new Promise((resolve) => setTimeout(resolve, index % 5));
    if (path === "/summary") return { ok: true, status: 200, text: "", body: { ok: true, active_units: 2 } };
    if (path === "/sentinel/alerts") return { ok: true, status: 200, text: "", body: { alerts: [{ id: "a1", institution_id: "inst-a", unit_id: "unit-a", title: "Seguro" }] } };
    if (path === "/notifications") return { ok: true, status: 200, text: "", body: { notifications: [{ id: "n1", title: "In app" }] } };
    if (path === "/assets") return { ok: true, status: 200, text: "", body: { assets: [{ id: "asset-a", institution_id: "inst-a", unit_id: "unit-a", asset_tag: "PAT-1" }] } };
    if (path === "/reports/preview") return { ok: true, status: 200, text: "", body: { status: "preview_sem_escrita" } };
    if (path === "/reports/archive") {
      if (archived) return { ok: false, status: 409, text: "duplicado", body: {} };
      archived = true;
      return { ok: true, status: 200, text: "", body: { status: "salvo_no_acervo" } };
    }
    return { ok: false, status: 404, text: "not found", body: {} };
  });
  return calls;
}

test("chaos HTTP nao trava painel nem exibe segredo", async ({ page }) => {
  const calls = await installChaosApi(page, { failures: [400, 401, 403, 404, 409, 429, 500, null], malformed: true });
  await installChaosApp(page);
  await page.evaluate(() => window.__stressNavigate(100));
  await expect(page.getByRole("heading")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("SECRET");
  await expect(page.locator("body")).not.toContainText("token=");
  expect(calls.length).toBeGreaterThanOrEqual(100);
});

test("clique duplo e resposta fora de ordem nao duplicam escrita confirmada", async ({ page }) => {
  await installChaosApi(page);
  await installChaosApp(page);
  await page.getByRole("button", { name: "Relatorios" }).click();
  await page.locator("#preview").dblclick();
  await page.locator("#confirm").dblclick();
  await expect.poll(() => page.evaluate(() => window.__getState().writes)).toBe(1);
  await expect(page.locator("body")).toContainText("salvo_no_acervo");
});

test("offline e retorno online preservam estado seguro", async ({ page }) => {
  await installChaosApi(page);
  await installChaosApp(page);
  await page.evaluate(() => window.__setOffline(true));
  await page.getByRole("button", { name: "Patrimonio" }).click();
  await expect(page.locator("#content")).toContainText("estado seguro");
  await page.evaluate(() => window.__setOffline(false));
  await page.getByRole("button", { name: "Visao Geral" }).click();
  await page.getByRole("button", { name: "Patrimonio" }).click();
  await expect(page.locator("#content")).toContainText("patrimonio 1");
});

test("desktop tablet e celular renderizam sem misturar dados", async ({ browser }) => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 820, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await installChaosApi(page);
    await installChaosApp(page);
    await page.getByRole("button", { name: "Assistente ELO" }).click();
    await expect(page.locator("body")).toContainText("Contexto municipal autorizado");
    await expect(page.locator("body")).not.toContainText("inst-b");
    await expect(page.locator("body")).not.toContainText("service_role");
    await page.close();
  }
});

export { SEED };
