import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default adapter config: no incremental cache, no queue. Every page render is
// either static (served from the asset host) or computed per request.
//
// If ISR is ever wanted, this is where an R2/KV cache gets plugged in — see
// https://opennext.js.org/cloudflare/caching. Leaving it out keeps the deploy
// to two bindings and zero extra moving parts.
export default defineCloudflareConfig();
