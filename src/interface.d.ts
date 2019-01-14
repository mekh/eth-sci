import * as Web3js from 'web3';

type Callback<T> = (error: Error, result: T) => void;
type ABIDataTypes = "uint256" | "uint128" | "uint64" | "uint32" | "uint16" | "uint8" | "bool" | "string" | "bytes" | "address" | string;

declare interface ABIDefinition {
    constant?: boolean
    inputs?: Array<{ name: string, type: ABIDataTypes, indexed?: boolean }>
    name?: string
    outputs?: Array<{ name: string, type: ABIDataTypes }>
    payable?: boolean
    stateMutability?: "nonpayable" | "payable" | "pure" | "view"
    anonymous?: boolean
    type: "function" | "constructor" | "event" | "fallback"
}

declare interface EventLog {
    event: string
    address: string
    returnValues: any
    logIndex: number
    transactionIndex: number
    transactionHash: string
    blockHash: string
    blockNumber: number
    raw?: { data: string, topics: string[] }
}

declare interface TokenInfo {
    address: string,
    name: string,
    symbol: string,
    decimals: number,
    totalSupply: string | number
}

export declare class Web3 {
    constructor(nodeAddress: string, mnemonic: string | string[])
}

declare class Interface {
    constructor(nodeAddress: string, contractAddress?: string, mnemonic?: string | string[], web3Instance?: new () => Web3js.default, abi?: ABIDefinition, bytecode?: string);
    wallet: string | number;
    gasPrice: number;
    init(): void;
    abi: ABIDefinition;
}

export declare class ERC20 extends Interface {
    constructor(nodeAddress: string, contractAddress?: string, mnemonic?: string | string[], web3Instance?: new () => Web3js.default, abi?: ABIDefinition, bytecode?: string);
    static web3(web3Instance: new () => Web3js.default, contractAddress: string, abi: ABIDefinition, bytecode?: string): ERC20;

    info: {
        address: string,
        name: string,
        symbol: string,
        decimals: number,
        totalSupply: string
    };

    name(callback?: Callback<string>): string;
    symbol(callback?: Callback<string>): string;
    decimals(callback?: Callback<number>): number;
    totalSupply(callback?: Callback<string>): string;
    balanceOf(holder: string, callback?: Callback<string>): string;
    cap(callback?: Callback<string>): string;
    paused(callback?: Callback<boolean>): boolean
    transfer(to: string, value: string | number, callback?: Callback<void>): void;
    transferFrom(from: string, to: string, value: string | number, callback?: Callback<void>): void;
    mint(to: string | number, amount: string | number, callback?: Callback<void>): void;
    approve(spender: string, value: string | number, callback?: Callback<void>): void;
    allowance(owner: string, spender: string): string;
    tokenInfo(callback?: Callback<TokenInfo>): TokenInfo;
    onTransfer(callback: Callback<EventLog>): EventLog;
    onApproval(callback: Callback<EventLog>): EventLog;
    onMint(callback: Callback<EventLog>): EventLog;
    onBurn(callback: Callback<EventLog>): EventLog;
    onPause(callback: Callback<EventLog>): EventLog;
    onUnpause(callback: Callback<EventLog>): EventLog;
}
