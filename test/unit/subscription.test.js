const Subscription = require('../../src/lib/modules/subscription');

describe('Subscription module unit tests', () => {
    let sub,
        obj,
        event,
        options,
        callback,
        args,
        mockUnsubscribe;

    beforeEach(() => {
        event = 'EventName';
        options = {};
        callback = () => {};

        args = [options, callback];

        mockUnsubscribe = jest.fn();

        obj = {
            events: {
                [event]: jest.fn(() => ({ unsubscribe:  mockUnsubscribe}))
            },
            address: '0x0'
        };

        sub = new Subscription(obj, event, ...args);

    });

    it('constructor sets valid properties', () => {
        expect(sub.subscription).not.toBeDefined();
        expect(sub.unsibscribed).not.toBeDefined();
        expect(sub.target).toBe(obj.events);
        expect(sub.address).toBe('0x0');
        expect(sub.event).toBe(event);
        expect(sub.args).toEqual(args);
    });

    it('subscribes to event and passes proper arguments', () => {
        sub.subscribe(event);

        expect(sub.event).toBe(event);
        expect(sub.subscription).toBeDefined();
        expect(sub.unsibscribed).not.toBeDefined();
        expect(obj.events[event]).toBeCalledWith(...args);
    });

    it('removes subscription', () => {
        sub.subscribe(event);
        sub.unsubscribe();


        expect(mockUnsubscribe).toBeCalled();
        expect(sub.unsibscribed).toBe(true);
        expect(sub.subscription).toBeNull();
    });

    it('allows subsequent subscription', () => {
        sub.subscribe(event);
        sub.subscribe(event);

        expect(obj.events[event]).toBeCalled();
    });

    it('skips subscription if unsubscribed', () => {
        sub.subscribe(event);

        sub.unsubscribe();
        sub.subscribe(event);

        expect(obj.events[event]).toBeCalledTimes(1);
    });

    it('throws if no event defined', () => {
        event = null;
        sub = new Subscription(obj, event, ...args);

        expect(() => sub.subscribe()).toThrow('Event is not defined')
    })
});
