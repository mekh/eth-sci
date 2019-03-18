/**
 * Ethereum Smart Contract Interface - a NodeJS library for compiling, deploying, and interacting with the smart contracts
 * Copyright (C) 2019,  Alexandr V.Mekh
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

'use strict';
const TransactionManager = require('../modules/transactionManager');
const Subscription = require('../modules/subscription');
const Web3 = require('../modules/web3');
const utils = require('../utils');
const proxyHandler = require('./proxyHandler');

const {
    toChecksum,
    toWei,
    sleep,
} = utils;


class Interface {
    constructor(nodeAddress, contractAddress, mnemonic, web3Instance, abi, bytecode) {
        if (web3Instance) {
            this.w3 = web3Instance;
        } else {
            if (!nodeAddress) throw new Error('The node address is not defined!');

            this.w3 = new Web3(nodeAddress, mnemonic);
            this.emitter = this.w3.emitter;
            this.emitter.on('resetProvider', provider => this._resetProvider(provider));
        }

        this.contract = new this.w3.eth.Contract(abi);
        this.methods = this.contract.methods;
        this.events = this.contract.events;
        this.subscriptions = [];

        if (contractAddress) {
            this._address = toChecksum(contractAddress);
            this.at(this._address);
        }

        this.abi = abi;
        this._gasPrice = null;
        this.bytecode = bytecode;
        this.gasLimit = '6000000';
        this.gasUsed = 0;
        this.totalGasUsed = 0;
        this.accounts = this.w3.currentProvider.addresses || [];
        this.walletIndex = 0;

        this._setProxyMethods();

        this.txManager = new TransactionManager();

        return new Proxy(this, {
            get: proxyHandler
        });
    }

    _resetProvider(provider) {
        this.contract.setProvider(provider);
        this.subscriptions.forEach(sub => {
            sub.subscribe();
        });
    }

    _subscribe(options, event, callback) {
        if (!callback || typeof callback !== 'function')
            throw new Error('Callback must be a function!');

        const subscription = new Subscription(this, event, options, callback);
        subscription.subscribe();

        this.subscriptions.push(subscription);
        return subscription;
    }

    _setProxyMethods() {
        const _callStates = ['pure', 'view'];
        this._sent = this.abi.filter(item => !_callStates.includes(item.stateMutability) && item.type === 'function').map(item => item.name);
        this._call = this.abi.filter(item => _callStates.includes(item.stateMutability) && item.type === 'function').map(item => item.name);
        this._events = this.abi.filter(item => item.type === 'event').map(item => 'on' + item.name);
        this._misc = ['_deploy'];
        this.proxyMethods = this._sent.concat(this._misc).concat(this._call).concat(this._events);
    }

    static web3(web3Instance, contractAddress, abi, bytecode) {
        return new Interface(null, contractAddress, null, web3Instance, abi, bytecode);
    }

    get wallet() {
        if (this.accounts && this.accounts.length > 0)
            return toChecksum(this.accounts[this.walletIndex]);
        return null;
    }

    set wallet(index) {
        this.walletIndex = index;
    }

    set gasPrice(price) {
        if (!price || Number(parseFloat(price)) !== price) this._gasPrice = null;
        else this._gasPrice = toWei(price, 'gwei');
    }

    get gasPrice() {
        return this._gasPrice;
    }

    get address() {
        return this._address;
    }

    set address(address) {
        this.at(address);
    }

    get abi() {
        return this.contract.options.jsonInterface;
    }

    set abi(abi) {
        this.contract.options.jsonInterface = abi;
        this._setProxyMethods();
    }

    at(address) {
        this._address = address;
        this.contract.options.address = toChecksum(address);
        return this;
    }

    async init() {
        if (!this.accounts || this.accounts.length === 0)
            this.accounts = await this.w3.eth.getAccounts();
    }

    async getGasPrice(multiplier) {
        multiplier = multiplier || 1;
        const gasPrice = await this.w3.eth.getGasPrice();
        return Math.ceil(gasPrice * multiplier);
    }

    deploy(options, callback) {
        options = options || {};

        const {from, gas, gasPrice, gasLimit, nonce, value, args, bytecode} = options;

        const _args = [
            { data: bytecode || this.bytecode, arguments: args || [] },
            { from, gas, gasPrice, gasLimit, nonce, value }
        ];

        if (callback) _args.push(callback);

        return this._deploy(..._args);
    }

    async sendWithRetry (txMeta, retryOptions, defer) {
        let err, result, counter = 0;

        retryOptions = retryOptions || {};

        const { methodArgs } = txMeta;
        const { txManager } = this;

        let delay = retryOptions.delay || 10; //seconds
        let gasPrice = retryOptions.gasPrice || this.gasPrice || (await this.getGasPrice(1.2)); //block gasPrice + 20%
        const verify = retryOptions.verify || function() {};
        const retry = retryOptions.retry || 3;
        const incBase = retryOptions.incBase || 1;

        const updateNonce = (e, n) =>
            e.includes('Transaction was not mined within') ? n : null;


        const updateTx = (meta, result) => {
            const { status } = meta;
            if (status !== 'confirmed') txManager.updateTx(meta, 'confirmed');

            return [null, result];
        };

        const _verify = async (err, args) => err ? !!(await verify(...args)) : true;

        const _sleep = (meta, counter, delay) => {
            return sleep(delay * (counter + 1) * 1000);
        };

        do {
            txMeta.options.gasPrice = Math.ceil(+gasPrice * incBase ** counter);

            [err, result] = await txManager.submitTx(this, txMeta, defer);
            delete txMeta.options.data;

            if (await _verify(err, methodArgs))
                return updateTx(txMeta, result, err, counter);

            if (retry === counter) break;

            await _sleep(txMeta, counter, delay);
            if (await _verify(err, methodArgs))
                return updateTx(txMeta, result, err, counter);

            txMeta.options.nonce = updateNonce(err.message, txMeta.nonce);

            txManager.retries++;
            counter++;
        } while (counter <= retry);

        return [err, result];
    }
}


module.exports = Interface;
