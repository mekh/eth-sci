const Ws = require('../../src/lib/providers/wsProvider');
const Web3 = require('web3');
const Events = require('events');

jest.mock('web3');
jest.mock('events');

jest.useFakeTimers();

describe('WsProvider unit tests', () => {
    let ws, provider;

    beforeEach(() => {
        ws = new Ws('host');
        provider = ws.provider;
    });

    it('constructor: creates an instance and sets the properties (no options)', () => {
        expect(ws.uri).toBe('host');
        expect(ws.options).toMatchObject({});
        expect(ws.emitter).toBeInstanceOf(Events);
        expect(ws.connecting).toBe(false);
        expect(ws.provider).toBeInstanceOf(Web3.providers.WebsocketProvider);
        expect(Web3.providers.WebsocketProvider).toBeCalledWith('host', {});
    });

    it('constructor: creates two event listeners', () => {
        expect(provider.on).toBeCalledWith('error', ws.reset);
        expect(provider.on).toBeCalledWith('close', ws.reset);
    });

    it('constructor: sets a provider with options', () => {
        ws = new Ws('host', 'options');
        expect(Web3.providers.WebsocketProvider).toBeCalledWith('host', 'options');
    });

    it('getProvider returns a new provider', () => {
        ws.uri = 'host2';
        ws.options = 'options2';
        ws.getProvider();

        expect(Web3.providers.WebsocketProvider).toBeCalledWith('host2', 'options2');
    });

    it('does not reset the provider if its already being reset', () => {
        ws.connecting = true;
        ws.reset();

        expect(ws.provider.disconnect).not.toBeCalled();
    });

    it('resets provider', () => {
        ws.awaitConnection = jest.fn();

        ws.reset();

        expect(ws.provider.disconnect).toBeCalled();
        expect(ws.awaitConnection).toBeCalled();
    });

    it('clears interval if the provider is already connected', () => {
        ws.getProvider = jest.fn();

        ws.connecting = false;
        ws.awaitConnection();

        jest.runAllTimers();

        expect(clearInterval).toBeCalled();
        expect(ws.getProvider).not.toBeCalled();
    });

    it('sets a new provider', () => {
        ws.getProvider = jest.fn(() => provider);
        ws.onConnectionReady = jest.fn();

        ws.connecting = true;
        ws.awaitConnection();

        jest.runOnlyPendingTimers();

        expect(ws.getProvider).toBeCalled();
        expect(provider.on).toBeCalledWith('ready', expect.any(Function));

        const lastCall = provider.on.mock.calls.length - 1;

        // check the onReady callback;
        provider.on.mock.calls[lastCall][1]();
        expect(ws.onConnectionReady).toBeCalled();

        expect(clearInterval).toBeCalled();
    });

    it('initiates new connection properly', () => {
        ws.addListeners = jest.fn();
        ws.emitter.emit = jest.fn();

        ws.connecting = true;

        ws.onConnectionReady();

        expect(ws.connecting).toBe(false);
        expect(ws.addListeners).toBeCalled();
        expect(ws.emitter.emit).toBeCalledWith('resetProvider', provider);
    });

});
