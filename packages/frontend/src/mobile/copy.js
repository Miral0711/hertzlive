// The translation engine lives in shared/i18n.js so the phone prototype, the website chat and the app
// all use the same one. This file stays so existing imports keep working.
export { t, getLang, setLang, useLang, LANGS } from '../shared/i18n';
