'use strict';

class Subscription {
    constructor(obj, event, ...args) {
        this.event = event;
        this.target = obj.events;
        this.address = obj.address;
        this.args = args;
    }

    unsubscribe() {
        if (!this.subscription) return;
        this.subscription.unsubscribe();
        this.unsibscribed = true;
        this.subscription = null;
    }

    subscribe(event) {
        if (this.unsibscribed) return;
        if(!event && !this.event) throw new Error('Event is not defined');

        event = event || this.event;
        this.subscription = this.target[event](...this.args);
    }
}

module.exports = Subscription;
