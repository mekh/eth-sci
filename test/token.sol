pragma solidity ^0.5.0;

library SafeMath {
    function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
        if (a == 0) {
            return 0;
        }
        c = a * b;
        assert(c / a == b);
        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return a / b;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        assert(b <= a);
        return a - b;
    }

    function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
        c = a + b;
        assert(c >= a);
        return c;
    }
}


contract ERC20Token {
    using SafeMath for uint;
    uint public totalSupply;
    uint public decimals;
    string public name;
    string public symbol;


    mapping (address => uint) balances;
    mapping (address => mapping (address => uint256)) internal allowed;

    event Transfer(address indexed from, address indexed to, uint tokens);
    event Approval(address indexed tokenOwner, address indexed spender, uint tokens);
    event Burn(address indexed burner, uint value);


    function balanceOf(address _owner) view public returns (uint) {
        require(_owner != address(0));
        return balances[_owner];
    }

    function transfer(address _to, uint _value) public returns(bool) {
        require(_to != address(0));
        require(balances[msg.sender] >= _value);
        require(balances[_to] + _value > balances[_to]);

        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);

        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint _value) public returns(bool) {
        require(allowed[_from][msg.sender] >= _value);
        require(balances[_from] >= _value);
        require(balances[_to] <= balances[_to] + _value);

        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
        balances[_from] = balances[_from].sub(_value);
        balances[_to] = balances[_to].add(_value);

        emit Transfer(_from, _to, _value);
        return true;
    }

    function approve(address _spender, uint _value) public returns(bool) {
        require(balances[msg.sender] >= _value);
        require(_spender != address(0));

        allowed[msg.sender][_spender] = _value;

        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function allowance(address _owner, address _spender) view public returns(uint) {
        return allowed[_owner][_spender];
    }
}

contract Ownable is ERC20Token{
    address public owner;
    address private ownerCandidate = address(0);
    mapping (address => bool) public admins;

    bool private shouldConfirm = true;

    event OwnershipTransferred(address previousOwner, address newOwner);
    event OwnershipAwaitingConfirmation(address ownerCandidate);

    modifier auth() {
        require(msg.sender == owner || admins[msg.sender]);
        _;
    }

    constructor() public {
        owner = msg.sender;
    }

    function changeOwner(address newOwner) public auth returns(bool) {
        require(newOwner != address(0));
        if (shouldConfirm) {
            ownerCandidate = newOwner;
            emit OwnershipAwaitingConfirmation(ownerCandidate);
            return true;
        }

        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
        return true;
    }

    function confirmOwnership() public returns(bool) {
        require(ownerCandidate != address(0));
        require(msg.sender == ownerCandidate);
        emit OwnershipTransferred(owner, ownerCandidate);
        owner = msg.sender;
        ownerCandidate = address(0);
        return true;
    }

    function enableOwnershipConfirmation() public auth {
        shouldConfirm = true;
    }

    function disableOwnershipConfirmation() public auth{
        shouldConfirm = false;
    }

    function addAdmin(address _admin) public auth{
        admins[_admin] = true;
    }

    function removeAdmin(address _admin) public auth{
        require(msg.sender != _admin);
        admins[_admin] = false;
    }
}

contract Mintable is Ownable {
    event Mint(address indexed receiver, uint256 amount);
    event MintFinished();

    bool public mintingFinished = false;

    modifier mintable() {
        require(!mintingFinished);
        _;
    }

    function mint(address _to, uint _amount) public auth mintable returns(bool) {
        totalSupply = totalSupply.add(_amount);
        balances[_to] = balances[_to].add(_amount);
        return true;
    }

    function finishMinting() public auth returns(bool){
        if (mintingFinished == true) return true;
        mintingFinished = true;
        emit MintFinished();
        return true;
    }
}

contract Token is Mintable {
    uint public cap;

    constructor(string memory _name, string memory _symbol, uint _decimals, uint _totalSupply) public {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        cap = _totalSupply;
        mint(owner, _totalSupply);
    }

    function burn(uint256 _value) public returns(bool) {
        require(_value <= balances[msg.sender]);
        balances[msg.sender] = balances[msg.sender].sub(_value);
        totalSupply = totalSupply.sub(_value);
        emit Burn(msg.sender, _value);
        return true;
    }

    function burnFrom(address _who, uint256 _value) public auth returns(bool) {
        require(_value <= balances[_who]);
        balances[_who] = balances[_who].sub(_value);
        totalSupply = totalSupply.sub(_value);
        emit Burn(_who, _value);
        return true;
    }

}
