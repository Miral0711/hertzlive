import * as home from './pages/home';
import * as chat from './pages/chat';
import * as projects from './pages/projects';
import * as sites from './pages/sites';
import * as studio from './pages/studio';
import * as money from './pages/money';
import * as resources from './pages/resources';

// Each feature module exports `pages` ({ routeName: Component }) and `dialogs` ({ kind: Component }).
const modules = [home, chat, projects, sites, studio, money, resources];
export const PAGES = Object.assign({}, ...modules.map((m) => m.pages || {}));
export const DIALOGS = Object.assign({}, ...modules.map((m) => m.dialogs || {}));
