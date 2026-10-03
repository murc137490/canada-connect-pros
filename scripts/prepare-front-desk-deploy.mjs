import fs from "fs";

const phone = fs.readFileSync("supabase/functions/_shared/phoneE164.ts", "utf8");
const fd = fs.readFileSync("supabase/functions/_shared/frontDeskRealtime.ts", "utf8");

function flat(p) {
  return fs
    .readFileSync(p, "utf8")
    .replaceAll('from "../_shared/phoneE164.ts"', 'from "./phoneE164.ts"')
    .replaceAll('from "../_shared/frontDeskRealtime.ts"', 'from "./frontDeskRealtime.ts"');
}

const tools = {
  project_id: "hptzapnrnbqlptrstjxo",
  name: "front-desk-tools",
  entrypoint_path: "index.ts",
  verify_jwt: false,
  files: [
    { name: "index.ts", content: flat("supabase/functions/front-desk-tools/index.ts") },
    { name: "phoneE164.ts", content: phone },
  ],
};

const sess = {
  project_id: "hptzapnrnbqlptrstjxo",
  name: "front-desk-session",
  entrypoint_path: "index.ts",
  verify_jwt: false,
  files: [
    { name: "index.ts", content: flat("supabase/functions/front-desk-session/index.ts") },
    { name: "frontDeskRealtime.ts", content: fd },
  ],
};

fs.writeFileSync("tmp-legal/mcp-deploy-front-desk-tools.json", JSON.stringify(tools));
fs.writeFileSync("tmp-legal/mcp-deploy-front-desk-session.json", JSON.stringify(sess));
console.log("ok", tools.files[0].content.length, sess.files[0].content.length);
