module.exports = class StreamError extends Error {
  constructor(msg, code, fn = StreamError) {
    super(msg)

    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  static isStreamDestroyed(err) {
    return err && err.code === 'STREAM_DESTROYED'
  }

  static isPrematureClose(err) {
    return err && err.code === 'PREMATURE_CLOSE'
  }

  static isAborted(err) {
    return err && err.code === 'ABORTED'
  }

  get name() {
    return 'StreamError'
  }

  static STREAM_DESTROYED() {
    return new StreamError('Stream was destroyed', 'STREAM_DESTROYED', StreamError.STREAM_DESTROYED)
  }

  static PREMATURE_CLOSE() {
    return new StreamError('Premature close', 'PREMATURE_CLOSE', StreamError.PREMATURE_CLOSE)
  }

  static ABORTED() {
    return new StreamError('Stream aborted', 'ABORTED', StreamError.ABORTED)
  }
}
