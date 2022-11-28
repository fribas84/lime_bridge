// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "hardhat/console.sol";


contract Bridge is AccessControl,Pausable{

    uint8 public constant LOCK_TIME = 15 seconds;
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

    mapping(address=>uint) withdrawableMapping;
    uint debt;
    Network immutable myNetwork;
    

    mapping(bytes32=>txToBridge) TransferIDMapping;
    mapping(bytes32=>txToBridge) InboundTxMapping;
   
    mapping(Network=>address) bridgesAddresses;

    event TokenAddressChanged(address user,address newTokenAddress);
    event NewTransferBridgeRequest(address user,uint amount,Network network,uint timelock, bytes32 hashlock, bytes32 id);
    event NewTransferAvailable(address user);
    event DestinationTransferCompleted(address user, uint amount);
    event Widthdraw(address user, uint amount);

    // The Validator modifier will be use when using an external validator.

    // modifier onlyValidator(address _sender){
    //     require(validatorsMapping[_sender]==true,"[Validator] Sender is not a validator");
    //     _;
    // }
    // For further use
    // mapping(address=>bool) validatorsMapping;
    
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

    
    constructor(address lmtAddress, Network _myNetwork){
        _grantRole(DEFAULT_ADMIN_ROLE,msg.sender);
        _setLMT(lmtAddress, msg.sender);
        myNetwork = _myNetwork;
        bridgesAddresses[myNetwork] = address(this);
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
        // To be used if an external validator is developed.
        //validatorsMapping[sender] = true;
        emit NewTransferBridgeRequest(sender,_amount,_destination,timeLock,_hashLock,transferId);
        return transferId;
    }

    function initDestinationTransfer(
        uint _amount,
        uint timeLock,
        Network _destination,
        bytes32 _hashLock, 
        bytes32 _transferId       
        )
        external payable
        //onlyValidator(msg.sender) 
        {   
            uint balance = IERC20(_LMT).balanceOf(address(this)) - debt;
            require(_amount <= balance,"[Bridge] Not enough balance in bridge ");
            require(bridgesAddresses[_destination] == address(this), "[Bridge] Wrong bridge destination");
            _initDestinationTransfer(
                        msg.sender,
                        _amount,
                        timeLock,
                        _destination,
                        _hashLock, 
                        _transferId  
            );

        }

    function _initDestinationTransfer(
        address _sender,
        uint _amount,
        uint timeLock,
        Network _destination,
        bytes32 _hashLock, 
        bytes32 _transferId  

     ) internal {

        txToBridge memory inboundTxToBridge = txToBridge(_sender,_amount,timeLock,_destination,false,false,false,true);
        bytes32 transferId = keccak256(abi.encodePacked(
            _sender,
            _amount,
            _destination,
            _hashLock
        ));
        require(transferId == _transferId,"[Brigde] Transfer ID don't match");
        require(InboundTxMapping[_transferId].exists == false, "[Bridge] Trasfer Id already exists");
        InboundTxMapping[_transferId] = inboundTxToBridge;
        emit NewTransferAvailable(_sender);
        debt +=_amount;
        withdrawableMapping[_sender] = _amount;
     }

    function pause() public virtual onlyRole(DEFAULT_ADMIN_ROLE){
        _pause();
    }

    function unpause() public virtual onlyRole(DEFAULT_ADMIN_ROLE){
        
        _unpause();
    }

    function setDestinationAddress(Network _network, address _bridgeAddress) public  onlyRole(DEFAULT_ADMIN_ROLE){
        bridgesAddresses[_network] = _bridgeAddress;
    }

    function withdraw(bytes32 _transferId) public {
        //checks
        require(withdrawableMapping[msg.sender]>0,"[Bridge] No funds to widthdraw"); 
        require(InboundTxMapping[_transferId].exists == true,"[Bridge] Transfer ID doesn't exists");
        require(block.timestamp>InboundTxMapping[_transferId].timeLock,"[Bridge] Timelock didn't expired");
        require(InboundTxMapping[_transferId].withdrawn == false, "[Bridge] Transfer ID was already widthdrawn");
        require(InboundTxMapping[_transferId].refunded == false, "[Bridge] Transfer ID was refunded");
        require(InboundTxMapping[_transferId].isDone == false,"[Bridge] Transfer ID was already commited");
        //Effects
        uint amounToTx = withdrawableMapping[msg.sender]; 
        withdrawableMapping[msg.sender] = 0;
        debt -= amounToTx;
        //Interactions
        emit Widthdraw(msg.sender,amounToTx);
        IERC20(_LMT).transfer(msg.sender,amounToTx); 
   

    }

}