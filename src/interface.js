/**
 * Ethereum Smart Contract Interface - a NodeJS library for compiling, deploying, and interacting with the smart contracts
 * Copyright (C) 2019,  Alexandr V.Mekh.
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

const HDWalletProvider = require('truffle-hdwallet-provider');
const EventEmitter = require('events');
const PromiEvent = require('web3-core-promievent');
const Web3js = require('web3');
const Mutex = require('await-semaphore').Mutex;
const extend = require('xtend');
const net = require('net');
const bn = require('big-integer');
const utils = require('./utils');

const erc20 = require('./ERC20');
const {
    FixedLengthArray,
    returnValue,
    toChecksum,
    fromWei,
    toWei,
    sleep,
    _to
} = utils;

EventEmitter.defaultMaxListeners = 5000;
const emitter = new EventEmitter;

const isDebug = process.env.LOG_LEVEL === 'debug';
let log = new Proxy({}, {
    get: function (logger, logLevel) {
        return function(message) {
            if(!isDebug) return;
            message = `[${(new Date()).toISOString()}] [${logLevel}] ${message}`;
            console.log(message)
        }
    }
});

const setLogger = logger => log = logger;


class Subscription {
    constructor(subId) {
        this.id = subId;
        this.subscription = null;
        this.unsibscribed = false;
    }

    unsubscribe (callback) {
        this.subscription.unsubscribe(callback);
        this.unsibscribed = true;
        this.subscription = null;
    }

    subscribe (obj, event, args) {
        if(this.unsibscribed) return;
        this.subscription = obj.events[event](...args);
        this.event = event;
    }
}


class TransactionObject {
    constructor (txMeta) {
        const { id } = txMeta;
        if(id && TransactionObject._ids && TransactionObject._ids[id])
            return TransactionObject._ids[id]; // don't create a new instance, return an existing one instead

        if(!TransactionObject._ids) TransactionObject._ids = {};
        Object.keys(txMeta).forEach(key => this[key] = txMeta[key]);

        if(id) TransactionObject._ids[id] = this;
    }
}


class TransactionManager {
    constructor(enforce=false) {
        //return a singleton by default
        if (TransactionManager._instance && !enforce) return TransactionManager._instance;
        this.tx = [];
        this.totalGasUsed = bn.zero;
        this.totalEthSpent = 0;
        this._retries = 0;
        this._lockMap = {};
        this._nonceInUse = {};
        this._idCounter = Math.round(Math.random() * Number.MAX_SAFE_INTEGER);
        TransactionManager._instance = this;
    }

    addTx(args) {
        args.time = args.time || (new Date()).getTime();
        args.status = 'pending';
        if(args.id) {
            const txs = this.getFilteredTxList({id: args.id});
            if(txs) this.updateTx(args)
        } else {
            args.id = this._createRandomId();
            this.tx.push(args);
        }
        return args.id;
    };

    getFailedTransactions(address) {
        const filter = {status: 'failed'};
        if(address) filter.from  = address;
        return this.getFilteredTxList(filter)
    };

    getConfirmedTransactions(address) {
        const filter = {status: 'confirmed'};
        if(address) filter.from  = address;
        return this.getFilteredTxList(filter)
    };

    getPendingTransactions(address) {
        const filter = {status: 'pending'};
        if(address) filter.from  = address;
        return this.getFilteredTxList(filter)
    };

    getSubmittedTransactions(address) {
        const filter = {status: 'submitted'};
        if(address) filter.from  = address;
        return this.getFilteredTxList(filter)
    };

    getFilteredTxList(opts, initialList) {
        let filteredTxList = initialList;
        Object.keys(opts).forEach((key) => {
            filteredTxList = this.getTxsByMetaData(key, opts[key], filteredTxList)
        });
        return filteredTxList
    };

    getTxsByMetaData(key, value, txList = this.tx) {
        return txList.filter(txMeta => txMeta[key] === value)
    };

    updateTx(txMeta) {
        txMeta.lastUpdate = (new Date()).getTime();
        if(txMeta.time) txMeta.duration = (txMeta.lastUpdate - txMeta.time)/1000;
        const index = this.tx.findIndex(tx => tx.id === txMeta.id);
        log.debug(`updateTx[${index}]: ${txMeta.id} -> ${JSON.stringify(txMeta)}`);
        Object.keys(txMeta).forEach(key => {this.tx[index][key] = txMeta[key]});

    };

    async getTxMeta() {
        const methodArgs = [].slice.call(arguments);
        const obj = methodArgs.shift();
        const method = methodArgs.shift();

        const lastArg = methodArgs[methodArgs.length - 1];
        const lastArgType = typeof lastArg;
        const isObject = (lastArgType === 'function' || lastArgType === 'object' && !!lastArg) && !Array.isArray(lastArg);

        const options = isObject ? methodArgs.pop() : {};

        options.from = options.from || obj.wallet;
        let txType;

        if(obj._sent.includes(method)) {
            options.gas = options.gas || obj.gasLimit || '6000000';
            options.gasPrice = options.gasPrice || obj.gasPrice;
            const gasPrice = await obj.w3.eth.getGasPrice();
            if(!options.gasPrice) {
                options.gasPrice = Math.ceil(parseInt(gasPrice) * 1.2);
            } else if(parseInt(gasPrice) > options.gasPrice) {
                log.warn(`the gas price is too LOW: blockchain - ${fromWei(gasPrice, 'gwei')}, TxObject - ${fromWei(options.gasPrice, 'gwei')} (GWEI)`)
            } else if(options.gasPrice > parseInt(gasPrice) * 10) {
                log.warn(`the gas price is too HIGH: blockchain - ${fromWei(gasPrice, 'gwei')}, TxObject - ${fromWei(options.gasPrice, 'gwei')} (GWEI)`)
            }
            txType = 'send';
        } else if(obj._call.includes(method)){
            txType = 'call';
        } else {
            throw new Error(`proxyHandler: Unsupported method "${method}"`);
        }

        return new TransactionObject({
            id: options.txId,
            from: options.from,
            methodArgs,
            method,
            options,
            txType
        });
    };

    async getNonce(address, w3) {
        address = toChecksum(address);
        const releaseNonceLock = await this._getLock(address);
        try {
            const block = await w3.eth.getBlock('latest');
            const blockNumber = block.number;
            const nextNetworkNonce = await w3.eth.getTransactionCount(address, blockNumber);
            const highestLocallyConfirmed = this._getHighestLocallyConfirmed(address);

            const highestSuggested = Math.max(nextNetworkNonce, highestLocallyConfirmed);

            const submittedTxs = this.getSubmittedTransactions(address);
            const pendingTxs = this.getPendingTransactions(address).filter(tx => tx.nonce > 0);

            const localNonceResult = this._getHighestContinuousFrom(
                submittedTxs.concat(pendingTxs),
                highestSuggested,
                address) || 0;

            const highestPending = pendingTxs.length ?
                pendingTxs.map(tx => tx.nonce).reduce((a, b) => Math.max(a, b)) :
                0;

            const nonceDetails = {
                localNonceResult,
                highestLocallyConfirmed,
                highestSuggested,
                nextNetworkNonce,
                highestPending
            };

            const nextNonce = Math.max(nextNetworkNonce, localNonceResult);
            //assert(Number.isInteger(nextNonce), `nonce-tracker - nextNonce is not an integer - got: (${typeof nextNonce}) "${nextNonce}"`);
            return { nextNonce, nonceDetails, releaseNonceLock };

        } catch (err) {
            log.error(`getNonce error: ${err}`);
            releaseNonceLock();
            throw err
        }
    };

    async submitTx(obj, txMeta, defer, lock=false) {
        let err, result, releaseTxLock;

        const { method, methodArgs, options, txType } = txMeta;
        if(txType === 'call') {
            [err, result] = await _to(obj.contract.methods[method](...methodArgs).call(options));
            return [err, result]
        }
        log.debug(JSON.stringify(this.getTxStat('submitTxIN')));

        await this._globalLockFree();
        releaseTxLock = lock ? await this._getLock(txMeta.from) : () => {};

        // get existing or assign a new transaction id
        txMeta.id = this.addTx(txMeta);
        //delete transaction hash and data if exist
        delete txMeta.txHash;
        delete txMeta.data;

        const sendFrom = options.from || obj.wallet;
        let { nextNonce, nonceDetails, releaseNonceLock } = await this.getNonce(sendFrom, obj.w3);

        let awaiting = this.getSubmittedTransactions().length;
        let pending = this.getPendingTransactions().length;

        const awaitLimit = 100;
        const awaitTime = 60; //seconds

        if(awaiting >= awaitLimit) {
            while(awaiting >= awaitLimit) {
                log.debug(`Too many transactions are waiting to be mined: submitted - ${awaiting}, pending - ${pending}, sleeping ${awaitTime} seconds...`);
                await sleep(awaitTime * 1000);
                awaiting = this.getSubmittedTransactions().length;
                pending = this.getPendingTransactions().length;
            }
        }

        let gasUsed = 0;

        txMeta.nonce = options.nonce || nextNonce;
        txMeta.status = 'submitted';
        this.updateTx(txMeta);

        options.nonce =  txMeta.nonce;
        releaseNonceLock();

        log.debug(JSON.stringify({
            id: txMeta.id,
            contractAddress: obj.address,
            nonceDetails,
            txMeta
        }));
        log.debug(JSON.stringify(this.getTxStat(txMeta.id)));


        [err, result] = await _to(obj.contract.methods[method](...methodArgs)
            .send(options)
            .on('transactionHash', hash => {
                defer.eventEmitter.emit('transactionHash', hash);
                log.debug(`transactionHash: ${txMeta.id} -> ${hash}`);
                txMeta.txHash = hash
            })
            .on('receipt', receipt => {
                defer.eventEmitter.emit('receipt', receipt);
                txMeta.blockNumber = receipt.blockNumber;
            })
            .on('error', e => {
                defer.eventEmitter.emit('error', e);
                this._checkError(e, sendFrom, txMeta);
                err = e;
            }));


        releaseTxLock();

        if(txMeta.txHash) {
            const receipt = await obj.w3.eth.getTransactionReceipt(txMeta.txHash);
            gasUsed = receipt ? receipt.gasUsed || 0 : 0;
            if(receipt && receipt.blockNumber) txMeta.blockNumber = receipt.blockNumber;
        }

        const totalGasUsed = obj.totalGasUsed || 0;
        obj.gasUsed = gasUsed;
        obj.totalGasUsed = bn(totalGasUsed).add(bn(obj.gasUsed)).toString();

        this.updateStat(obj.gasUsed, txMeta.options.gasPrice);

        if(!err) {
            log.debug(`submitTx: CONFIRMED - ${txMeta.id} `);
            txMeta.status = 'confirmed';
        }
        else {
            if(err.message && err.message.includes('Transaction ran out of gas')) {
                const gasPrice = fromWei(txMeta.options.gasPrice, 'gwei');
                log.warn(`submitTx: FAILED - ${txMeta.id} (${txMeta.txHash}), the transaction has been reverted or the gasLimit is too low (${gasPrice} gwei)`);
            } else {
                log.error(`submitTx: FAILED - ${txMeta.id}, ${err}`);
            }
            txMeta.status = 'failed';
        }
        txMeta.gasUsed = obj.gasUsed;
        txMeta.totalGasUsed = obj.totalGasUsed;

        this.updateTx(txMeta);

        const message = JSON.stringify(extend(this.getTxStat('submitTxOUT'), {txId: txMeta.id, txHash: txMeta.txHash}));
        if(err) {
            log.warn(message);
        } else {
            log.debug(message);
        }

        return [err, result]
    };

    getTxStat (id) {
        let data = {};
        if(id) data.id = id;

        return extend(
            data, {
                submitted: this.getSubmittedTransactions().length,
                pending: this.getPendingTransactions().length,
                failed: this.getFailedTransactions().length,
                confirmed: this.getConfirmedTransactions().length,
                retries: this._retries,
                totalGasUsed: this.totalGasUsed.toString(),
                totalEthSpent: this.totalEthSpent.toString()
            })
    };

    updateStat(gasUsed, gasPrice) {
        const weiSpent =  bn(gasUsed).multiply(bn(gasPrice)).toString();
        this.totalGasUsed = this.totalGasUsed.add(bn(gasUsed));
        this.totalEthSpent = this.totalEthSpent + parseFloat(fromWei(weiSpent, 'ether'));

    };

    _checkError (err, address, txMeta) {
        address = toChecksum(address);
        const { message } = err;
        const { id, nonce } = txMeta;
        if (
            message.includes('nonce too low') ||
            message.includes('Transaction was not mined within') ||
            message.includes('known transaction') ||
            message.includes('replacement transaction underpriced')
        ) {
            if(!(address in this._nonceInUse)) {
                this._nonceInUse[address] = new FixedLengthArray(200, true);
            }
            log.warn(`nonce in use: ${address}, ${id}, ${nonce} -> ${this._listToPeriods(this._nonceInUse[address])}`);
            this._nonceInUse[address].push(nonce);
        }
    };

    _listToPeriods (arr) {
        arr.sort((a,b) => a-b);

        let r = [[arr[0]]];
        let idx = 0;
        for(let i=1; i<arr.length; i++) {
            const isNext = arr[i] - arr[i-1] === 1;
            if( isNext) continue;

            if (r[idx][0] !== arr[i - 1]) r[idx].push(arr[i - 1]);
            idx++;
            r.push([arr[i]]);
        }

        const rl = r.length;
        if(r[rl - 1].length === 1 && arr.slice(-1)[0] !== r[rl - 1][0])
            r[rl - 1].push(arr.slice(-1)[0]);

        let res = [];
        r.forEach((item) => {
            res.push(item.join(' - '))
        });

        return res.join(', ');
    };

    _getHighestLocallyConfirmed (address) {
        const confirmedTransactions = this.getConfirmedTransactions(address);
        const highest = this._getHighestNonce(confirmedTransactions);
        return Number.isInteger(highest) ? highest + 1 : 0
    };

    _getHighestContinuousFrom (txList, startPoint, address) {
        if(address) address = toChecksum(address);

        const nonces = txList.map(txMeta => txMeta.nonce);

        let highest = startPoint;
        while (nonces.includes(highest) || (address && this._nonceInUse[address] && this._nonceInUse[address].includes(highest))) {
            highest++
        }
        return highest
    };

    _getHighestNonce (txList) {
        const nonces = txList.map(txMeta => txMeta.nonce);
        const max = nonces.length ? nonces.reduce((a, b) => Math.max(a, b)) : null;
        return max
    };

    async _getLock (address) {
        const mutex = this._lookupMutex(address);
        return mutex.acquire()
    };

    async _getGlobalLock () {
        log.debug(`_getGlobalLock`);
        const globalMutex = this._lookupMutex('global');
        const releaseLock = await globalMutex.acquire();
        return { releaseLock }
    };

    _lookupMutex (lockId) {
        let mutex = this._lockMap[lockId];
        if (!mutex) {
            mutex = new Mutex();
            this._lockMap[lockId] = mutex
        }
        return mutex;
    };

    async _globalLockFree () {
        const globalMutex = this._lookupMutex('global');
        const releaseLock = await globalMutex.acquire();
        releaseLock()
    };

    _createRandomId() {
        this._idCounter = this._idCounter % Number.MAX_SAFE_INTEGER;
        return this._idCounter++
    }
}


const proxyHandler = {
    get: function ptoxyGet (obj, prop) {
        if(!obj.proxyMethods.includes(prop)) return obj[prop];
        if(prop in obj) return obj[prop];

        let isEvent = obj._events.includes(prop);

        if(isEvent) {
            const event = prop.split(/^on/)[1];
            obj[prop] = function proxyAddEvent () {
                const args = [].slice.call(arguments);
                const callback = args[args.length - 1];
                if(!callback || typeof callback !== 'function')
                    throw new Error('A callback must be a function!');
                let subscription;

                subscription = new Subscription(obj.w3.currentProvider.wsId);
                subscription.subscribe(obj, event, args);
                log.debug(`[${subscription.id}] [${obj.address}] -> subscribed to ${event}`);

                emitter.on('restoreSubscription', async (wsId)  => {
                    const webSocketId = subscription.id;
                    if(!webSocketId || wsId !== webSocketId || subscription.unsibscribed) return;
                    log.debug(`[${wsId}] [${obj.address}] Restoring the "${prop}" subscription...`);
                    subscription.subscribe(obj, event, args);
                });

                return subscription;
            };

            return obj[prop];
        }

        obj[prop] = function proxyAddProp () {
            const defer = PromiEvent();
            const args = [].slice.call(arguments);

            const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
            if(callback) args.pop();

            let retryOptions = args.filter(item => item.retryOptions)[0];
            if(retryOptions) {
                const idx = args.indexOf(retryOptions);
                retryOptions = args.splice(idx, 1)[0].retryOptions;
            }

            const send = (meta) => {
                if(!retryOptions) {
                    obj.txManager.submitTx(obj, meta, defer).then(([err, res]) => {
                        returnValue(err, res, defer, callback);
                    })
                } else {
                    obj.sendWithRetry(meta, retryOptions, defer).then(([err, res]) => {
                        returnValue(err, res, defer, callback)
                    })
                }
            };

            obj.txManager.getTxMeta(obj, prop, ...args).then(send);
            return defer.eventEmitter;
        };

        return obj[prop]
    }
};


wsId = 0;
class Web3 {
    constructor (nodeAddress, mnemonic) {
        if (!nodeAddress)
            throw "Error: the node address is not defined!";

        const supportedProtocols = ['ws', 'wss', 'http', 'https', 'ipc'];
        let protocol;
        if (nodeAddress.search(/\.ipc$/) !== -1) protocol = 'ipc';
        else protocol = nodeAddress.split(':')[0];

        if (!supportedProtocols.includes(protocol))
            throw `"${protocol}" protocol is not supported! ` +
            `Supported protocols:\n${JSON.stringify(supportedProtocols)}`;

        const providers = {
            https: Web3js.providers.HttpProvider,
            http: Web3js.providers.HttpProvider,
            ipc: Web3js.providers.IpcProvider,
            wss: Web3js.providers.WebsocketProvider,
            ws: Web3js.providers.WebsocketProvider
        };

        let provider;

        if (protocol === 'ipc') {
            provider = new providers[protocol](nodeAddress, net);
        }
        else if (mnemonic) {
            let addressesToUnlock = 20;

            if (mnemonic.indexOf(" ") === -1 || Array.isArray(mnemonic)) {
                const privateKeys = Array.isArray(mnemonic) ? mnemonic : [mnemonic];
                addressesToUnlock = privateKeys.length;
            }

            provider = new HDWalletProvider(mnemonic, nodeAddress, 0, addressesToUnlock);
            provider.engine.stop(); // stop block-polling

        } else if (protocol.startsWith('ws')) {
            this.wsId = ++wsId;
            this.web3 = new Web3js(new providers[protocol](nodeAddress));

            let shouldLog = true;
            let isFailed = false;
            const resetProvider = (provider) => {
                isFailed = true;
                this.isConnected = false;
                if(this.isConnected) return;
                provider.removeAllListeners();

                if(shouldLog) {
                    shouldLog = false;
                    log.error(`[${this.wsId}] WebSocket - connection error "${nodeAddress}"`);
                    setTimeout(() => shouldLog = true, 20 * 60 * 1000)
                }
                if(!this.isConnected) this.web3.setProvider(getProvider());
            };

            const getProvider = () => {
                const provider = new providers[protocol](nodeAddress);
                provider.on('error', () => resetProvider(provider));
                provider.on('end', () => resetProvider(provider));
                provider.on('connect', () => {
                    log.info(`[${this.wsId}] WebSocket - connected to "${nodeAddress}"`);
                    this.isConnected = true;
                    if(isFailed === true)
                        emitter.emit('resetProvider', this.wsId, provider);
                    isFailed = false;
                    shouldLog = true;
                });
                provider.wsId = this.wsId;

                return provider
            };

            provider = getProvider();

        } else {
            provider = new providers[protocol](nodeAddress);
        }

        this.web3 = new Web3js(provider);
        return this.web3;
    }
}


class Interface {
    constructor (nodeAddress, contractAddress, mnemonic, web3Instance, abi, bytecode) {
        if (web3Instance) {
            this.w3 = web3Instance;
        } else {
            if (!nodeAddress)
                throw "The node address is not defined!";
            this.protocol = nodeAddress.split(':')[0];
            this.w3 = new Web3(nodeAddress, mnemonic);
        }

        this.contract = new this.w3.eth.Contract(abi);
        this.methods = this.contract.methods;
        this.events = this.contract.events;

        emitter.on('resetProvider', async (wsId, provider) => {
            if(wsId !== this.w3.currentProvider.wsId) return;
            this.contract._requestManager.provider = null; // get rid of 'connection not open on send()' error
            this.contract.setProvider(provider);
            emitter.emit('restoreSubscription', this.w3.currentProvider.wsId)
        });

        if(contractAddress) {
            this._address = toChecksum(contractAddress);
            this.at(this._address);
        }

        this.abi = abi;
        this._gasPrice = null;
        this.bytecode = bytecode;
        this.gasLimit = '6000000';
        this.accounts = this.w3.currentProvider.addresses;
        this.walletIndex = 0;

        this._setProxyMethods();

        this.txManager = new TransactionManager();

        return new Proxy(this, proxyHandler);
    }

    _setProxyMethods() {
        const _callStates = ['pure', 'view'];
        this._sent = this.abi.filter(item => !_callStates.includes(item.stateMutability) && item.type === 'function').map(item => item.name);
        this._call = this.abi.filter(item => _callStates.includes(item.stateMutability) && item.type === 'function').map(item => item.name);
        this._events = this.abi.filter(item => item.type === 'event').map(item => 'on' + item.name);
        this.proxyMethods = this._sent.concat(this._call).concat(this._events);
    }

    static web3 (web3Instance, contractAddress, abi, bytecode) {
        return new Interface(null, contractAddress, null, web3Instance, abi, bytecode)
    }

    get wallet() {
        if (!this.accounts)
        //throw "The wallet has not been initialized yet. Call the 'init' method before accessing to the accounts.";
            return;
        return toChecksum(this.accounts[this.walletIndex])
    }

    set wallet(index) {
        this.walletIndex = index;
    }

    set gasPrice(price) {
        if(!price || Number(parseFloat(price)) !== price)
            this._gasPrice = null;
        else
            this._gasPrice = toWei(price.toString(), 'gwei');
    }

    get gasPrice() {
        return this._gasPrice;
    }

    get address() {
        return this._address;
    }

    set address(address) {
        this.at(address)
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
        if (!this.accounts) this.accounts = await this.w3.eth.getAccounts();
    }

    async getGasPrice(multiplier) {
        multiplier = multiplier || 1;
        const gasPrice = await this.w3.eth.getGasPrice();
        return Math.ceil(gasPrice * multiplier);
    }

    async deploy(options, callback) {
        options = options || {};
        const bytecode = options.bytecode || this.bytecode;
        const contractArguments = options.args || [];
        await this.init();
        const blockGasPrice = await this.getGasPrice(1);
        const gasPrice = options.gasPrice || this.gasPrice || await this.getGasPrice(1.2);
        if(parseInt(blockGasPrice) > gasPrice) {
            log.warn(`the gas price is too low: ` +
                `blockchain - ${fromWei(blockGasPrice, 'gwei')}, ` +
                `TxObject - ${fromWei(gasPrice, 'gwei')} (GWEI)`)
        }

        const params = {
            from: options.from || this.wallet,
            gas: this.gasLimit,
            gasPrice: gasPrice
        };

        if(options.nonce) {
            params.nonce = options.nonce;
        } else {
            let { nextNonce, releaseNonceLock } = await this.txManager.getNonce(params.from, this.w3);
            params.nonce = nextNonce;
            releaseNonceLock()
        }

        const txMeta = {method: 'deploy', from: this.wallet, params: params, contractArguments: contractArguments, nonce: params.nonce};
        this.txManager.addTx(txMeta);

        const [err, result] = await _to(this.contract.deploy({data: bytecode, arguments: contractArguments})
            .send(params)
            .once('transactionHash', (hash) => log.debug(` Tx hash: ${hash}`))
            .once('confirmation', (num, rec) => {
                log.debug(` address ${rec.contractAddress}`);

                let weiSpent = bn(rec.gasUsed).multiply(bn(gasPrice)).toString();

                if(rec) this.txManager.updateStat(rec.gasUsed, gasPrice);

                log.debug(JSON.stringify({
                    deploy: {
                        gasUsed: rec.gasUsed,
                        gasPrice: gasPrice,
                        weiSpent: weiSpent,
                        totalEthSpent: this.txManager.totalEthSpent
                    }
                }));
            }));

        // delete tx data to reduce the log size
        delete txMeta.params.data;
        if(!err) {
            this.at(result.options.address);
            txMeta.status = 'confirmed';
        } else { txMeta.status = 'failed' }
        this.txManager.updateTx(txMeta);
        returnValue(err, result, callback);
    };

    async sendWithRetry (txMeta, retryOptions, defer) {
        let err, result, nonce;
        retryOptions = retryOptions || {};

        const { methodArgs } = txMeta;


        let delay = retryOptions.delay || 10; //seconds
        let gasPrice = retryOptions.gasPrice || this.gasPrice || await this.getGasPrice(1.2); //block gasPrice + 20%
        const verify = retryOptions.verify;
        const retry = retryOptions.retry || 3;
        const incBase = retryOptions.incBase || 1;

        let counter = 0;

        do {
            let verified = false;

            const updateTx = () => {
                let msg = `${methodArgs.join(', ')} - ${txMeta.txHash} -> Tx Success`;
                if(verified) msg += `, VERIFIED`;
                log.debug(`[try #${counter}] [txId ${txMeta.id}] ` + msg);
                if(txMeta.id) {
                    txMeta.status = 'confirmed';
                    this.txManager.updateTx(txMeta);
                }
                log.debug(JSON.stringify(extend(this.txManager.getTxStat(`try #${counter} out`), {txId: txMeta.id, txHash: txMeta.txHash})));
            };

            // will be skipped on first call
            if(err && verify) verified = await verify(...methodArgs);
            if((!err || !!verified) && counter > 0) {
                if(txMeta.status !== 'confirmed') updateTx();
                return [null, result]
            }
            if(counter > 0) {
                delete txMeta.options.data;
                log.debug(`resubmit: ${txMeta.id} -> ${JSON.stringify(txMeta)}`);
                this.txManager._retries += 1;
            }

            // first attempt - send a transaction with a standard price, increase it on subsequent attempts
            txMeta.options.gasPrice = Math.ceil(parseInt(gasPrice) * incBase ** counter);
            txMeta.options.nonce = nonce;

            [err, result] = await this.txManager.submitTx(this, txMeta, defer);

            if(err && verify) verified = await verify(...methodArgs);

            if(!err || !!verified) {
                if(txMeta.status !== 'confirmed') updateTx();
                return [null, result]
            }

            // if transaction has failed because of timeout - replace it with highest gasPrice and the same nonce
            if(err.message.includes('Transaction was not mined within'))
                nonce = txMeta.nonce;
            else nonce = null;


            // skip waiting/logging if it was the last retry
            if(counter < retry) {
                log.warn(`[try #${counter}] [tx.id ${txMeta.id}] [txHash ${txMeta.txHash}] ${methodArgs.join(', ')} - Tx Failed, next try in ${delay * (counter + 1)} seconds...`);
                await sleep(delay * (counter + 1) * 1000);
            }

            counter++;

        } while (!(result || counter > retry));
        log.error(`[try #${counter - 1}] [tx.id ${txMeta.id}] [txHash ${txMeta.txHash}] ${methodArgs.join(', ')} - Tx Failed`);
        return [err, result]
    };
}


class ERC20 extends Interface {
    constructor(nodeAddress, tokenAddress, mnemonic, web3Instance, abi, bytecode) {
        abi = abi || erc20;
        super(nodeAddress, tokenAddress, mnemonic, web3Instance, abi, bytecode);
    }
}


module.exports = {
    Interface,
    ERC20,
    Web3,
    setLogger,
    utils
};
