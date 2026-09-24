// Metro (Expo's bundler) only watches/resolves inside its own project root by
// default. shared/ lives one level up, outside mobile/, so we need to point
// Metro at the monorepo root explicitly — otherwise imports from
// "@movie-manager/shared" fail to resolve, and even if they did, editing a
// file in shared/ wouldn't trigger a live-reload.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch shared/ (and the rest of the monorepo) for changes, not just mobile/.
config.watchFolders = [workspaceRoot];

// npm workspaces hoist "@movie-manager/shared" into the root node_modules,
// not mobile/node_modules, so Metro needs to know to look there too.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Resolve using exactly the two paths above, in that order, instead of
// Metro's default upward directory crawl — avoids accidentally picking up a
// stray duplicate dependency from somewhere else on disk.
config.resolver.disableHierarchicalLookup = true;

// npm workspaces link workspace packages via filesystem links (junctions on
// Windows). Metro needs this on to follow them correctly.
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
