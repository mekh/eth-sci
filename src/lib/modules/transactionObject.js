'use strict';

class TransactionObject {
    constructor(txMeta) {
        const { id } = txMeta;
        if (id && TransactionObject._ids && TransactionObject._ids[id])
            return TransactionObject._ids[id]; // don't create a new instance, return an existing one instead

        if (!TransactionObject._ids) TransactionObject._ids = {};
        Object.keys(txMeta).forEach(key => (this[key] = txMeta[key]));

        if (id) TransactionObject._ids[id] = this;
    }
}

module.exports = TransactionObject;
