const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Reuse the web app's seed data (packages/frontend/src/shared) instead of copying it.
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '../frontend/src/shared')];

module.exports = config;
