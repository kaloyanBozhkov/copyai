// third party packages require this at run time
const ENV_DEFAULTS: Record<string, string> = {
    OPEN_AI_API_KEY: "-",
    OPENROUTER_API_KEY: "-",
};

for (const [k, v] of Object.entries(ENV_DEFAULTS)) {
    process.env[k] = v;
}

// load custom keys added via grimoire and override .env
import { applyApiKeysToEnv } from "./kitchen/grimoireSettings";
applyApiKeysToEnv();