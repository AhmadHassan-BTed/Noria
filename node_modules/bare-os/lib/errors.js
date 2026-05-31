module.exports = class OSError extends Error {
  constructor(msg, fn = OSError, code = fn.name) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name() {
    return 'OSError'
  }

  static UNKNOWN_SIGNAL(msg) {
    return new OSError(msg, OSError.UNKNOWN_SIGNAL)
  }

  static TITLE_OVERFLOW(msg) {
    return new OSError(msg, OSError.TITLE_OVERFLOW)
  }
}
