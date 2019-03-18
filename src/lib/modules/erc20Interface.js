'use strict';

const Interface = require('../interface');
const erc20 = require('../../resources/ERC20/ERC20');


class ERC20 extends Interface {
    constructor(nodeAddress, tokenAddress, mnemonic, web3Instance, abi, bytecode) {
        abi = abi || erc20;
        super(nodeAddress, tokenAddress, mnemonic, web3Instance, abi, bytecode);
    }
}

module.exports = ERC20;
