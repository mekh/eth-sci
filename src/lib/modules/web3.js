'use strict';
const EventEmitter = require('events');
const HDWalletProvider = require('truffle-hdwallet-provider');
const WsProvider = require('../providers/wsProvider');
const Web3js = require('web3');
const net = require('net');
const _ = require('lodash');

EventEmitter.defaultMaxListeners = 5000;


class Web3 {
    constructor(nodeAddress, mnemonic) {
        if (!nodeAddress) throw new Error('The node address is not defined!');

        const supportedProtocols = ['ws', 'wss', 'http', 'https', 'ipc'];
        let protocol;
        if (nodeAddress.search(/\.ipc$/) !== -1) protocol = 'ipc';
        else protocol = nodeAddress.split(':')[0];

        if (!supportedProtocols.includes(protocol))
            throw new Error(`"${protocol}" protocol is not supported! ` +
                `Supported protocols:\n${JSON.stringify(supportedProtocols)}`);

        let provider;
        let emitter = new EventEmitter();

        if (protocol === 'ipc') {
            provider = new Web3js.providers.IpcProvider(nodeAddress, net);
        } else if (protocol.startsWith('ws')) {
            const _ws = new WsProvider(nodeAddress);
            provider = _ws.provider;
            emitter = _ws.emitter;
        } else {
            provider = new Web3js.providers.HttpProvider(nodeAddress);
        }

        if (mnemonic) {
            let accountsToUnlock = 20;

            if (mnemonic.indexOf(' ') === -1) {
                const privateKeys = _.isArray(mnemonic) ? mnemonic : [mnemonic];
                accountsToUnlock = privateKeys.length;
            }

            provider = new HDWalletProvider(mnemonic, provider, 0, accountsToUnlock);
            provider.engine.stop(); // stop block-polling
        }

        this.emitter = emitter;
        this.web3 = new Web3js(provider);

        return new Proxy(this, {
            get: (target, prop) => {
                if (prop  === 'emitter')
                    return target[prop];

                return target.web3[prop];
            }
        });
    }
}

module.exports = Web3;
