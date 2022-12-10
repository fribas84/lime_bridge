const hre = require("hardhat");
const ethers = hre.ethers;

deployContracts = async () => {
    await hre.run('compile'); // We are compiling the contracts using subtask
    const [deployer] = await ethers.getSigners(); // We are getting the deployer
  
    console.log('Deploying contracts with the account:', deployer.address); // We are printing the address of the deployer
    console.log('Account balance:', (await deployer.getBalance()).toString()); // We are printing the account balance
  
    const LimeToken = await ethers.getContractFactory("LimeToken"); // 
    const limeToken = await LimeToken.deploy();
    console.log('Waiting for Lime Token deployment...');
    await limeToken.deployed();
  
    console.log("Lime Token Contract address: ", limeToken.address);
    
    console.log('Deploying Bridge Contract with the account:', deployer.address); // We are printing the address of the deployer
    console.log('Account balance:', (await deployer.getBalance()).toString()); 

    const Bridge = await ethers.getContractFactory("Bridge"); // 
    const bridge = await Bridge.deploy(limeToken.address,0);
    console.log('Waiting for Bridge deployment...');
    await bridge.deployed();
  
    console.log("Bridge Contract address: ", bridge.address);
  
    console.log("Minting tokens....");

    const bridgeFunds = "1000000.0"
    await limeToken.mint(bridge.address,ethers.utils.parseEther(bridgeFunds));
    await limeToken.mint(deployer.address,ethers.utils.parseEther("1000"));

    const deployerBalance = await limeToken.balanceOf(deployer.address);
    const bridgeBalance = await limeToken.balanceOf(bridge.address);

    console.log("Balance of Deployer: ", ethers.utils.formatEther(deployerBalance));
    console.log("Balance of Bridge: ", ethers.utils.formatEther(bridgeBalance));

}
  
  module.exports = deployContracts;