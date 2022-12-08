const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
  const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
  const { expect } = require("chai");
  const crypto = require('crypto')


//Helpers  
const hexNormalizer = (data) => '0x' + data.toString('hex')
const rand= () => crypto.randomBytes(32)

const createHash =  (secret) => crypto.createHash('sha256').update(secret).digest();
const newHashLock = () => { 
    const secret = rand()
    const hash = createHash(secret)
    return {
      secret: hexNormalizer(secret),
      hash: hexNormalizer(hash),
    }
  }


const wait = (milliseconds) => {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
  }

  describe("Bridge", () => {

    const ContractsTkn = async () => {

        // Contracts are deployed using the first signer/account by default
        const [owner, account1, account2, account3] = await ethers.getSigners();
        const LimeToken = await ethers.getContractFactory("LimeToken");
        const limeToken = await LimeToken.deploy();
        const Bridge = await ethers.getContractFactory("Bridge");
        const bridge = await Bridge.deploy(limeToken.address,0);
        const tkns = "10000.0";
        await limeToken.mint(account1.address,ethers.utils.parseEther(tkns));


        return {limeToken,bridge,owner, account1, account2, account3 };
    }

    const Tkn2BridgesFixture = async () => {

        const [owner, account1, account2, account3] = await ethers.getSigners();
        const LimeToken = await ethers.getContractFactory("LimeToken");
        const limeToken1 = await LimeToken.deploy();
        const limeToken2 = await LimeToken.deploy();
        const Bridge = await ethers.getContractFactory("Bridge");
        const bridge1 = await Bridge.deploy(limeToken1.address,0);
        const bridge2 = await Bridge.deploy(limeToken2.address,1);
        const tkns = "10000.0";
        await limeToken1.mint(account1.address,ethers.utils.parseEther(tkns));
        const bridgeFunds = "1000000.0"
        await limeToken1.mint(bridge1.address,ethers.utils.parseEther(bridgeFunds));
        await limeToken2.mint(bridge2.address,ethers.utils.parseEther(bridgeFunds));
        await bridge1.setDestinationAddress(0,bridge2.address);
        await bridge2.setDestinationAddress(0,bridge1.address);
        return {limeToken1,limeToken2,bridge1,bridge2,owner, account1, account2, account3 };
    }
    
    describe("Bridge Settings and basic functionallity tests",() => {
        it("LMT address in Bridge contract should be the same as the deployed", async ()=> {
            const {limeToken,bridge} = await loadFixture(ContractsTkn);
            const addr = await bridge.getLMT();
            expect(addr).to.equal(limeToken.address);
        })
        it("Lock Time should be equal to 15 seconds", async ()=>{
            const {limeToken,bridge} = await loadFixture(ContractsTkn);
            const lockTime = await bridge.LOCK_TIME();
            expect(lockTime).to.equal(15);
        }),
        it("Pausable", async ()=>{
            const {bridge} = await loadFixture(ContractsTkn);
            await bridge.pause();
            const status = await bridge.paused();
            expect(status).to.equal(true);

        }),
        it("Resumable", async ()=>{
            const {bridge} = await loadFixture(ContractsTkn);
            await bridge.pause();
            let status = await bridge.paused();
            expect(status).to.equal(true);
            await bridge.unpause();
            status = await bridge.paused();
            expect(status).to.equal(false);
        })
    })

    describe("Bridge Transfer", async () => {
        it("Account1 sets an allowance to bridge contract",async ()=> {
            const {limeToken,bridge,account1} = await loadFixture(ContractsTkn);
            const allowTkns = ethers.utils.parseEther("5000");
            await limeToken.connect(account1).approve(bridge.address,allowTkns);
            const allowance = await limeToken.allowance(account1.address,bridge.address);
            expect(allowTkns).to.equal(allowance);
      
        }),
        it("Account1 sets a transfer request and event NewTransferBridgeRequest is emitted",async ()=> {
            const {limeToken,bridge,account1} = await loadFixture(ContractsTkn);
            const allowTkns = ethers.utils.parseEther("5000");
            await limeToken.connect(account1).approve(bridge.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 0;
            const options = {value: ethers.utils.parseEther("0.001")};
            const newRequestTransaction = await bridge.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash,options);
            const txReceipt = await newRequestTransaction.wait();
            const [newTransferBridgeRequest] = txReceipt.events.filter((el)=>{ return el.event == 'NewTransferBridgeRequest'});
            const [sender,amount,destination,timelock, received_hashlock, bridgeTransactionID] = newTransferBridgeRequest.args;
            expect(sender).to.equal(account1.address);
            expect(amount).to.equal(allowTkns);
            expect(destination).to.equal(destNetwork);
            
        }),
        it("Request Transaction should be reverted when allowance is not enough",async ()=> {
            const {limeToken,bridge,account1} = await loadFixture(ContractsTkn);
            const allowTkns = ethers.utils.parseEther("4000");
            await limeToken.connect(account1).approve(bridge.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 0;
            const options = {value: ethers.utils.parseEther("0.001")};
            await expect(bridge.connect(account1).requestTransaction(
                ethers.utils.parseEther("5000"),
                destNetwork,
                hashlock.hash,
                options))
                .to.revertedWith("[Tokens Transfer] LMT allowance must be >= amount");

        }),
        it("Request Transaction should failed when is repited",async ()=> {
            const {limeToken,bridge,account1} = await loadFixture(ContractsTkn);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken.connect(account1).approve(bridge.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 0;
            const options = {value: ethers.utils.parseEther("0.001")};
            const newRequestTransaction = await bridge.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash,options);
            const txReceipt = await newRequestTransaction.wait();
            const [newTransferBridgeRequest] = txReceipt.events.filter((el)=>{ return el.event == 'NewTransferBridgeRequest'});
            const [sender,amount,destination] = newTransferBridgeRequest.args;
            expect(sender).to.equal(account1.address);
            expect(amount).to.equal(allowTkns);
            expect(destination).to.equal(destNetwork);
            const allowTkns2 = ethers.utils.parseEther("2000");
            await limeToken.connect(account1).approve(bridge.address,allowTkns);
            await expect(
                bridge.connect(account1)
                .requestTransaction(allowTkns2,destNetwork,hashlock.hash,options))
                .to.revertedWith('[Bridge] Transfer already in progress');
        })

    })
    describe("Two bridges ",async () =>{
        it("Balance in Bridges should be LMT 1.000.000", async () => {
            const {limeToken1,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const bridge1Balance = await limeToken1.balanceOf(bridge1.address);
            const bridge2Balance = await limeToken2.balanceOf(bridge2.address);
            expect(bridge1Balance).to.equal(ethers.utils.parseEther("1000000"));
            expect(bridge2Balance).to.equal(ethers.utils.parseEther("1000000"));
        }),
        it("User should be able to execute initDestinationTransfer in Bridge 2", async () =>{
            const {limeToken1,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const options = {value: ethers.utils.parseEther("0.001")};
            const newRequestTransaction = await bridge1.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash,options);
            const txReceipt = await newRequestTransaction.wait();
            const [newTransferBridgeRequest] = txReceipt.events.filter((el)=>{ return el.event == 'NewTransferBridgeRequest'});
            const [user,amount,destination,timelock,_hashlock,transferId] = newTransferBridgeRequest.args
            const initDestinationTransfer = await bridge2.connect(account1).initDestinationTransfer(amount,timelock,destination,_hashlock,transferId,options);
            const txReceipt2 = await initDestinationTransfer.wait();
            const [initDestinationTransferResult] = txReceipt2.events.filter((el)=>{ return el.event == 'NewTransferAvailable'});
            expect(user).to.equal(initDestinationTransferResult.args.user);
        }),
        it("Destination Bridge should transfer the same amount of sent tokens to address", async () =>{
            const {limeToken1,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const bal = await limeToken1.balanceOf(account1.address);
            const balBridge2 = await limeToken2.balanceOf(bridge2.address);
            const options = {value: ethers.utils.parseEther("0.001")};
            const newRequestTransaction = await bridge1.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash,options);
            const txReceipt = await newRequestTransaction.wait();
            const [newTransferBridgeRequest] = txReceipt.events.filter((el)=>{ return el.event == 'NewTransferBridgeRequest'});
            const [user,amount,destination,timelock,_hashlock,transferId] = newTransferBridgeRequest.args
            const initDestinationTransfer = await bridge2.connect(account1).initDestinationTransfer(amount,timelock,destination,_hashlock,transferId,options);
            const txReceipt2 = await initDestinationTransfer.wait();
            const [initDestinationTransferResult] = txReceipt2.events.filter((el)=>{ return el.event == 'NewTransferAvailable'});
            expect(user).to.equal(initDestinationTransferResult.args.user);
            await wait(20000);
            const withdrawRequest = await bridge2.connect(account1).withdraw(transferId);
            await withdrawRequest.wait();
            const newBal = await limeToken2.balanceOf(account1.address);
            expect(newBal).to.equal(allowTkns);   
        }),

        it("Widthdraw should revert if Timelock is not expired", async () =>{
            const {limeToken1,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const bal = await limeToken1.balanceOf(account1.address);
            const balBridge2 = await limeToken2.balanceOf(bridge2.address);
            const options = {value: ethers.utils.parseEther("0.001")};
            const newRequestTransaction = await bridge1.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash,options);
            const txReceipt = await newRequestTransaction.wait();
            const [newTransferBridgeRequest] = txReceipt.events.filter((el)=>{ return el.event == 'NewTransferBridgeRequest'});
            const [user,amount,destination,timelock,_hashlock,transferId] = newTransferBridgeRequest.args
            const initDestinationTransfer = await bridge2.connect(account1).initDestinationTransfer(amount,timelock,destination,_hashlock,transferId,options);
            const txReceipt2 = await initDestinationTransfer.wait();
            const [initDestinationTransferResult] = txReceipt2.events.filter((el)=>{ return el.event == 'NewTransferAvailable'});
            expect(user).to.equal(initDestinationTransferResult.args.user);
            await expect(bridge2.connect(account1).withdraw(transferId)).to.rejectedWith("[Bridge] Timelock didn't expired");
        })
    }),
    describe("Balance and Fees",async ()=>{
        it("requestTransaction should revert when fee is not enough", async () =>{
            const {limeToken1,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const bal = await limeToken1.balanceOf(account1.address);
            const balBridge2 = await limeToken2.balanceOf(bridge2.address);
            const options = {value: ethers.utils.parseEther("0.00001")};
            await expect(bridge1.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash,options)).to.revertedWith("[Fee value] the current paid fee is not enough");

        }),
        it("Bridges balances should increase after a full transaction is done", async () =>{
            const {limeToken1,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const bal = await limeToken1.balanceOf(account1.address);
            const balBridge2 = await limeToken2.balanceOf(bridge2.address);
            const options = {value: ethers.utils.parseEther("0.001")};
            const newRequestTransaction = await bridge1.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash,options);
            const txReceipt = await newRequestTransaction.wait();
            const [newTransferBridgeRequest] = txReceipt.events.filter((el)=>{ return el.event == 'NewTransferBridgeRequest'});
            const [user,amount,destination,timelock,_hashlock,transferId] = newTransferBridgeRequest.args
            const initDestinationTransfer = await bridge2.connect(account1).initDestinationTransfer(amount,timelock,destination,_hashlock,transferId,options);
            const txReceipt2 = await initDestinationTransfer.wait();
            const [initDestinationTransferResult] = txReceipt2.events.filter((el)=>{ return el.event == 'NewTransferAvailable'});
            expect(user).to.equal(initDestinationTransferResult.args.user);
            await wait(20000);
            const withdrawRequest = await bridge2.connect(account1).withdraw(transferId);
            await withdrawRequest.wait();
            const newBal = await limeToken1.balanceOf(account1.address);
            const newBalBridge2 = await limeToken2.balanceOf(bridge2.address);
            console.log(newBal);
            console.log(newBalBridge2);
            console.log(await limeToken2.balanceOf(account1.address));
            console.log(await limeToken1.balanceOf(bridge1.address));
            const balance = await bridge1.getBalance();
            
        })

    })
});