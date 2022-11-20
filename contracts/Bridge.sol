// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";


contract Bridge is AccessControl{

    address private _LMT;

    struct txToBridge(
        address orginator;
        uint amount;
        bool isDone;
    )

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

    event TokenAddressChanged(address user,address newTokenAddress);
    event NewBridgeCross()
}