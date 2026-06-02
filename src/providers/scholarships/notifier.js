'use strict';

const { BaseNotifier } = require('../../plugins/base');
const { formatNotification } = require('../../services/notifier/template');

class ScholarshipNotifier extends BaseNotifier {
  constructor(config = {}) {
    super(config);
    this.provider = null;
  }

  setProvider(provider) {
    this.provider = provider;
  }

  format(data) {
    return formatNotification(data);
  }
}

module.exports = { ScholarshipNotifier };
