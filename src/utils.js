'use strict';
const solc = require('solc');
const Web3 = require('web3');

const compile = async (source, callback) => {
    const input  = {
        language: 'Solidity',
        sources: {
            'contract': {
                content: source
            }
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': [ '*' ]
                }
            }
        }
    };

    const compiled = await solc.compile(JSON.stringify(input));
    const {errors, contracts} = JSON.parse(compiled);
    if(errors && errors.length) {
        return returnValue('\n' + errors.map(e => e.formattedMessage + '\n'), null, callback)
    }

    const result = {};
    for (let item in contracts.contract) {
        const path = contracts.contract[item];
        const bytecode = path['evm']['bytecode']['object'];
        result[item] = {abi: path.abi, bytecode: "0x" + bytecode};
    }

    return returnValue(null, result, callback);
};


const returnValue = (err, result, defer, callback) => {
    const args = [err, result, defer, callback];
    if (typeof args[args.length - 1] === 'function') {
        callback(err, result);
    } else if(typeof args[args.length - 2] === 'function') {
        callback = defer;
        callback(err, result);
        defer = null;
    }

    if(err && defer) {
        if(callback || defer.eventEmitter.listeners('error').length) {
            // suppress uncaught error if an error listener is present
            // OR suppress uncaught error if a callback function is present
            defer.eventEmitter.catch(function(){});
            defer.eventEmitter.removeAllListeners();
        }
        setTimeout(function () {
            defer.reject(err);
            } , 1
        );
        return defer.eventEmitter;
    }
    else if (err && typeof callback !== 'function' && (!defer || !defer.eventEmitter.listeners('error').length)) throw err;

    else if (defer) defer.resolve(result);

    else return result
};


function FixedLengthArray(lengthLimit, unique=false) {
    let array = [];

    array.has = function() {
        const args = [].slice.call(arguments);
        return [].includes.apply(this, args)
    };

    array.add = function() {
        let args = [].slice.call(arguments);
        args = Array.from(new Set(args.filter(item => !this.includes(item))));
        this._truncate(...args);
        return [].push.apply(this, args);
    };

    array.push = function () {
        let args = [].slice.call(arguments);
        if(unique) return this.add(...args);

        this._truncate(...args);
        return [].push.apply(this, args);
    };

    array._truncate = function() {
        const args = [].slice.call(arguments);
        if (lengthLimit && this.length >= lengthLimit && args.length > 0) {
            args.forEach(x => this.shift());
        }

        return this;
    };

    return array;
}


const toChecksum = (address) => {
    return Web3.utils.toChecksumAddress(address)
};


const toWei = (amount, unit) => {
    return Web3.utils.toWei(amount.toString(), unit);
};


const fromWei = (amount, unit) => {
    return Web3.utils.fromWei(amount.toString(), unit);
};


function _to (promise) {
    return promise
        .then(data => [null, data])
        .catch(err => [err, null]);
}

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports = {
    compile, returnValue, FixedLengthArray, toChecksum, toWei, fromWei, _to, sleep

};
