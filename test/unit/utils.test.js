const solc = require('solc');
const utils = require('../../src/lib/utils');
const web3Utils = require('web3-utils');

jest.mock('solc');
jest.mock('web3-utils');

jest.useFakeTimers();

describe('Utils unit tests', () => {
    describe('Compiler', () => {
        let solcResp,
            fnResponse;

        beforeEach(() => {
            const solcContracts = {
                contract: { TestContractName: { abi: ['0'], evm: { bytecode: { object: '0' }}}}
            };

            const solcErrors = [];

            solcResp = {
                errors: solcErrors,
                contracts: solcContracts
            };

            fnResponse = { TestContractName: { abi: ['0'], bytecode: "0x0" }};
        });

        it('returns the expected abi and bytecode', () => {
            solc.compile.mockResolvedValue(JSON.stringify(solcResp));

            return utils.compile().then(r => expect(r).toEqual(fnResponse))
        });

        it('returns null if an error has occurred', () => {
            solcResp.errors = [{formattedMessage: 'Error'}];

            solc.compile.mockResolvedValue(JSON.stringify(solcResp));

            return utils.compile({}, () => {}).then(res => expect(res).toBeNull())
        })
    });

    describe('returnValue', () => {
        let error,
            result,
            defer,
            callback;

        beforeEach(() => {
            error = undefined;
            result = 'A';

            defer = new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 100);
            });

            defer.listeners = () => [];
            defer.removeAllListeners = () => {};
            defer.resolve = jest.fn();
            defer.reject = jest.fn();
            defer.catch = jest.fn();
            callback = jest.fn((err, res) => [err, res]);
        });

        it('returns a result if there are no callback and defer defined', () => {
            expect(utils.returnValue(error, result)).toBe(result)
        });

        it('throws if there are no callback and defer defined', () => {
            error = 'E';
            expect(() => utils.returnValue(error)).toThrow(error);
        });

        it('calls a callback and returns a value if defer is not defined', () => {
            expect(utils.returnValue(error, result, callback)).toBe(result);
            expect(callback.mock.calls.length).toBe(1);
            expect(callback.mock.results[0].value).toEqual([error, result]);
        });

        it('calls a callback and defer.resolve() if defer is define', () => {
            expect(utils.returnValue(error, result, defer, callback)).toBeUndefined();
            expect(callback.mock.calls.length).toBe(1);
            expect(callback.mock.results[0].value).toEqual([error, result]);

            expect(defer.resolve.mock.calls.length).toBe(1);
            expect(defer.resolve.mock.calls[0][0]).toBe(result);
        });

        it('does not throw if callback is defined', () => {
            error = 'E';
            expect(() => utils.returnValue(error, result, callback)).not.toThrow();

            expect(callback.mock.calls.length).toBe(1);
            expect(callback.mock.results[0].value).toEqual([error, result]);
        });

        it('does not throw if callback and defer are defined', () => {
            error = 'E';

            expect(() => utils.returnValue(error, result, defer, callback)).not.toThrow();

            expect(callback.mock.calls.length).toBe(1);
            expect(callback.mock.results[0].value).toEqual([error, result]);
        });

        it('sets the catch function if an error listener is defined', () => {
            error = 'E';
            defer.listeners = () => ['error'];

            utils.returnValue(error, result, defer);

            jest.runAllTimers();

            expect(defer.catch).toBeCalled();
            expect(defer.reject).toBeCalled();
        })

    });

    describe('FixedLengthArray', () => {
        let array;

        beforeEach(() => {
            array = new utils.FixedLengthArray(1);
        });

        it('adds an item to array', () => {
            array.push(1);
            expect(array[0]).toBe(1);
        });

        it('returns true if array has an item', () => {
            array.push(1);
            expect(array.has(1)).toBe(true);
        });

        it('returns false if array has no item', () => {
            array.push(1);
            expect(array.has(2)).toBe(false);
        });

        it('truncates the array if lengthLimit is defined and reached', () => {
            array.push(1);
            array.push(2);
            expect(array.length).toBe(1);
        });

        it('does not truncate the array if the lengthLimit is not defined', () => {
           array = new utils.FixedLengthArray();
           [1, 2, 3].forEach(x => array.push(x));
           expect(array.length).toBe(3);
        });

        it('does not truncate the array if the limit is defined but not reached', () => {
            array = new utils.FixedLengthArray(5);
            [1, 2, 3].forEach(x => array.push(x));
            expect(array.length).toBe(3);
        });

        it('does not push an item if it already exists and the unique parameter is true', () => {
            array = new utils.FixedLengthArray(3, true);
            [1, 1, 1].forEach(x => array.push(x));
            expect(array.length).toBe(1);
        });

        it('removes the items properly if the limit is reached', () => {
            array = new utils.FixedLengthArray(3);
            [1, 2, 3, 4, 5].forEach(x => array.push(x));
            expect(JSON.parse(JSON.stringify(array))).toMatchObject([3, 4, 5]);
        });

        it('adds a new item if the item is unique', () => {
            array = new utils.FixedLengthArray();
            array.add(1);
            array.add(2);
            [1, 2].forEach(x => expect(array.has(x)));
        });

        it('does not add an item if it already exists', () => {
            array = new utils.FixedLengthArray();
            array.add(1);
            array.add(1);
            expect(array.length).toBe(1)
        });

    });

    describe('epochToDateString', () => {
        it('returns a proper string representation of 0', () => {
            expect(utils.epochToDateString(0)).toMatch(/1970.01.01.00.00.00/)
        });

        it('returns a proper string representation', () => {
            const epoch = 1552724452;
            expect(utils.epochToDateString(epoch)).toMatch(/2019.03.16.08.20.52/)
        })
    });

    describe('web3-utils', () => {
        web3Utils.fromWei = jest.fn();
        web3Utils.toWei = jest.fn();

        it('fromWei', () => {
            utils.fromWei(100, 'gwei');
            expect(web3Utils.fromWei).toBeCalledWith("100", 'gwei')
        });

        it('toWei', () => {
            utils.toWei(100, 'gwei');
            expect(web3Utils.toWei).toBeCalledWith("100", 'gwei')
        });

        it('toToken, decimals is 18', () => {
            utils.toToken(100, 18);
            expect(web3Utils.fromWei).toBeCalledWith("100", undefined)
        });

        it('toToken, decimals is 10', () => {
            utils.toToken(100, 10);
            expect(web3Utils.fromWei).toBeCalledWith("10000000000", undefined);
        })

    });

    describe('_to', () => {
        const promiseResolve = data => new Promise(resolve => resolve(data));
        const promiseReject = data => new Promise((resolve, reject) => reject(data));

        it('resolves a promise', () => {
            const arg = 1;
            return expect(utils._to(promiseResolve(arg))).resolves.toMatchObject([null, arg]);
        });

        it('catches the rejected promise', () => {
            const err = 'e';
            return expect(utils._to(promiseReject(err))).resolves.toMatchObject([err, null]);
        })
    });

    describe('sleep', () => {
        it('calls setTimeout properly', () => {
            utils.sleep(10);
            expect(setTimeout).toBeCalledWith(expect.any(Function), 10);
        })
    });
});

