import fs from "fs";

const phone = fs.readFileSync("supabase/functions/_shared/phoneE164.ts", "utf8");
const telnyx = fs.readFileSync("supabase/functions/_shared/telnyxSms.ts", "utf8");
const templates = fs.readFileSync("supabase/functions/_shared/bookingSmsTemplates.ts", "utf8");

function flatten(srcPath) {
  let s = fs.readFileSync(srcPath, "utf8");
  s = s.replaceAll('from "../_shared/phoneE164.ts"', 'from "./phoneE164.ts"');
  s = s.replaceAll('from "../_shared/telnyxSms.ts"', 'from "./telnyxSms.ts"');
  s = s.replaceAll('from "../_shared/bookingSmsTemplates.ts"', 'from "./bookingSmsTemplates.ts"');
  return s;
}

fs.writeFileSync(
  "tmp-legal/deploy-booking-sms-notify.json",
  JSON.stringify({
    index: flatten("supabase/functions/booking-sms-notify/index.ts"),
    phone,
    telnyx,
    templates,
  }),
);
fs.writeFileSync(
  "tmp-legal/deploy-booking-sms-reminders.json",
  JSON.stringify({ index: fs.readFileSync("supabase/functions/booking-sms-reminders/index.ts", "utf8") }),
);
console.log("prepared deploy payloads");
