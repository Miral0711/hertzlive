// One import point for the web prototype's store/model code (shared with packages/frontend).
export * from '../../frontend/src/mobile/model';
export { useStore } from '../../frontend/src/shared/store';
export { t } from '../../frontend/src/mobile/copy';
export { ICONS } from '../../frontend/src/shared/icons';
// Everything else exported by the shared core (hh, inr, AIProvider, svc helpers...): core.hh(...)
export * as core from '../../frontend/src/shared/core';
