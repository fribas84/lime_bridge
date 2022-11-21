// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";


contract Bridge is AccessControl{

    uint public constant LOCK_TIME = 45 seconds;
    enum Network{GOERLI,MUMBAI,BSC}
    address private _LMT;
    uint balaceLMT;
    
    struct txToBridge(
        address orginator;
        uint amount;
        uint timeLock;
        Network network;
        bool withdrawn;
        bool refunded;
        bool isDone;
        bool exists; 
    )

    mapping(bytes32=>txToBridge) TransferIDMapping;

    event TokenAddressChanged(address user,address newTokenAddress);
    event NewTransferBridgeRequest(address user,uint amount,Network network);
    event DestinationTransferCompleted(addess user, uint amount);

    modifier tokensTransferable(address _sender, uint256 _amount) {
        require(_amount > 0, "LMT amount must be > 0");
        require(IERC20(_LMT).allowance(_sender, address(this)) >= _amount,
            "LMT allowance must be >= amount");
        _;
    }

    modifier futureTimelock(uint256 _time) {
        require(_time > now, "Timelock time must be in the future");
        _;
    }
    constructor(address lmtAddress){
        _grantRole(DEFAULT_ADMIN_ROLE,msg.sender);
        _setLMT(lmtAddress);
    }

    function getLMT() public view returns(address){
        return _LMT;
    }

    function setLMT(address lmtAddress) public onlyRole(DEFAULT_ADMIN_ROLE){
        _setLMT(lmtAddress,msg.sender);
    }

    function _setLMT(address lmtAddress,address user) internal {
        _LMT = lmtAddress;
        emit TokenAddressChanged(user,_LMT);
    }


    function requestTransaction(
        uint _amount,
        Network _destination,
        bytes32 _hashLock,
        )
    public
    payable
    tokensTransferable(msg.sender, _amount)
    returns(bytes32) {
        return _requestTransaction(
            msg.sender,
            _amount,
            _destination,
            _hashLock,
            timeLock)

    }
    function _requestTransaction(address sender,
        uint _amount,
        Network _destination,
        bytes32 _hashLock)
        private
        returns (bytes32) {    
        uint timeLock = block.timestamp + LOCK_TIME;
        txToBridge newTxToBridge = (sender,_amount,timeLock,network,false,true);
        bytes32 transferId = keccak256(abi.encodePacked(
            sender,
            _amount,
            _destination,
            _hashLock,
            timeLock,
        ))

        if(TransferIDMapping[transferId].exists == true){
            revert("Transfer already in progress");
        }

        if(!IERC20(_LMT).transferFrom(sender,address(this),_amount)){
            revert("Transfer from LMT to bridge failed")
        };
        TransferIDMapping[transferId] = newTxToBridge;
        emit NewTransferBridgeRequest(sender,amount,destination);
        return transferId;
    }

    function initDestinationTransfer(
        int _amount,
        Network _destination,
        bytes32 _hashLock
        
        ) payable returns(bytes32)



}