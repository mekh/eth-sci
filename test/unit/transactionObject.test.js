const TxObject = require('../../src/lib/modules/transactionObject');

describe('The TransactionObject module unit tests', () => {
    let txMeta,
        obj;

    beforeEach(() => {
        txMeta = {
            id: 1,
            prop1: 1,
            prop2: 2
        };

        obj = new TxObject(txMeta);
    });

    it('creates a new instance', () => {
        Object.keys(txMeta).forEach(key => {
            expect(txMeta[key]).toBe(obj[key])
        });
    });

    it('returns a singleton for a given txMeta.id', () => {
        obj.testProperty = 1;

        const obj2 = new TxObject(txMeta);
        expect(obj2.testProperty).toBe(1);
        console.log(TxObject);
    });

    it('creates a new instance for a new id', () => {
        obj.testProperty = 1;

        const newTxMeta = {id: 2};
        const obj2 = new TxObject(newTxMeta);

        expect(obj.testProperty).toBe(1);
        expect(obj2.testProperty).not.toBeDefined();
        expect(obj2.id).toBe(2);
    })
});
