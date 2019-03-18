'use strict';

const { Mutex } = require('await-semaphore');
const bn = require('big-integer');
const _ = require('lodash');

const TransactionObject = require('./transactionObject');
const utils = require('../utils');

const {
    FixedLengthArray,
    toChecksum,
    fromWei,
    sleep,
    _to
} = utils;

class TransactionManager {
    constructor(enforce = false) {
        //return a singleton by default
        if (TransactionManager._instance && !enforce)
            return TransactionManager._instance;

        this.tx = [];
        this.totalGasUsed = bn.zero;
        this.totalEthSpent = 0;
        this.retries = 0;
        this._lockMap = {};
        this._nonceInUse = {};
        this._idCounter = Math.round(Math.random() * Number.MAX_SAFE_INTEGER);
        TransactionManager._instance = this;
    }

    addTx(txMeta) {
        delete txMeta.txHash;
        delete txMeta.data;

        const { id } = txMeta;

        txMeta.time = txMeta.time || new Date().getTime();

        if (id) {
            const txs = this.getFilteredTxList({ id });
            if (txs) this.updateTx(txMeta, 'pending');
            return;
        }

        txMeta.id = this._createRandomId();
        this.tx.push(txMeta);
    }

    getFailedTransactions(address) {
        return this._filterTxByStatus(address, 'failed');
    }

    getConfirmedTransactions(address) {
        return this._filterTxByStatus(address, 'confirmed');
    }

    getPendingTransactions(address) {
        return this._filterTxByStatus(address, 'pending');
    }

    getSubmittedTransactions(address) {
        return this._filterTxByStatus(address, 'submitted');
    }

    getFilteredTxList(opts, initialList) {
        let filteredTxList = initialList;
        Object.keys(opts).forEach(key => {
            filteredTxList = this.getTxsByMetaData(key, opts[key], filteredTxList);
        });
        return filteredTxList;
    }

    getTxsByMetaData(key, value, txList = this.tx) {
        return txList.filter(txMeta => txMeta[key] === value);
    }

    updateTx(txMeta, status) {
        txMeta.status = status;
        txMeta.lastUpdate = new Date().getTime();
        txMeta.duration = (txMeta.lastUpdate - txMeta.time) / 1000;
        const index = this.tx.findIndex(tx => tx.id === txMeta.id);
        Object.keys(txMeta).forEach(key => (this.tx[index][key] = txMeta[key]));
    }

    async getTxMeta(...args) {
        const obj = args.shift();
        const method = args.shift();

        const options = _.isPlainObject(_.last(args)) ? args.pop() : {};
        if (!obj.accounts || obj.accounts.length === 0) await obj.init();

        options.from = options.from || obj.wallet;
        let txType = 'call';

        if (!obj._call.includes(method)) {
            txType = 'send';
            options.gas = options.gas || obj.gasLimit;
            options.gasPrice = options.gasPrice || obj.gasPrice;
            const blockGasPrice = await obj.getGasPrice();

            if (!options.gasPrice) options.gasPrice = Math.ceil(blockGasPrice * 1.2);
        }

        return new TransactionObject({
            from: options.from,
            to: obj.address,
            method,
            methodArgs: args,
            options,
            txType
        });
    }

    async getNonce(address, w3) {
        address = toChecksum(address);
        const releaseNonceLock = await this._getLock(address);
        try {
            const block = await w3.eth.getBlock('latest');
            const nextNetworkNonce = await w3.eth.getTransactionCount(address, block.number);
            const highestLocallyConfirmed = this._getHighestLocallyConfirmed(address);

            const highestSuggested = Math.max(nextNetworkNonce, highestLocallyConfirmed);

            const submittedTxs = this.getSubmittedTransactions(address);
            const pendingTxs = this.getPendingTransactions(address).filter(tx => tx.nonce > 0);

            const localNonceResult = this._getHighestContinuousFrom(
                submittedTxs.concat(pendingTxs),
                highestSuggested,
                address) || 0;

            const nextNonce = Math.max(nextNetworkNonce, localNonceResult);

            return { nextNonce, releaseNonceLock };
        } catch (error) {
            releaseNonceLock();
            throw new Error(error);
        }
    }

    async submitTx(obj, txMeta, defer, path) {
        const exec = _.get(obj, path || 'contract.methods');

        const { method, methodArgs, options, txType } = txMeta;

        if (txType === 'call')
            return await _to(exec[method](...methodArgs).call(options));

        this.addTx(txMeta);

        const { nextNonce, releaseNonceLock } = await this.getNonce(options.from, obj.w3);

        await this._waitQueue();

        options.nonce = options.nonce || nextNonce;
        txMeta.nonce = options.nonce;
        this.updateTx(txMeta, 'submitted');

        releaseNonceLock();

        const [err, result] = await _to(
            exec[method](...methodArgs)
                .send(options)
                .on('transactionHash', hash => {
                    defer.emit('transactionHash', hash);
                    txMeta.txHash = hash;
                })
                .on('receipt', receipt => {
                    defer.emit('receipt', receipt);
                    txMeta.blockNumber = receipt.blockNumber;
                    this._calculateGasExpenses(obj, txMeta, receipt.gasUsed);
                })
                .on('error', e => {
                    defer.emit('error', e);
                    this._checkError(e, options.from, txMeta);
                })
        );

        if (!err && method === 'deploy' && path === 'contract')
            obj.at(result.options.address);

        this._finalizeTx(txMeta, err);

        return [err, result];
    }

    getTxStat() {
        return {
            submitted: this.getSubmittedTransactions().length,
            pending: this.getPendingTransactions().length,
            failed: this.getFailedTransactions().length,
            confirmed: this.getConfirmedTransactions().length,
            retries: this.retries,
            totalGasUsed: this.totalGasUsed.toString(),
            totalEthSpent: this.totalEthSpent.toString()
        };
    }

    updateStat(gasUsed, gasPrice) {
        const weiSpent = bn(gasUsed).multiply(bn(gasPrice)).toString();
        this.totalGasUsed = this.totalGasUsed.add(bn(gasUsed));
        this.totalEthSpent = this.totalEthSpent + parseFloat(fromWei(weiSpent));
    }

    _calculateGasExpenses(obj, txMeta, gasUsed = 0) {
        obj.gasUsed = gasUsed;
        obj.totalGasUsed = bn(obj.totalGasUsed).add(bn(gasUsed)).toString();

        txMeta.gasUsed = gasUsed;
        txMeta.totalGasUsed = obj.totalGasUsed;

        this.updateStat(gasUsed, txMeta.options.gasPrice);
    }

    _finalizeTx(txMeta, err) {
        let status = err ? 'failed' : 'confirmed';
        this.updateTx(txMeta, status);
    }

    _checkError(err, address, txMeta) {
        address = toChecksum(address);
        const { message } = err;
        const { nonce } = txMeta;
        if (
            message.includes('nonce too low') ||
            message.includes('Transaction was not mined within') ||
            message.includes('known transaction') ||
            message.includes('replacement transaction underpriced')
        ) {
            if (!(address in this._nonceInUse)) {
                this._nonceInUse[address] = new FixedLengthArray(200, true);
            }
            this._nonceInUse[address].push(nonce);
        }
    }

    _filterTxByStatus(address, status) {
        const filter = { status };
        if (address) filter.from = address;
        return this.getFilteredTxList(filter);
    }

    _getHighestLocallyConfirmed(address) {
        const confirmedTransactions = this.getConfirmedTransactions(address);
        const highest = this._getHighestNonce(confirmedTransactions);
        return Number.isInteger(highest) ? highest + 1 : 0;
    }

    _getHighestContinuousFrom(txList, startPoint, address) {
        if (address) address = toChecksum(address);

        const nonces = txList.map(txMeta => txMeta.nonce);
        const inUse = this._nonceInUse[address];

        let highest = startPoint;
        while (nonces.includes(highest) || (address && inUse && inUse.includes(highest))) {
            highest++;
        }

        return highest;
    }

    _getHighestNonce(txList) {
        const nonces = txList.map(txMeta => txMeta.nonce);
        return nonces.length > 0 ? nonces.reduce((a, b) => Math.max(a, b)) : null;
    }

    async _waitQueue() {
        let awaiting = this.getSubmittedTransactions().length;

        const awaitLimit = 100;
        const awaitTime = 60; //seconds

        if (awaiting >= awaitLimit) {
            while (awaiting >= awaitLimit) {
                await sleep(awaitTime * 1000);
                awaiting = this.getSubmittedTransactions().length;
            }
        }
    }

    async _getLock(address) {
        const mutex = this._lookupMutex(address);
        return mutex.acquire();
    }

    _lookupMutex(lockId) {
        let mutex = this._lockMap[lockId];
        if (!mutex) {
            mutex = new Mutex();
            this._lockMap[lockId] = mutex;
        }
        return mutex;
    }

    _createRandomId() {
        this._idCounter = this._idCounter % Number.MAX_SAFE_INTEGER;
        return this._idCounter++;
    }
}

module.exports = TransactionManager;
