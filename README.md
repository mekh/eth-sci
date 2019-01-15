# Ethereum Smart Contract Interface
A NodeJS library for compiling, deploying, and interacting with the smart contracts.
It is built on top of the [web3](https://www.npmjs.com/package/web3) library.

The sole purpose of this project is to simplify a backend/dAapp development process, as a result, to save tons of time.

In particular, once ABI is passed to the Interface constructor, it automatically determines all the methods and their types,
as well as the events listed within the ABI.
From now on, you're able to call the methods as `instance.methodName(methodArgs)`. As for the events, just add 'on'
prefix before the event name - for example: `instance.onTransfer(callback)`

Table of content:
- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
    - [Unsigned transactions](#unsigned-transactions)
    - [Signed transactions](#signed-transactions)
- [Web3 vs Ethereum Smart Contract Interface](#web3-vs-ethereum-smart-contract-interface)
    - [Web3](#web3)
    - [Smart Contract Interface](#smart-contract-interface)
- [Usage](#usage)
    - [The constructor parameters](#the-constructor-parameters)
    - [Instance attributes](#instance-attributes)
    - [Setters and getters](#setters-and-getters)
    - [Compilation and deployment](#compilation-and-deployment)
        - [Compiler Parameters](#compiler-parameters)
        - [Deployment](#deploy)
        - [Compilation and deployment example](#compilation-and-deployment-example)
            - [Passing arguments to the contract](#passing-arguments-to-the-contract)
            - [Deploying the contract](#deploying)
    - [Customize web3 parameters](#customize-web3-parameters)
    - [Using a custom web3 instance](#using-a-custom-web3-instance)
    - [Runtime events](#runtime-events)
    - [Listening for realtime events](#listening-for-realtime-events)
    - [Retry on fail](#retry-on-fail)
        - [Options](#options)
        - [Gas price calculation](#gas-price-calculation)
        - [Example](#example)
    - [Transaction manager](#transaction-manager)
        - [Nonce calculation](#nonce-calculation)
        - [Transaction queue](#transaction-queue)
        - [Methods and attributes](#methods-and-attributes)
        - [Expenses tracking](#expenses-tracking)
        - [Examples](#examples)
    - [Logging](#logging)
    - [Accessing the underlying Web3 instance](#accessing-the-underlying-web3-instance)
- [Limitations](#limitations)
- [Troubleshooting](#troubleshooting)
    - [Transactions are too slow](#transactions-are-too-slow)
    - [Error: Exceeds block gas limit](#error-exceeds-block-gas-limit)
    - [Error: Cannot find module 'ethereumjs-wallet/hdkey'](#)
    - [The compiler fails with 'Source file requires different compiler version' error](#)
- [License](#license)


## Features
- extremaly easy to [setup](#installation) and [use](#quick-start)
- suitable for **any smart contract**
- all-in-one library, it includes methods for [compilation](#compilation), [deployment](#deployment), and [working](#usage) with contract's methods and events
- automatic [nonce calculation](#nonce-calculation) and tracking - no more 'await' or nonce calculation routines before each next transaction
- gas/eth [expenses tracking](#expenses-tracking)
- supports http(s), ws(s), and ipc protocols
- supports mnemonic and a private key(s) [authorization](#signed-transactions) types
- automatically applies a proper provider depending on the protocol type and/or authorization method (http or wss, mnemonic or private key, etc)
- allows using [custom web3-instances](#using-a-custom-web3-instance)
- automatically restores WebSocket connections/subscriptions
- contains a ['retry-on-fail'](#retry-on-fail) option for the send-type transactions
- with the retry option, you're able to use the same wallet in different application simultaneously, no more 'nonce too low' errors
- it's suitable for both backend and frontend

## Installation
```bash
$ npm install --save eth-sci
```

## Quick start
### Unsigned transactions
```javascript
const { ERC20 } = require('eth-sci');

const token = new ERC20(
    'https://mainnet.infura.io/v3/<API_KEY>',
    '0x45F1F44dE1...'
);

// Resolve a promise
token.totalSupply().then(console.log);
token.name().then(console.log);

// Callback
token.symbol((err, res) => console.log(err, res));

// async-await
const checkBalance = async address => {
    return await token.balanceOf(address);
};

checkBalance('0x4b32C...').then(console.log);
```

### Signed transactions
In order to be able to alter the contract state, you have to pass either a mnemonic or a private key (an array of keys) to the constructor:
```javascript
const { ERC20 } = require('eth-sci');
const mnemonic = '12 words mnemonic';

// 0x-prefix is allowed as well
const privateKey = '16ac46b....'; // 32-bytes private key;

// an array of private keys - both plain and '0x'-prefixed keys are allowed
const keysArray = [
    '0xAbc...', // 0x-prefix
    'Bcd...',   // no prefix
    '0xCde'     // 0x-prefix
]

const token = new ERC20(
    'https://mainnet.infura.io/v3/<API_KEY>',
    '0x45F1F44dE1...',
    mnemonic // or `privateKey`, or `keysArray`
);

const transfer = async (callback) => {
    const balance = await token.balanceOf(token.wallet);
    return await token.transfer('0x91a5...', balance);
};

transfer((err, res) => console.log(`${err ? 'Fail' : 'Success'}`));
```

## Web3 vs Ethereum Smart Contract Interface
Here is an implementation of 'transfer' and 'balanceOf' methods using a native Web3 syntax and the Interface's one.

The constants are the same for both implementations:
```javascript
const nodeAddress = 'https://mainnet.infura.io/v3/<API_KEY>';
const contractAddress = '0xB4239d61FE...';
const testWallet = '0x47573c6661...';
const mnemonic = "12 words mnemonic";
```

### Web3
```javascript
const Web3 = require('web3');
const HDWalletProvider = require('truffle-hdwallet-provider');
const abi = require('./token-abi');

const provider = new HDWalletProvider(mnemonic, nodeAddress);
const web3 = new Web3(provider);

const contract = new web3.eth.Contract(abi, contractAddress);

contract.methods.balanceOf(testWallet)
    .call()
    .then(console.log);

web3.eth.getAccounts().then(accounts => {
    contract.methods.transfer(testWallet, 100)
        .send({from: accounts[0]})
        .then(r => {
            provider.engine.stop();
            console.log(r);
        })
});
```

### Smart Contract Interface
```javascript
const { ERC20 } = require('eth-sci');

const token = new ERC20(nodeAddress, contractAddress, mnemonic);

token.balanceOf(testWallet).then(console.log);
token.transfer(testWallet, 100).then(console.log);
```

## Usage
Following modules are being exported by the library:

- Interface - general-purpose class. Use it as the parent class for your subclasses
- Web3 - returns the web3 instance activated by a provider. The type of the provider is defined out of the protocol type (web socket, http, ipc). Supports mnemonic and a private key(s) authorization types.
- ERC20 - derived from the Interface class; can be used for accessing the ERC20 tokens' standard methods (name, symbol, totalSupply, etc.)
- utils - a set of utils that includes a 'compile' module - it compiles the source code and returns an object containing abi and bytecode
- setLogger - a function that sets a logger (see below)

It supports both promises and the async-await calls with or without the callbacks.

By default, the ERC20 class instance is initialized with a standard ERC20 abi.

The following methods are supported out of the box:
- `name()`
- `symbol()`
- `decimals()`
- `totalSupply()`
- `cap()`
- `balanceOf(address)`
- `transfer(to, amount)`
- `transferFrom(from, to, amount)`
- `approve(spender, amount)`
- `allowance(owner, spender)`
- `mint(to, amount)`

Events:
- `Transfer(from, to, amount)`
- `Approval(owner, spender, amount)`
- `Mint(to, amount)`
- `Burn(burner, amount)`

### The constructor parameters:

| Parameter | Type | Default | Required | Description |
| ------ | ---- | ------- | ----------- | ----------- |
|`nodeAddress`|string|null|true|Ethereum node URI (http://, ipc://, etc)|
|`contractAddress`|address|null|false|contract address|
|`authKey`|string\|hex-string\|array of hex-strings|null|false|12-words mnemonic, a private key or an array of them|
|`web3Instance`|Web3|null|false|a custom Web3 instance|
|`abi`|array|ERC20|false|an ABI|
|`bytecode`|hex-string|null|false|"0x"-prefixed bytecode|

### Instance attributes:

| Attribute | Default | Description |
| ------ | ------- | ----------- |
|`w3`|-|Web3 instance; can be used for direct access to the native Web3 methods and attributes|
|`gasLimit`|6000000|the gasLimit, it's being used as the 'gas' parameter of send-type transactions|
|`gasUsed`|undefined|the number of gas units used by the latest transaction|
|`accounts`|-|the list of wallets addresses provided by truffle-hdwallet or custom web3 instance (web3.eth.getAccounts())|
|`wallet`|accounts\[0\]|currently active wallet address; it is used as a 'from' parameter|
|`gasPrice`|blockChain gasPrice * 1.2|the gasPrice for a particular transaction|
|`address`|-|address of the contract|
|`abi`|-|contract's ABI|
|[`txManager`](#transaction-manager)|TransactionManager|the transaction manager class instance|


### Setters and getters

**`at`** - setter; sets an address at `this.contract.options.address`

```javascript
const token = new ERC20('https://mainnet.infura.io/v3/<API_KEY>');
token.at('0xB8c77482e45F1F44dE1745F52C74426C631bDD52');
token.name().then(console.log); // VeChain Token
```

**`wallet`** - setter/getter; getter returns a currently active wallet address, setter accepts a wallet index and sets the address accordingly
   ```javascript
   console.log(token.accounts); // ['0xAbc..', '0xBcd...', '0xCde', ...., '0xfab']
   console.log(token.wallet); // '0xAbc..'

   this.wallet = 2;
   console.log(token.wallet); // '0xCde'
   ```

**`gasPrice`** - setter/getter; getter returns a value in WEI, setter accepts it in **g**WEI; The default value in `null` which means that
it will be calculated upon a transaction as gas price provided by the blockchain multiplied by 1.2:
   ```javascript
   console.log(token.gasPrice); // null

   token.gasPrice = 4.567;      // value in gWei
   console.log(token.gasPrice); // 4567000000
   ```

**`abi`** - setter/getter; getter returns this.contract.options.jsonInterface, setter sets the ABI at the same path; can be used for changing ABI dynamically:
   ```javascript
    const { ERC20 } = require('eth-sci');
    const token = new ERC20(nodeAddress, contractAddress, mnemonic);
    token.addAdmin('0xAbc...'); // TypeError: token.addAdmin is not a function

    // a new function defenition
    const addAdmin = {
        "constant": false,
        "inputs": [{ "name": "_newAdminAddress", "type": "address" }],
        "name": "addAdmin",
        "outputs": [{ "name": "", "type": "bool" }],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    };

    // adding new function to the ABI
    token.abi = [...token.abi, addAdmin];

    // calling the method
    token.addAdmin('0xAbc...', (err, res) => {
        if(err) console.log(err);
        else console.log('Success')
    }); // Success
   ```

### Compilation and deployment
The compiler is an async function exported by the `utils` module while the `deploy` is the
method provided by the Interface class.

##### Compiler Parameters
The compiler requires two arguments:
- the source code (required)
- callback (optional)

```javascript
const fs = require('fs');
const { utils } = require('eth-sci');

const sourceCode = fs.readFileSync('./contract.sol', 'utf-8');
utils.compile(sourceCode[, callback]);
```

##### Returns
The compiler returns an object with the following structure:
```
{
    Contract1 : { abi: [...], bytecode: "0x..." },
    Contract2 : { abi: [...], bytecode: "0x..." },
    ...
    ContractN : { abi: [...], bytecode: "0x..." }
}
```

#### Deploy
The `deploy` method accepts an optional object and optional callback function.
```javascript
contract.deploy([options][, callback]);
```

#### Parameters
- `options` (`Object`, optional):
    - `args` (`Array`, optional): arguments to be passed to the smart contract constructor
    - `nonce` (`Number`, optional): nonce to use for the transaction
    - `from` (`String`, optional): an address the transaction will be sent from
    - `gasPrice` (`Number`, optional): the gas price in wei to use for transactions
- `callback` (`Function`, optional): will be fired with the result of the deployment - an instance of the Interface class
as the second argument or an error object as the first one

#### Compilation and deployment example
---
For example, we're about to deploy this contract:
```
contract ERC20Token {
    uint public totalSupply;
    uint public decimals;
    string public name;
    string public symbol;
    ...
}

contract Ownable is ERC20Token{
    address public owner;

    modifier auth() {
        require(msg.sender == owner);
        _;
    }

    constructor() public {
        owner = msg.sender;
    }
    ...
}

contract Token is Ownable {
    constructor(
        string memory _name,
        string memory _symbol,
        uint _decimals,
        uint _totalSupply
    ) public {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _totalSupply;
    }
    ...
}

```

##### Passing arguments to the contract
In the [example above](#contract-source-code), the Token contract constructor requires 4 positional arguments:
- name
- symbol
- decimals
- totalSupply

Those parameters should be passed as `args` key of the `options` object
```javascript
const contractArguments = [name, symbol, decimals, totalSupply];
const options = {args: contractArguments};
...
contract.deploy(options);

```

##### Deploying
In order to compile and deploy the 'Token' contract:
```javascript
const fs = require('fs');
const { utils, Interface } = require('eth-sci');

const source = fs.readFileSync('./contract.sol', 'utf-8');
const mnemonic = "12 words mnemonic...";
const nodeAddress = 'https://mainnet.infura.io/v3/<API_KEY>';

// Smart Contract arguments should be passed as an array
const contractArguments = ["Token Name", "TKN", 18, "100000000000000000000"];
const options = {args: contractArguments};

// Compilation
const compile = async (sourceCode) => {
    const compiled =  await utils.compile(sourceCode);
    return compiled.Token;
};

// The 'compile' function returns an object with two key-value pairs: { abi: [], bytecode: "0x..." }
const deploy = async ({ abi, bytecode }) => {
    const contract = new Interface(nodeAddress, null, mnemonic, null, abi, bytecode);

    // Smart contract arguments are included to the 'options' object as { args: [] }
    await contract.deploy(options);
    return contract;
};

const getInfo = async (contract) => {
    return {
        address: contract.address,
        name: await contract.name(),
        symbol: await contract.symbol(),
        decimals: await contract.decimals(),
        totalSupply: await contract.totalSupply()
    }
};

compile(source)
    .then(deploy)
    .then(getInfo)
    .then(console.log);

/* The output:
{ address: '0x4aA3852beCfD117f19FEdF3d0d61678f5B3e5103',
  name: 'Token Name',
  symbol: 'TKN',
  decimals: '18',
  totalSupply: '100000000000000000000' }
**/
```

Once the contract is deployed, the contract instance gets the address automatically, so it's completely ready to work.

### Customize web3 parameters
It is possible to replace any parameter used by the underlying web3 provider - i.e. `nonce`, `data`, `gasPrice`, `gas`, `from`, and `value`.
Just pass an object with key-value pairs as the last argument (if there is no callback), or right before the callback:

```javascript
const params = {
    from: token.accounts[1],  // sender's address
    gas: '40000',             // gas limit
    gasPrice: '5200000000'    // gas price in Wei
    nonce: 101                // set nonce
};

token.tokenMethod('0xAbc', 100, params).then(...);

// using a callback
token.tokenMethod('0xAbc', 100, params, (err, res) => {
    // your code here
});

// call-type methods work the same
token.someRestrictedMethod({from: token.accounts[2]}).then(r => {
    // your code here
});
```

The last line of the example above is equal to:
```javascript
token.wallet = 2;
token.someRestrictedMethod().then(...);
```

See the [sendTransaction](https://web3js.readthedocs.io/en/1.0/web3-eth.html#sendtransaction)
and
[methods.myMethod.call](https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#methods-mymethod-call) methods description.

### Using a custom web3 instance

There is a static method - `web3`. It accepts:
- web3-instance (required)
- contract address (optionally)
- abi (required)
- bytecode (optionally)

Can be used in `mocha` test framework:
```javascript
const Web3 = require('web3');
const ganache = require('ganache-cli');
const { Interface } = require('eth-sci');
const { abi, bytecode } = require('./compiled.json');

const web3 = new Web3(ganache.provider());

const token = Interface.web3(web3, null, abi, bytecode);
```

### Runtime events
There are three types of events are being emitted upon sending a transaction:
- transactionHash
- receipt
- error

```javascript
contract.myMethod(methodArguments)
    .on('transactionHash', h => console.log(`TxHash: ${h}`)
    .on('receipt', r => console.log(`Receipt: ${r}`)
    .on('error', e => console.log(`Erorr: ${r}`)
    .then(() => console.log('Done')
    .catch(() => console.log('Fail');
```

[More info](https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#methods-mymethod-send)

### Listening for realtime events
There are two mandatory requirements:
- the instance must be initialized with 'ws' or 'wss' address
- the callback is strictly required

For any event that defined in ABI of the smart contract, add an 'on'-prefix before the event name and pass optional parameters and a callback.
For example, there is a smart contract that contains:
```
event MyEvent(address indexed _addr, uint _value);

function myFunc(address _addr, uint _value) public returns(bool) {
    ...
    emit MyEvent(_addr, _value);
    ...
}
```

Subscribe to 'MyEvent':
```javascript
const contract = new Interface('wss://mainnet.infura.io/ws/v3/<API_KEY>', '0xAbC...');
contract.onMyEvent({}, (err, res) => { });
```

The `callback` is called each time the `MyEvent` is fired;

[More info](https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#contract-events)

### Retry-on-fail
#### Options
For any send-type transaction, it is possible to define a 'retryOptions' object with the following parameters:
- `retry` (`Number`, optional): Integer, the maximum number of retries. **Default value:** 3
- `gasPrice` (`String`, optional): the initial value of the gasPrice in Wei. **Default value:** [web3.eth.getGasPrice()](https://web3js.readthedocs.io/en/1.0/web3-eth.html#getgasprice) * 1.2
- `delay` (`Number`, optional): the delay in seconds before each next attempt. **Default value:** 10
- `verify` (`Function`, optional): a function that will be executed before each next retry. **Default value:** null
- `incBase` (`Number`, optional): the base of the exponential expression that defines the gasPrice on each next retry. **Default value:** 1

The `verify` function (if defined) will get all the arguments that were passed to the original contract's method.

In the `incBase` > 1, the `gasPrice` will be increased on each next iteration as `gasPrice = gasPriceBase * incBase ** count`

#### Gas price calculation
If the initial `gasPrice` is **3gWei**, and the `incBase` has a value **1.3**, the gasPrice will be changed as

|retry #|equation|gasPrice|
|---|---|---|
|0|3 * 1.3^0|3|
|1|3 * 1.3^1|3.9|
|2|3 * 1.3^2|5.07|
|3|3 * 1.3^3|6.591|
|4|3 * 1.3^4|8.5683|

In order to keep the gasPrice invariable, set the `incBase` to 1.

#### Example
A contract:
```solidity
...
    mapping (address => bool) public users;

    function addUser(address _user) public {
        require(!users[_user]);
        users[_user] = true;
    }

    function isUser(address _user) public {
        return users[_user];
    }
...
```
In the example above, an address can be set as 'user' only once. Every subsequent attempt will fail.
By default, web3 has a timeout - the transaction will be rejected by web3 if it hasn't been mined in 750 seconds.
But, as a matter of fact, the timeout doesn't mean that the transaction has not been mined - timeout could be caused by network latency, bugs, etc.
In this case, if the `retryOptions` is defined with no `verify` function, the library will be trying to send the transaction until the maximum number of retries is reached.
In order to eliminate such behavior, define the `verify` function as follows:
```javascript
const options = {
    verify: async user => await contract.isUser(user)
}

contract.addUser('0xABC...', { retryOptions: options });
```

Once the very first transaction is failed and the `delay` period has expired, the code will call the `verify` function and:
- will return the result if `verify` returned true;
- will resend a transaction otherwise

### Transaction manager
The transaction manager tracks nonces, keeps the transaction history, total and per-transaction gas and eth expenses, defines the transaction types, sends transactions to the blockchain, etc.
It can be accessed via `txManager` property of the Interface instance.

#### Nonce calculation
The transaction manager is tracking nonces for every wallet in use. Based on the local history and the information provided
by the blockchain ([`getTransactionCount`](https://web3js.readthedocs.io/en/1.0/web3-eth.html#eth-gettransactioncount)),
it calculate a nonce and automatically adds it to the transaction parameters. However, it's possible to set the [nonce manually](#customize-web3-parameters).

#### Transaction queue
There is a limit of 100 transactions that were sent to the blockchain but haven't been mined yet. Once the limit is reached,
all subsequent transactions will be queued until a free slot appeared. The manager checks the number of submitted transactions every minute.

#### Methods and attributes
- `getTxStat()` - returns an object with key-value pairs:
    - `submitted` - the number of transactions that were sent to the blockchain but haven't been mined yet
    - `pending` - pending - the number of transactions that have been passed to the txManager but haven't been sent to the blockchain
    - `failed` - the number of failed transactions
    - `confirmed` - the number of confirmed transaction (i.e. mined ones)
    - `retries` - the total number of retries attempted for failed transactions
    - `totalGasUsed` - the total number of 'gas' units spent
    - `totalEthSpent` - the total amount of ETH spent
- `totalGasUsed` - see above
- `totalEthSpent` - see above

#### Expenses tracking
The `totalEthSpent` is being increased as `totalEthSpent` += `gasPrice` * `gasUsed`.

`gaUsed` is an Interface instance property; it indicates the number of gas units that have been used by the latest transaction.

#### Examples
```javascript
token.gasPrice = 10;  // set a higher gasPrice to get the transaction mined faster
const testWallet = '0xABC...';

const test = async () => {
    const promises = [];

    await token.transfer(testWallet, 100);
    // print the number of gas that was used by the transaction above
    console.log(token.gasUsed);

    console.log(JSON.stringify(token.txManager.getTxStat()));


    // send 5 transaction in one batch, all of them will be (most probably) mined within a single block
    for(let i=0; i<5; i++) {
        promises.push(new Promise(async (resolve, reject) => {
            await token.transfer(testWallet, 100);
            console.log(JSON.stringify(token.txManager.getTxStat()));
            resolve();
        }));
    }

    await Promise.all(promises)
};

test();
```
The output:
```javascript
37186
{"submitted":0,"pending":0,"failed":0,"confirmed":1,"retries":0,"totalGasUsed":"37186","totalEthSpent":"0.00037186"}
{"submitted":4,"pending":0,"failed":0,"confirmed":2,"retries":0,"totalGasUsed":"74372","totalEthSpent":"0.00074372"}
{"submitted":3,"pending":0,"failed":0,"confirmed":3,"retries":0,"totalGasUsed":"111558","totalEthSpent":"0.0011155800000000001"}
{"submitted":2,"pending":0,"failed":0,"confirmed":4,"retries":0,"totalGasUsed":"148744","totalEthSpent":"0.00148744"}
{"submitted":1,"pending":0,"failed":0,"confirmed":5,"retries":0,"totalGasUsed":"185930","totalEthSpent":"0.0018593"}
{"submitted":0,"pending":0,"failed":0,"confirmed":6,"retries":0,"totalGasUsed":"223116","totalEthSpent":"0.00223116"}
```

There are the methods for retrieving individual items of the stat. All of them accept an optional argument -
an address of wallet the transactions have been sent from:
- getFailedTransactions(\[address\])
- getConfirmedTransactions(\[address\])
- getPendingTransactions(\[address\])
- getSubmittedTransactions(\[address\])

```javascript
token.gasPrice = 10;

const getStat = address => token.txManager.getConfirmedTransactions(address).length;

const test = async () => {
    await token.transfer(testWallet, 100);
    console.log(token.wallet, getStat(token.wallet));

    token.wallet = 1;
    await token.transfer(testWallet, 100);
    console.log(token.wallet, getStat(token.wallet));
    console.log('Total: ', getStat())
};

test();
```

The output:
```
0xc9E6D574... 1
0xa9C5Eb93... 1
Total: 2
```

### Logging
TODO

### Accessing the underlying Web3 instance

All the methods/attribute that is being provided by the Web3 library are accessible through the 'w3' attribute.

```javascript
const { Interface } = require('eth-sci');
...
const contract = new Interface(nodeAddress, contractAddress, mnemonic);

const web3 = contract.w3;

// get a transaction receipt
contract.w3.eth.getTransactionReceipt("0x...").then(...);

// get a nonce at block 7063638
contract.w3.eth.getTransactionCount("0xABC...", 7063638).then(...);

//get gasPrice
contract.w3.eth.getGasPrice().then(...);

// send 1 ETH
contract.w3.eth.sendTransaction({
    from: contract.accounts[0],
    to: "0xABC...",
    value: contract.w3.utils.toWei(1, 'ether');
});

// accessing events - we3.eth.Contract().events are binded to this.events;
contract.events.MyEvent([options][, callback])

```
See the [official web3.js documentation](https://web3js.readthedocs.io/en/1.0/index.html)

## Limitations
- the library does not support 'HTTP Basic Authentication' for the web3 lib. Fell free to contact me or make a pool request.
As a workaround, you may create a native Web3 class instance and pass it to the library constructor. [More info](#using-a-custom-web3-instance)


## Troubleshooting
### Transactions are too slow
Increase a gas price:
```javascript
const { ERC20 } = require('eth-sci');
const token = new ERC20(...);
...
token.gasPrice = 3; // in gWei
...
```

### Error: Exceeds block gas limit
Decrease the gasLimit:
```javascript
const { ERC20 } = require('eth-sci');
const token = new ERC20(...);
...
token.gasLimit = '3000000'
...
```

### Error: Cannot find module 'ethereumjs-wallet/hdkey'
```bash
$ npm uninstall ethereumjs-wallet
$ npm install ethereumjs-wallet@0.6.0
```

### The compiler fails with 'Source file requires different compiler version' error
First of all, stay on top of things and don't use obsolete technologies, consider to align your project in accordance with the most recent requirements.

The 'compile' module uses 'solc' version 0.5.x. If your pragma parameter is set to something like '^0.4.23', plese try to change it to '>=0.4.23'.

Also, check the [Solidity v0.5.0 Breaking Changes](https://solidity.readthedocs.io/en/v0.5.0/050-breaking-changes.html) list.


## License

[GPL-2.0](https://opensource.org/licenses/GPL-2.0 "GNU General Public License version 2")
