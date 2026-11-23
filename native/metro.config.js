const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = import.meta.dirname
const libSrc = path.join(projectRoot, '..', 'lib', 'src')
const fixturesDir = path.join(projectRoot, '..', 'fixtures')
const harnessNodeModules = path.join(projectRoot, 'node_modules')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [libSrc, fixturesDir]
config.resolver.unstable_enablePackageExports = true

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
  const isReactSingletonRequest =
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    moduleName === 'react-native' ||
    moduleName.startsWith('react-native/')
  if (isReactSingletonRequest) {
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
