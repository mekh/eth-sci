'use strict';
const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const testInterface = require('../src/interface').ERC20;
const erc20Abi = require('../src/ERC20');


const web3 = new Web3(ganache.provider());

const abi = JSON.parse('[{"constant":false,"inputs":[{"name":"_admin","type":"address"}],"name":"removeAdmin","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"admins","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_admin","type":"address"}],"name":"addAdmin","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"changeOwner","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"name":"previousOwner","type":"address"},{"indexed":false,"name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"}]');
const bytecode = '0x608060405234801561001057600080fd5b5060008054600160a060020a0319163317905561027b806100326000396000f30060806040526004361061006c5763ffffffff7c01000000000000000000000000000000000000000000000000000000006000350416631785f53c8114610071578063429b62e51461009457806370480275146100c95780638da5cb5b146100ea578063a6f9dae11461011b575b600080fd5b34801561007d57600080fd5b50610092600160a060020a036004351661013c565b005b3480156100a057600080fd5b506100b5600160a060020a0360043516610173565b604080519115158252519081900360200190f35b3480156100d557600080fd5b50610092600160a060020a0360043516610188565b3480156100f657600080fd5b506100ff6101af565b60408051600160a060020a039092168252519081900360200190f35b34801561012757600080fd5b506100b5600160a060020a03600435166101be565b33600160a060020a038216141561015257600080fd5b600160a060020a03166000908152600160205260409020805460ff19169055565b60016020526000908152604090205460ff1681565b600160a060020a03166000908152600160208190526040909120805460ff19169091179055565b600054600160a060020a031681565b6000600160a060020a03821615156101d557600080fd5b60005460408051600160a060020a039283168152918416602083015280517f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09281900390910190a15060008054600160a060020a03831673ffffffffffffffffffffffffffffffffffffffff1990911617905560019190505600a165627a7a723058202264d1fcc16c9f8e092f128e5f6450f6214c702a03944b58bedd32ebce1d2e3f0029';

let contractAddress, accounts;

const randEthAddresses = (n) => {
    if (n <= 0)  return '';
    let addresses = [];
    for (let i = 0; i < n; i++) addresses.push(Web3.utils.randomHex(20));
    addresses = addresses.map(Web3.utils.toChecksumAddress);
    if (n === 1) return addresses[0];
    return addresses;
};

describe ('INTERFACE LIBRARY (positive testing)', () => {
    describe('ContractInterface', async () => {

        it('initialization should return an error if parameters not defined', () => {
           assert.throws(
               () => { new testInterface(); },
               /.*node address is not defined!$/
           );
        });

        it('initialization with web3', () => {
            assert.strictEqual(
                typeof(new testInterface(null, null, null, web3)),
                'object'
            );
        });

        it('initialization with nodeAddress', () => {
            assert.strictEqual(
                typeof(new testInterface('http://localhost:8545')),
                'object'
            );
        });

        it('proxyMethods: create "_sent"', async () => {
            const _callStates = ['pure', 'view'];
            const testAI = await new testInterface(null, null, null, web3, abi);
            const proxyMethods = abi.filter(item => !_callStates.includes(item.stateMutability) && item.type === 'function').map(item => item.name);
            assert.strictEqual(
                JSON.stringify(testAI._sent),
                JSON.stringify(proxyMethods)
            );
        });

        it('proxyMethods: create "_call"', async () => {
            const _callStates = ['pure', 'view'];
            const testAI = await new testInterface(null, null, null, web3, abi);
            const proxyMethods = abi.filter(item => _callStates.includes(item.stateMutability) && item.type === 'function').map(item => item.name);
            assert.strictEqual(
                JSON.stringify(testAI._call),
                JSON.stringify(proxyMethods)
            );
        });

        it('proxyMethods: create "_events"', async () => {
            const testAI = await new testInterface(null, null, null, web3, abi);
            const proxyMethods = abi.filter(item => item.type === 'event').map(item => 'on' + item.name);
            assert.strictEqual(
                JSON.stringify(testAI._events),
                JSON.stringify(proxyMethods)
            );
        });

        it('the number of elements in the proxyMethods is equal to the sum of functions and events in the abi', async () => {
            const testAI = await new testInterface(null, null, null, web3, abi);
            const proxyMethods = abi.filter(item => item.type === 'event' || item.type === 'function');
            proxyMethods.push('_deploy');
            assert.strictEqual(
                Object.keys(testAI.proxyMethods).length,
                Object.keys(proxyMethods).length
            );
        });

        it('deploy', async () => {
            const testAI = await new testInterface(null, null, null, web3);
            testAI.accounts = await web3.eth.getAccounts();
            await testAI.deploy({bytecode: bytecode});
            contractAddress = testAI.address;
            assert.strictEqual(
                Web3.utils.isAddress(contractAddress),
                true
            );
        });

        it('init', async () => {
            const testAI = new testInterface(null, contractAddress, null, web3);
            await testAI.init();
            accounts = await web3.eth.getAccounts();
            assert.strictEqual(
                JSON.stringify(testAI.accounts),
                JSON.stringify(accounts)
            );
        });

        it('getGasPrice(null) must return getGasPrice(1.2)', async () => {
            const testAI = new testInterface(null, contractAddress, null, web3);
            assert.strictEqual(
                Math.floor(await testAI.w3.eth.getGasPrice()),
                await testAI.getGasPrice(null)
            );
        });

        it('getGasPrice(multiplier)', async () => {
            const testAI = new testInterface(null, contractAddress, null, web3);
            const multiplier = Math.floor(Math.random() * 8) + 2; // random int 2..10
            assert.strictEqual(
                Math.floor(await testAI.w3.eth.getGasPrice() * multiplier),
                await testAI.getGasPrice(multiplier)
            );
        });

        it('at(address)', async () => {
            const testAI = new testInterface(null, contractAddress, null, web3);
            const newAddress = randEthAddresses(1);
            testAI.at(newAddress);
            assert.strictEqual(
                testAI._address,
                newAddress
            );
            assert.strictEqual(
                testAI.contract.options.address,
                Web3.utils.toChecksumAddress(newAddress)
            )

        });

        it('set wallet(index)', async () => {
            const testAI = new testInterface(null, contractAddress, null, web3);
            const index = Math.floor(Math.random() * 9) + 1; // random int 1..9
            await testAI.init();
            testAI.wallet = index;
            assert.strictEqual(
                testAI.walletIndex,
                index
            );
        });

        it('get wallet()', async() => {
            const testAI = new testInterface(null, contractAddress, null, web3);
            const index = Math.floor(Math.random() * 9) + 1; // random int 1..9
            await testAI.init();
            testAI.wallet = index;
            assert.strictEqual(
                testAI.wallet,
                accounts[index]
            );
        });

        it('set gasPrice(price)', () => {
            const testAI = new testInterface(null, contractAddress, null, web3);
            const price = Math.floor(Math.random() * 20) + 1; // random int 1..20
            testAI.gasPrice = price;
            assert.strictEqual(
                testAI._gasPrice,
                Web3.utils.toWei(price.toString(), 'gwei')
            )
        });

        it('get gasPrice()', () => {
            const testAI = new testInterface(null, contractAddress, null, web3);
            testAI.gasPrice = Math.floor(Math.random() * 20) + 1;  // random int 1..20
            assert.strictEqual(
                testAI.gasPrice,
                testAI._gasPrice
            )
        });

        it('set address(address)', () => {
            const testAI = new testInterface(null, contractAddress, null, web3);
            const newAddress = randEthAddresses(1);
            testAI.at(newAddress);
            assert.strictEqual(
                testAI._address,
                newAddress
            );
            assert.strictEqual(
                testAI.contract.options.address,
                newAddress
            )
        });

        it('get address()', () => {
            const testAI = new testInterface(null, contractAddress, null, web3);
            assert.strictEqual(
                testAI.address,
                testAI._address
            );
            assert.strictEqual(
                testAI.address,
                testAI.contract.options.address
            );
        });

        it('set abi(abi)', () => {
            const testAI = new testInterface(null, contractAddress, null, web3);
            assert.strictEqual(
                testAI.abi === [],
                false
            );
            testAI.abi = [];
            assert.strictEqual(
                JSON.stringify(testAI.contract.options.jsonInterface),
                JSON.stringify([])
            )
        });

        it('get abi()', () => {
            const testAI = new testInterface(null, contractAddress, null, web3);
            assert.strictEqual(
                JSON.stringify(testAI.abi),
                JSON.stringify(testAI.contract.options.jsonInterface)
            )
        });

    });

    describe('AccessInterface', () => {

        it('abi', () => {
            let testAI = new testInterface(null, null, null, web3, abi);
            assert.strictEqual(
                JSON.stringify(testAI.abi),
                JSON.stringify(abi)
            );
        });

        it('null abi', () => {
            let testAI = new testInterface(null, null, null, web3);
            assert.strictEqual(
                JSON.stringify(testAI.abi),
                JSON.stringify(erc20Abi)
            );
        });

        it('bytecode', () => {
            let testAI = new testInterface(null, null, null, web3, null, bytecode);
            assert.strictEqual(
                testAI.bytecode,
                bytecode
            );
        });

        it('null bytecode', () => {
            let testAI = new testInterface(null, null, null, web3);
            assert.strictEqual(
                testAI.bytecode,
                undefined
            );
        });
    });

    describe('proxyHandler', () => {

        it('get: prop not in abi', () => {
            let testAI = new testInterface(null, null, null, web3, abi);
            testAI.testFunc = () => 'test';
            assert.strictEqual(
                testAI.testFunc(),
                'test'
            );
        });

        it('get: prop in obj', async () => {
            let testAI = new testInterface(null, null, null, web3, abi);
            testAI.accounts  = undefined;
            await testAI.init();
            assert.strictEqual(
                JSON.stringify(testAI.accounts),
                JSON.stringify(accounts)
            );
        });

        it('Error => get: event(no callback or function)', async () => {
            const mc = new testInterface(null, null, null, web3, abi);
            const event = abi.filter(item => item.type === 'event').map(item => 'on' + item.name)[0];
            if (event === undefined) throw new Error('missing event in abi');

            assert.throws(
                () => { mc[event]('123'); },
                /.*callback must be a function!$/,

            );
        });

        it('get: event(callback)', async () => {
            const testAI = new testInterface(null, null, null, web3, abi);
            await testAI.deploy({bytecode: bytecode});
            const event = abi.filter(item => item.type === 'event').map(item => 'on' + item.name)[0];
            const callback = () => {};
            if (event === undefined) throw new Error('missing event in abi');
            let err;
            try {
                testAI[event](callback);
            } catch (e) { err = e; }
            assert.strictEqual(
                err,
                undefined
            );
        });

        it('get: prop(arg, callback) in abi', async () => {
            const testAI = new testInterface(null, null, null, web3, abi);
            await testAI.deploy({bytecode: bytecode});
            const callback = () => {};
            let err;
            try {
                await testAI.addAdmin(randEthAddresses(1), callback);
            } catch (e) { err = e; }
            assert.strictEqual(
                err,
                undefined
            );
        });

        it('get: prop(arg) in abi', async () => {
            const testAI = new testInterface(null, null, null, web3, abi);
            await testAI.deploy({bytecode: bytecode});
            let err;
            try {
                await testAI.addAdmin(randEthAddresses(1));
            } catch (e) { err = e; }
            assert.strictEqual(
                err,
                undefined
            );
        });
    })
});
