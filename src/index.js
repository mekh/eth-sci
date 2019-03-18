'use strict';

const Interface = require('./lib/interface');
const ERC20 = require('./lib/modules/erc20Interface');
const Web3 = require('./lib/modules/web3');
const utils = require('./lib/utils');

module.exports = {
    Interface,
    Web3,
    ERC20,
    utils
};
