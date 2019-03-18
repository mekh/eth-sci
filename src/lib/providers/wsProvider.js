'use strict';
const Events = require('events');
const Web3 = require('web3');

class WsProvider {
    constructor(uri, options) {
        this.uri = uri;
        this.options = options || {};
        this.provider = this.getProvider();
        this.addListeners();

        this.emitter = new Events();
        this.connecting = false;
    }

    getProvider() {
        return new Web3.providers.WebsocketProvider(this.uri, this.options);
    }

    addListeners () {
        this.provider.on('error', this.reset);
        this.provider.on('close', this.reset);
    }

    reset() {
        if(this.connecting) return;
        this.connecting = true;
        this.provider.disconnect();
        this.awaitConnection();
    }

    awaitConnection() {
        const interval = setInterval(() => {
            if(!this.connecting) {
                clearInterval(interval);
                return;
            }

            this.provider = this.getProvider();

            this.provider.on('ready', () => {
                clearInterval(interval);
                this.onConnectionReady();
            });

        }, 500);
    }

    onConnectionReady() {
        this.connecting = false;
        this.addListeners();
        this.emitter.emit('resetProvider', this.provider);
    }
}

module.exports = WsProvider;
