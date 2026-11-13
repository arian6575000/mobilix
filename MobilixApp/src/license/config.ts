// ====== PER-APP LICENSE SETTINGS ======
// PROJECT_CODE: same code as in the License Generator "Projects" list.
// PUBLIC_KEY_HEX: the Ed25519 PUBLIC key (64 hex chars) of the "mobilix" project. Never put a private key here.
//   Get it from the License Generator app: Projects > add "mobilix" > Keys, then paste the public key below
//   (or run `node tools/make-project.mjs` on your own computer; it writes it for you).
export const PROJECT_CODE = "mobilix";
export const PUBLIC_KEY_HEX = "";
// =======================================
// DEVICE_PREFIX: app name at the start of the Device ID ("Mobilix-87A9-F285-E2DF"); unique per app so licenses never cross apps.
export const DEVICE_PREFIX = "Mobilix";
// New app: there are no old-format licenses to accept.
export const ACCEPT_LEGACY_DEVICE_ID = false;
export const KEY_CONFIGURED = /^[0-9a-fA-F]{64}$/.test(PUBLIC_KEY_HEX);
