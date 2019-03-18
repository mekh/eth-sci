const Interface = require('../../src/lib/interface/interface');
const ERC20 = require('../../src/lib/modules/erc20Interface');
const abi = require('../../src/resources/ERC20/ERC20');

jest.mock('../../src/lib/interface/interface');

describe('ERC20 Interface unit tests', () => {
    it('initiates instance with the default parameters', () => {
        new ERC20('host');
        expect(Interface).toBeCalledWith(
            'host',
            undefined,
            undefined,
            undefined,
            abi,
            undefined
        )
    });

    it('initiates instance with custom parameters', () => {
        const options = [
            'nodeAddress',
            'tokenAddress',
            'mnemonic',
            'web3Instance',
            'tokenAbi',
            'tokenBytecode'
        ];

        new ERC20(...options);

        expect(Interface).toBeCalledWith(...options);
    })
});
