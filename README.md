## Ethereum Smart Contract Interface
A NodeJS library for compiling, deploying, and interacting with the smart contracts.
It is built on top of the [web3](https://www.npmjs.com/package/web3) library.

The sole purpose of this library is to simplify a backend/dAapp development process, as a result, to save tons of time.

In particular, once ABI is passed to the Interface constructor, it automatically determines all the methods and their types,
as well as the events listed within the ABI.
From now on, you're able to call the methods as `instance.methodName(args)`. As for the events, just add 'on'
prefix before the event name - for ex. `instanse.onTransfer(callback)`

Key features:
- Extremaly easy to setup and use
- All-in-one library, it includes methods for compilation, deployment, and working with a contract's methods and events
- Automatic nonce calculation and tracking - no more 'await' or (semi)manual nonce calculation before each next transaction
- gas/eth expenses tracking
- supports http(s), ws(s), and ipc protocols
- supports mnemonic and a private key(s) authorization types
- automatically applies a proper provider depending on the protocol type and/or authorization method (http or wss, mnemonic or private key, etc)
- allows using custom web3-instances
- automatically restores WebSocket connections/subscriptions
- contains a 'retry-on-fail' option for the send-type transactions
- with the retry option, you're able to use the same wallet in different application simultaneously, no more 'nonce too low' errors
- it's suitable for both backend and frontend

### Web3 vs Ethereum Smart Contract Interface
---
Here is an implementation of 'transfer' and 'balanceOf' methods using a native Web3 syntax and the Interface's one.

The constants are the same for both implementations:
```javascript
const nodeAddress = 'https://mainnet.infura.io/v3/<API_KEY>';
const contractAddress = '0xB4239d61FE...';
const testWallet = '0x47573c6661...';
const mnemonic = "12 words mnemonic";
```

##### Web3
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

##### Ethereum Smart Contract Interface
```javascript
const { ERC20 } = require('eth-sci');

const token = new ERC20(nodeAddress, contractAddress, mnemonic);

token.balanceOf(testWallet).then(console.log);
token.transfer(testWallet, 100).then(console.log);
```


## Install
```bash
$ npm install eth-sci
```

## USAGE
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

The constructor parameters:
---
| Parameter | Type | Default | Required | Description |
| ------ | ---- | ------- | ----------- | ----------- |
|`nodeAddress`|string|null|true|Ethereum node URI (http://, ipc://, etc)|
|`contractAddress`|address|null|false|contract address|
|`authString`|string\|hex-string|null|false|12-words mnemonic or a private key|
|`web3Instance`|Web3|null|false|a custom Web3 instance|
|`abi`|array|ERC20|false|an ABI|
|`bytecode`|hex-string|null|false|a bytecode|

Instance attributes:
--------------------
| Attribute | Default | Description |
| ------ | ------- | ----------- |
|w3|-|Web3 instance; can be used for direct access to the native Web3 methods and attributes|
|gasLimit|6000000|the gasLimit, it's being used as the 'gas' parameter of send-type transactions|
|accounts|-|the list of wallets addresses provided by truffle-hdwallet or custom web3 instance (web3.eth.getAccounts())|
|wallet|accounts\[0\]|currently active wallet address; it is used as a 'from' parameter|
|gasPrice|blockChain gasPrice * 1.2|the gasPrice for a particular transaction|
|address|contract address|address of the contract|
|abi|-|an ABI|


Setters and getter:
-------------------

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

   token.gasPrice = 4.567;
   console.log(token.gasPrice); // 4567000000
   ```

**`abi`** - setter/getter; getter returns this.contract.options.jsonInterface, setter sets the ABI at the same path; can be used for changing ABI dynamically:
   ```javascript
    const { ERC20 } = require('eth-sci');
    const token = new ERC20(nodeAddress, contractAddress, mnemonic);
    token.addAdmin('0xAbc...'); // TypeError: token.addAdmin is not a function

    const addAdmin = {
        "constant": false,
        "inputs": [{ "name": "_newAdminAddress", "type": "address" }],
        "name": "addAdmin",
        "outputs": [{ "name": "", "type": "bool" }],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    };

    token.abi = [...token.abi, addAdmin];

    token.addAdmin('0xAbc...', (err, res) => {
        if(err) console.log(err);
        else console.log('Success')
    }); // Success
   ```

### Compilation and deployment
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

The compiler returns an object with the following structure:
```
{
    ERC20Token : { abi: [...], bytecode: "0x..." },
    Ownable : { abi: [...], bytecode: "0x..." },
    Token : { abi: [...], bytecode: "0x..." }
}
```

In order to compile and deploy the 'Token' contract:
```javascript
const fs = require('fs');
const { utils, Interface } = require('eth-sci');

const source = fs.readFileSync('./contract.sol', 'utf-8');
const mnemonic = "12 words mnemonic...";
const nodeAddress = 'https://mainnet.infura.io/v3/<API_KEY>';

const contractArguments = ["ERC20 Token", "TKN", 18, "100000000000000000000"];

const compile = async (souseCode) => {
    const compiled =  await utils.compile(souseCode);
    return compiled.Token;
};

const deploy = async ({ abi, bytecode }) => {
    const contract = new Interface(nodeAddress, null, mnemonic, null, abi, bytecode);
    await contract.deploy({args: contractArguments});
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


### Basic usage
---
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

In order to be able to transfer the tokens, you have to pass either a mnemonic or a private key (an array of keys) to the constructor:
```javascript
const { ERC20 } = require('eth-sci');
const mnemonic = '12 words mnemonic';

// 0x-prefix is allowed as well
const privateKey = '16ac46b....'; // 32-bytes private key;

const token = new ERC20(
    'https://mainnet.infura.io/v3/<API_KEY>',
    '0x45F1F44dE1...',
    mnemonic // or privateKey
);

const transfer = async (callback) => {
    const balance = await token.balanceOf(token.wallet);
    return await token.transfer('0x91a5...', balance);
};

transfer((err, res) => console.log(`${err ? 'Fail' : 'Success'}`));
```

#### Customize web3 parameters
It is possible to replace any parameter used by the underlying web3 provider - i.e. nonce, data, gasPrice, gas, from, and value.
Just pass an object with key-value pairs as the last argument (if there is no callback), or right before the callback:

```javascript
const params = {
    from: token.accounts[1],  // sender's address
    gas: '40000',             // gas limit
    gasPrice: '5200000000'    // gas price in Wei
};

token.tokenMethod('0xAbc', 100, params).then(...);

// using a callback
token.tokenMethod('0xAbc', 100, params, (err, res) => {...});

// call-type methods work the same
token.someRestrictedMethod({from: token.accounts[2]}).then(...);
```

The last line of the example above is equal to:
```javascript
token.wallet = 2;
token.someRestrictedMethod().then(...);
```

See the [sendTransaction](https://web3js.readthedocs.io/en/1.0/web3-eth.html#sendtransaction)
and
[methods.myMethod.call](https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#methods-mymethod-call) methods description.

#### Using a custom web3 instance
---
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

#### Listening for realtime events
TODO

#### Retry on fail
TODO

#### Transaction manager
TODO

#### Logging
TODO

## Limitations
- the library does not support 'HTTP Basic Authentication' for the web3 lib. Fell free to contact me or make a pool request;
- TypeScript types - I'm not familiar (yet) with the TypeScript, so I made it only in autocompletion purposes for my IDE;

## Troubleshooting
##### Transactions are too slow
Increase a gas price:
```javascript
const { ERC20 } = require('eth-sci');
const token = new ERC20(...);
...
token.gasPrice = 3; // in gWei
...
```
##### Error: Exceeds block gas limit
Decrease the gasLimit:
```javascript
const { ERC20 } = require('eth-sci');
const token = new ERC20(...);
...
token.gasLimit = '3000000'
...
```

#### Error: Cannot find module 'ethereumjs-wallet/hdkey'
```bash
$ npm uninstall ethereumjs-wallet
$ npm install ethereumjs-wallet@0.6.0
```

#### The compiler fails with 'Source file requires different compiler version' error
First of all, stay on top of things and don't use obsolete technologies, so consider to align your project in accordance with the most recent requirements.

The 'compile' module uses 'solc' version 0.5.x. If your pragma parameter is set to something like '^0.4.23', plese try to change it to '>=0.4.23'.

Also, check the [Solidity v0.5.0 Breaking Changes](https://solidity.readthedocs.io/en/v0.5.0/050-breaking-changes.html) list.


## License

[GPL-2.0](https://opensource.org/licenses/GPL-2.0 "GNU General Public License version 2")
