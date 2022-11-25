// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "hardhat/console.sol";


contract Bridge is AccessControl,Pausable{

    uint8 public constant LOCK_TIME = 45 seconds;
    enum Network{GOERLI,MUMBAI,BSC}
    address private _LMT;
    uint balaceLMT;
    
    struct txToBridge {
        address orginator;
        uint amount;
        uint timeLock;
        Network network;
        bool withdrawn;
        bool refunded;
        bool isDone;
        bool exists; 
    }

    mapping(bytes32=>txToBridge) TransferIDMapping;
    mapping(address=>bool) validatorsMapping;

    event TokenAddressChanged(address user,address newTokenAddress);
    event NewTransferBridgeRequest(address user,uint amount,Network network,uint timelock, bytes32 hashlock, bytes32 id);
    event DestinationTransferCompleted(address user, uint amount);

    modifier onlyValidator(address _sender){
        require(validatorsMapping[_sender]==true,"[Validator] Sender is not a validator");
        _;
    }

    modifier tokensTransferable(address _sender, uint256 _amount) {
        require(_amount > 0, "[Tokens Transfer] LMT amount must be > 0");
        require(IERC20(_LMT).allowance(_sender, address(this)) >= _amount,
            "[Tokens Transfer] LMT allowance must be >= amount");
        _;
    }

    modifier futureTimelock(uint256 _time) {
        require(_time > block.timestamp, "[Timelock] Timelock time must be in the future");
        _;
    }
    constructor(address lmtAddress){
        _grantRole(DEFAULT_ADMIN_ROLE,msg.sender);
        _setLMT(lmtAddress, msg.sender);
    }

    function getLMT() public view returns(address){
        return _LMT;
    }

    function setLMT(address lmtAddress) public whenNotPaused onlyRole(DEFAULT_ADMIN_ROLE){
        _setLMT(lmtAddress,msg.sender);
    }

    function _setLMT(address lmtAddress,address user) internal {
        _LMT = lmtAddress;
        emit TokenAddressChanged(user,_LMT);
    }


    function requestTransaction(
        uint _amount,
        Network _destination,
        bytes32 _hashLock
        )
    public
    payable
    whenNotPaused
    tokensTransferable(msg.sender, _amount)
    returns(bytes32) {
        return _requestTransaction(
            msg.sender,
            _amount,
            _destination,
            _hashLock);

    }
    function _requestTransaction(address sender,
        uint _amount,
        Network _destination,
        bytes32 _hashLock)
        private
        returns (bytes32) {    
        uint timeLock = block.timestamp + LOCK_TIME;
        txToBridge memory newTxToBridge = txToBridge(sender,_amount,timeLock,_destination,false,false,false,true);
        bytes32 transferId = keccak256(abi.encodePacked(
            sender,
            _amount,
            _destination,
            _hashLock
        ));

        if(TransferIDMapping[transferId].exists == true){
            revert("[Bridge] Transfer already in progress");
        }

        if(!IERC20(_LMT).transferFrom(sender,address(this),_amount)){
            revert("[Bridge] Transfer from LMT to bridge failed");
        }
        TransferIDMapping[transferId] = newTxToBridge;
        validatorsMapping[sender] = true;
        emit NewTransferBridgeRequest(sender,_amount,_destination,timeLock,_hashLock,transferId);
        return transferId;
    }

    function initDestinationTransfer(
        int _amount,
        Network _destination,
        bytes32 _hashLock, 
        bytes32 _transferId       
        )
        external payable
        onlyValidator(msg.sender) 
        returns(bytes32)  {
                        


        }

    // function _initDestinationTransfer(

    // ) internal

    function pause() public virtual {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Bridge: Admin Role can only pause the contract");
        _pause();
    }

    function unpause() public virtual {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Bridge: Admin Role can only unpause the contract");
        _unpause();
    }
        
}