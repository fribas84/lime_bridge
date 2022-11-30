// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
// const hre = require("hardhat");

async function main() {

    console.log(
        `Deploying Lime Token Contracts...`
    );
    const LimeToken1 = await hre.ethers.getContractFactory("LimeToken");
    const limeToken1 = await LimeToken1.deploy();
    await limeToken1.deployed();

    const LimeToken2 = await hre.ethers.getContractFactory("LimeToken");
    const limeToken2 = await LimeToken2.deploy();
    await limeToken2.deployed();

    console.log(
        `Deploying Bridge Contracts...`
    );


    const Bridge = await ethers.getContractFactory("Bridge");
    const bridge1 = await Bridge.deploy(limeToken1.address,0);
    const bridge2 = await Bridge.deploy(limeToken2.address,1);
    console.log("Bridge 1 Address: " + bridge1.address);
    console.log("Bridge 2 Address: " + bridge2.address);

    const bridgeFunds = "1000000.0"
    await limeToken1.mint(bridge1.address,ethers.utils.parseEther(bridgeFunds));
    await limeToken2.mint(bridge2.address,ethers.utils.parseEther(bridgeFunds));

    await bridge1.setDestinationAddress(1,bridge2.address);
    await bridge2.setDestinationAddress(0,bridge1.address);

    const [owner, account1] = await ethers.getSigners();
    const tkns = "10000.0";
    await limeToken1.mint(account1.address,ethers.utils.parseEther(tkns));

    const balance = await limeToken1.balanceOf(account1.address);


    console.log(
        `Lime Token 1 deployed to: ${limeToken1.address}`
    );
    console.log(
        `Lime Bridge 1 deployed to: ${bridge1.address}`
    );
    
    console.log(
        `Lime Token 2 deployed to: ${limeToken2.address}`
    );
    console.log(
        `Lime Bridge 2 deployed to: ${bridge2.address}`
    );

    console.log(
        `Account ${account1.address} has a balance of ${ethers.utils.formatEther(balance)} LMT in Network 0`
    );

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
