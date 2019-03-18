'use strict';
const solc = require('solc');
const utils = require('web3-utils');
const bn = require('big-integer');
const _ = require('lodash');

exports.compile = async (source, callback) => {
    const input = {
        language: 'Solidity',
        sources: {
            contract: {
                content: source
            }
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*']
                }
            }
        }
    };

    const compiled = await solc.compile(JSON.stringify(input));
    const { errors, contracts } = JSON.parse(compiled);
    if (errors && errors.length > 0) {
        return returnValue('\n' + errors.map(e => e.formattedMessage + '\n'), null, callback);
    }

    const result = {};
    Object.keys(contracts.contract).forEach(contract => {
        const path = contracts.contract[contract];
        const bytecode = path['evm']['bytecode']['object'];
        result[contract] = { abi: path.abi, bytecode: '0x' + bytecode };
    });

    return returnValue(null, result, callback);
};

const returnValue = (err, result, defer, callback) => {
    const args = [err, result, defer, callback];
    if (_.isFunction(_.last(args))) {
        callback(err, result);

    } else if (_.isFunction(_.nth(args, -2))) {
        callback = defer;
        callback(err, result);
        defer = null;
    }

    if (err && defer) {
        if (callback || defer.listeners('error').length > 0) {
            // suppress uncaught error if an error listener is present
            // OR suppress uncaught error if a callback function is present
            defer.catch(function() {});
            defer.removeAllListeners();
        }
        setTimeout(() => {
            defer.reject(err);
        }, 1);

        return defer;
    }
    else if (err && !_.isFunction(callback) && (!defer || defer.listeners('error').length === 0)) throw new Error(err);
    else if (defer) defer.resolve(result);
    else return result;
};

exports.returnValue = returnValue;

exports.FixedLengthArray = function(lengthLimit, unique = false) {
    let array = [];

    array.has = function() {
        const args = [].slice.call(arguments);
        return [].includes.apply(this, args);
    };

    array.add = function() {
        let args = [].slice.call(arguments);
        args = [...new Set(args.filter(item => !this.includes(item)))];
        this._truncate(...args);
        return [].push.apply(this, args);
    };

    array.push = function() {
        let args = [].slice.call(arguments);
        if (unique) return this.add(...args);

        this._truncate(...args);
        return [].push.apply(this, args);
    };

    array._truncate = function() {
        const args = [].slice.call(arguments);
        if (lengthLimit && this.length >= lengthLimit && args.length > 0) {
            args.forEach(() => this.shift());
        }

        return this;
    };

    return array;
};

exports.epochToDateString = timestamp => {
    const d = new Date();
    const date = new Date(timestamp * 1000 + d.getTimezoneOffset() * 60000);
    const year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let seconds = date.getSeconds();

    month = month < 10 ? '0' + month : month;
    day = day < 10 ? '0' + day : day;
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;

    return year + '/' + month + '/' + day + ' ' + hours + ':' + minutes + ':' + seconds;
};

const fromWei = (amount, unit) => utils.fromWei(amount.toString(), unit);
exports.toWei = (amount, unit) => utils.toWei(amount.toString(), unit);
exports.toChecksum = address => utils.toChecksumAddress(address.toLowerCase());
exports.fromWei = fromWei;

exports.isAddress = address => utils.isAddress(address.toLowerCase());

exports.toToken = (value, decimals) => {
    if (decimals === 18) return fromWei(value);

    let tenToRemainingDecimalPlaces = bn(10).pow(18 - decimals);
    let asIf18 = bn(value).multiply(tenToRemainingDecimalPlaces).toString(10);
    return fromWei(asIf18);
};

exports._to = promise => promise.then(data => [null, data]).catch(error => [error, null]);

exports.sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
