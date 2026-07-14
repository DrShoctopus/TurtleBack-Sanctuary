/* Turtleback-authored security relay for Three's locally assembled Basis worker. */
;(function installBasisBootstrap() {
  'use strict'

  const bootstrapType = 'turtleback:basis-worker-bootstrap'
  const nativePostMessage = self.postMessage.bind(self)
  let terminalFailure = null
  let pendingTranscodes = 0

  self.postMessage = function trackedPostMessage(message, transfer) {
    if (pendingTranscodes > 0 && (message?.type === 'transcode' || message?.type === 'error')) {
      pendingTranscodes -= 1
    }
    if (arguments.length > 1) return nativePostMessage(message, transfer)
    return nativePostMessage(message)
  }

  function postTerminalFailure() {
    self.postMessage({
      type: 'error',
      error: terminalFailure,
      data: { faces: [], width: 0, height: 0, format: 0, type: 0, dfdFlags: 0 },
    })
  }

  function recordTerminalFailure(reason) {
    if (terminalFailure !== null) return
    terminalFailure = `Basis worker initialization failed: ${String(reason)}`
    if (pendingTranscodes > 0) postTerminalFailure()
  }

  function guardTranscode(event) {
    if (!event.data || event.data.type !== 'transcode') return
    pendingTranscodes += 1
    if (terminalFailure === null) return
    event.stopImmediatePropagation()
    postTerminalFailure()
  }

  function bootstrap(event) {
    try {
      const message = event.data
      if (!message || message.type !== bootstrapType || typeof message.sourceUrl !== 'string') {
        throw new Error('Basis worker received an invalid bootstrap message')
      }
      if (!message.sourceUrl.startsWith('blob:')) {
        throw new Error('Basis worker accepts only a local blob source')
      }

      self.removeEventListener('message', bootstrap)
      importScripts(message.sourceUrl)
    } catch (error) {
      self.removeEventListener('message', bootstrap)
      recordTerminalFailure(error)
    }
  }

  self.addEventListener('message', guardTranscode)
  self.addEventListener('message', bootstrap)
  self.addEventListener('error', function handleWorkerError(event) {
    recordTerminalFailure(event.error ?? event.message ?? 'unknown worker error')
    event.preventDefault()
  })
  self.addEventListener('unhandledrejection', function handleWorkerRejection(event) {
    recordTerminalFailure(event.reason)
    event.preventDefault()
  })
})()
