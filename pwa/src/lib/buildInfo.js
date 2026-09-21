/* global __APP_BUILD__ */
/**
 * Which build of the app is running: the git commit and the build time, filled
 * in by vite.config.js. Shown in the menu and in a result's technical details,
 * so it is always possible to tell which version a phone is really running.
 */
export const BUILD = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'local dev';
