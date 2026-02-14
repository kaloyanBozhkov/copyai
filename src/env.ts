/** Load first so third-party libs see these at import time. */
const ENV_DEFAULTS: Record<string, string> = {
  OPEN_AI_API_KEY: "-",
  OPENROUTER_API_KEY: "-",
};
for (const [k, v] of Object.entries(ENV_DEFAULTS)) {
  if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
}
