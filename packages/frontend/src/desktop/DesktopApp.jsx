import { boot } from './session';
import Shell from './Shell';
import { useLang } from '../shared/i18n';

boot();

export default function DesktopApp() {
  // Rebuild the whole page when the language changes so nothing keeps the old words.
  const lang = useLang();
  return <Shell key={lang} />;
}
