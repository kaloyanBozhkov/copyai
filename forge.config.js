const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    prune: true,
    icon: "./src/assets/copyai-logo",
    extraResource: ["./src/assets/copyai-logo.png"],
    // Exclude unnecessary files from the build
    ignore: [
      /^\/\.pnpm-store/,
      /^\/\.git/,
      /^\/\.vscode/,
      /^\/out/,
      /^\/scripts/,
      /^\/\.env/,
      /^\/\.DS_Store/,
      /\.md$/,
      /\.map$/,
      // Dev dependencies that shouldn't be bundled
      /node_modules\/electron($|\/)/,
      /node_modules\/electron-winstaller/,
      /node_modules\/@electron-forge/,
      /node_modules\/typescript($|\/)/,
      /node_modules\/eslint/,
      /node_modules\/@typescript-eslint/,
      /node_modules\/prettier/,
      /node_modules\/@eslint/,
      /node_modules\/vitest/,
      /node_modules\/electronmon/,
      /node_modules\/concurrently/,
      // Source files (we only need dist)
      /^\/src\/app\/src/,
      /^\/src\/.*\.ts$/,
    ],
    // macOS Local Network permission - required for LG TV connection
    extendInfo: {
      NSLocalNetworkUsageDescription: "CopyAI needs local network access to control your LG TV and other smart devices.",
      NSBonjourServices: [
        "_webos._tcp",
        "_lgtv._tcp", 
        "_http._tcp"
      ]
    }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    // DMG maker disabled due to pnpm native module issues
    // {
    //   name: '@electron-forge/maker-dmg',
    //   platforms: ['darwin'],
    //   config: (arch) => ({
    //     icon: './src/assets/copyai-logo.icns',
    //     format: 'ULFO',
    //     contents: [
    //       { x: 130, y: 150, type: 'file', path: `${process.cwd()}/out/copyai-darwin-${arch}/copyai.app` },
    //       { x: 410, y: 150, type: 'link', path: '/Applications' }
    //     ],
    //     additionalDMGOptions: {
    //       window: {
    //         size: { width: 540, height: 340 }
    //       }
    //     }
    //   }),
    // },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
