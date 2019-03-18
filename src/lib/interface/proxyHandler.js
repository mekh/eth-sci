'use strict';
const { PromiEvent } = require('web3-core-promievent');
const _ = require('lodash');
const { returnValue } = require('../utils');

const proxyHandler = (obj, prop) => {
    if (!obj.proxyMethods.includes(prop) || prop in obj) return obj[prop];

    let isEvent = obj._events.includes(prop);

    if (isEvent) {
        const event = prop.split(/^on/)[1];
        obj[prop] = function proxyAddEvent(...args) {
            let options = {};
            const callback = args[args.length - 1];
            if (_.isPlainObject(args[0])) options = args[0];
            return obj._subscribe(options, event, callback);
        };

        return obj[prop];
    }

    obj[prop] = function proxyAddProp(...args) {
        let path = 'contract.methods';
        const defer = new PromiEvent();

        const callback = _.isFunction(_.last(args)) ? args.pop() : null;

        let retryOptions;
        let idx = args.findIndex(item => item.retryOptions);

        if (idx !== -1) retryOptions = args.splice(idx, 1)[0].retryOptions;

        if (prop === '_deploy') {
            path = 'contract';
            prop = 'deploy';
        }

        const send = meta => {
            if (!retryOptions) {
                obj.txManager.submitTx(obj, meta, defer, path).then(([err, res]) => {
                    returnValue(err, res, defer, callback);
                });
            } else {
                obj.sendWithRetry(meta, retryOptions, defer).then(([err, res]) => {
                    returnValue(err, res, defer, callback);
                });
            }
        };

        obj.txManager.getTxMeta(obj, prop, ...args).then(send);
        return defer;
    };

    return obj[prop];
};

module.exports = proxyHandler;
