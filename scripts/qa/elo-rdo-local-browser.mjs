import fs from "node:fs";import path from "node:path";import os from "node:os";
export function installedChromium(chromium){
 const explicit=process.env.ELO_QA_CHROMIUM_EXECUTABLE;
 if(explicit){if(!fs.existsSync(explicit))throw Error("Configured QA Chromium executable missing");return explicit;}
 const expected=chromium.executablePath();if(fs.existsSync(expected))return expected;
 const base=path.join(os.homedir(),"AppData","Local","ms-playwright");
 if(fs.existsSync(base)){const versions=fs.readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort((a,b)=>Number(b.split("-")[1])-Number(a.split("-")[1]));for(const name of versions){const candidate=path.join(base,name,"chrome-win64","chrome.exe");if(fs.existsSync(candidate))return candidate;}}
 throw Error("No installed Chromium found; no browser download performed");
}

