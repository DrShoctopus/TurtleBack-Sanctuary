/** The renderer, main process, and preload are fully bundled before packaging. */
module.exports = async function skipDesktopDependencies() {
  return false
}
