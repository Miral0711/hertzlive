import { boot } from './session';
import Shell from './Shell';

boot();

export default function DesktopApp() {
  return <Shell />;
}
