//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import {IVaultStrategy} from  "../interfaces/IVaultStrategy.sol";
import {IOptionMarket} from "../interfaces/IOptionMarket.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";


contract DeltaStrategy is IVaultStrategy, Ownable {
    address public immutable blackScholes;
    address public immutable optionMarketViwer;

    constructor(address _blackScholes, address _optionMarketViewer) {
        blackScholes = _blackScholes;
        optionMarketViwer = _optionMarketViewer;
    }

    function setStrategy(uint256 roundId, bytes memory strategyBytes) 
        override
        external 
        onlyOwner
    {
        
    }

    /**
     */
    function getExpectedPremium(uint256 listingId, uint256 amount) 
        override
        external 
        view 
        returns (uint256 expectedPremium) 
    {
        expectedPremium = 0;
    }

    function checkPostTrade() override external view returns (bool isValid) {
        isValid = true;
    }
}
