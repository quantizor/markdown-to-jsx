const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = import.meta.dirname
const libSrc = path.join(projectRoot, '..', 'lib', 'src')
const fixturesDir = path.join(projectRoot, '..', 'fixtures')
const harnessNodeModules = path.join(projectRoot, 'node_modules')

const config = getDefaultConfig(projectRoot)

// Watch the library source and shared fixtures so edits hot-reload in the
// simulator without a rebuild/reinstall cycle. Requires Watchman: without it
// Metro never picks up external watchFolder edits. `brew install watchman`,
// then restart Metro once.
config.watchFolders = [libSrc, fixturesDir]
config.resolver.unstable_enablePackageExports = true

// Resolve the two library specifiers the harness reaches to their TypeScript
// source instead of the installed dist build. Every other import inside the
// library source is relative, so these two entries cover the whole tree.
const sourceEntries = {
  'markdown-to-jsx/entities': path.join(libSrc, 'entities.generated.ts'),
  'markdown-to-jsx/native': path.join(libSrc, 'native.tsx'),
}

const defaultResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const sourceEntry = sourceEntries[moduleName]
  if (sourceEntry) {
    return { type: 'sourceFile', filePath: sourceEntry }
  }
  // The library source lives outside this project and carries its own
  // react/react-native copies. Force those (and their subpaths) to the harness
  // node_modules so exactly one React and one React Native instance bundles.
  if (
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    moduleName === 'react-native' ||
    moduleName.startsWith('react-native/')
  ) {
    return (defaultResolveRequest || context.resolveRequest)(
      {
        ...context,
        originModulePath: path.join(harnessNodeModules, 'index.js'),
      },
      moduleName,
      platform
    )
  }
  return (defaultResolveRequest || context.resolveRequest)(
    context,
    moduleName,
    platform
  )
}

module.exports = config
