'use strict';
const Events = require('events');
const Web3 = require('web3');

class WsProvider {
    constructor(uri, options) {
        this.uri = uri;
        this.options = options || {};
        this.connecting = true;
        this.setup(this.getProvider());
        this.emitter = new Events();
    }

    getProvider() {
        return new Web3.providers.WebsocketProvider(this.uri, this.options);
    }

    setup (provider) {
        this.provider = provider;
        this.provider.on('error', () => this.reset());
        this.provider.on('end', () => this.reset());
        this.connecting = false;
    }

    reset() {
        if(this.connecting) return;
        this.connecting = true;
        this.provider.disconnect();

        const connection = setInterval(() => {
            if(!this.connecting) return;

            const provider = this.getProvider();
            provider.on('connect', () => {
                clearInterval(connection);
                this.connecting = false;
                this.setup(provider);
                this.emitter.emit('resetProvider', this.provider);
            });
        }, 500);
    }
}

module.exports = WsProvider;
