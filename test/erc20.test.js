'use strict';
const fs = require('fs');
const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const {utils, Interface} = require('../src/interface');
const web3 = new Web3(ganache.provider());

const tokenContract = './test/token.sol';

let token, accounts;

const {compile, toWei } = utils;

const getCompiled = async () => {
    const source = fs.readFileSync(tokenContract, 'utf8');
    const compiled = await compile(source);
    return compiled.Token;
};

before(async () => {
    accounts = await web3.eth.getAccounts();
    const compiled = await getCompiled();
    const contractArguments = ["ERC20 token", "ERC20", 18, "10000000000000000000000000"];
    const options = {args: contractArguments};

    token = Interface.web3(web3, null, compiled.abi, compiled.bytecode);
    await token.deploy(options);
});

describe ('ERC20', () => {
    it('deploys a contract', () => {
        assert.ok(token.address);
    });

    it('name', async () => {
        let result = await token.name();
        assert.strictEqual(result, 'ERC20 token');

    });

    it('symbol', async () => {
        let result = await token.symbol();
        assert.strictEqual(result, 'ERC20');

    });

    it('decimals', async () => {
        let result = await token.decimals();
        assert.strictEqual(result, '18');
    });

    it('cap', async () => {
        let result = await token.cap();
        assert.strictEqual(result, toWei('10000000', 'ether'));
    });

    it('totalSupply', async () => {
        let result = await token.totalSupply();
        assert.strictEqual(result, toWei('10000000', 'ether'));
    });

    it('balanceOf owner', async () => {
        let result = await token.balanceOf(accounts[0]);
        assert.strictEqual(result, toWei('10000000', 'ether'));
    });

    it('balanceOf holder', async () => {
        let result = await token.balanceOf(accounts[1]);
        assert.strictEqual(result, '0');
    });

    it('transfer', async () => {
        await token.transfer(accounts[1], toWei('1000', 'ether'));
        const ownerBalance = await token.balanceOf(accounts[0]);
        const holderBalance = await token.balanceOf(accounts[1]);
        assert.strictEqual(ownerBalance, toWei('9999000', 'ether'));
        assert.strictEqual(holderBalance, toWei('1000', 'ether'));

    });

    it('approve', async() => {
        assert.ok(await token.approve(accounts[1], toWei('555', 'ether')));
    });

    it('allowance', async () => {
        const allowance = await token.allowance(accounts[0], accounts[1]);
        assert.strictEqual(allowance, toWei(555, 'ether'))

    });

    it('transferFrom', async ()=> {
        token.wallet = 1;
        assert.ok(await token.transferFrom(accounts[0], accounts[2], toWei(333, 'ether')));
        const balanceFrom = await token.balanceOf(accounts[0]);
        const balanceTo = await token.balanceOf(accounts[2]);
        assert.strictEqual(balanceFrom, toWei(9998667, 'ether'));
        assert.strictEqual(balanceTo, toWei(333, 'ether'));
        assert.strictEqual(await token.allowance(accounts[0], accounts[1]), toWei(222, 'ether'));
    });
});
