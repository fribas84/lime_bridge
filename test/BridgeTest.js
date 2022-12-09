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
        }),
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
        it("Pausable not owner cannot pause the contract", async ()=>{
            const {bridge,account2} = await loadFixture(ContractsTkn);
            await expect(bridge.connect(account2).pause()).to.revertedWith("Ownable: caller is not the owner");
        }),
        it("Resumable", async ()=>{
            const {bridge} = await loadFixture(ContractsTkn);
            await bridge.pause();
            let status = await bridge.paused();
            expect(status).to.equal(true);
            await bridge.unpause();
            status = await bridge.paused();
            expect(status).to.equal(false);
        }),
        it("Not Ownwer cannot resume the bridge", async ()=>{
            const {bridge,account1} = await loadFixture(ContractsTkn);
            await bridge.pause();
            let status = await bridge.paused();
            expect(status).to.equal(true);
            await expect(bridge.connect(account1).unpause()).to.revertedWith("Ownable: caller is not the owner");
            expect(status).to.equal(true);
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
            const options = {value: ethers.utils.parseEther("0.000001")};
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
            const options = {value: ethers.utils.parseEther("0.000001")};
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
            const options = {value: ethers.utils.parseEther("0.000001")};
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
            const options = {value: ethers.utils.parseEther("0.000001")};
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
            const options = {value: ethers.utils.parseEther("0.000001")};
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

        it("Cannot execute 2 transactions at the same time", async () =>{
            const {limeToken1,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const options = {value: ethers.utils.parseEther("0.000001")};
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
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            await expect(bridge1.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash,options)).to.rejectedWith("[Bridge] Transfer already in progress");
        }),

        it("Cannot widthdraw when a tx was already widthdrawn", async () =>{
            const {limeToken1,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const bridge1EthBalInitial = await bridge1.getBalance();
            const bridge2EthBalInitial = await bridge2.getBalance();
            const options = {value: ethers.utils.parseEther("0.000001")};
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
            await expect(bridge2.connect(account1).withdraw(transferId)).to.revertedWith("[Bridge] Transfer ID was already widthdrawn");
        }),
        it("Another user cannot widthdraw transactions from others", async () =>{
            const {limeToken1,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const bridge1EthBalInitial = await bridge1.getBalance();
            const bridge2EthBalInitial = await bridge2.getBalance();
            const options = {value: ethers.utils.parseEther("0.000001")};
            const newRequestTransaction = await bridge1.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash,options);
            const txReceipt = await newRequestTransaction.wait();
            const [newTransferBridgeRequest] = txReceipt.events.filter((el)=>{ return el.event == 'NewTransferBridgeRequest'});
            const [user,amount,destination,timelock,_hashlock,transferId] = newTransferBridgeRequest.args
            const initDestinationTransfer = await bridge2.connect(account1).initDestinationTransfer(amount,timelock,destination,_hashlock,transferId,options);
            const txReceipt2 = await initDestinationTransfer.wait();
            const [initDestinationTransferResult] = txReceipt2.events.filter((el)=>{ return el.event == 'NewTransferAvailable'});
            expect(user).to.equal(initDestinationTransferResult.args.user);
            await wait(20000);
            await expect(bridge2.withdraw(transferId)).to.revertedWith("[Bridge] User is not the owner of this Transaction Id");
            
        }),

        it("Widthdraw should revert if Timelock is not expired", async () =>{
            const {limeToken1,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const bal = await limeToken1.balanceOf(account1.address);
            const balBridge2 = await limeToken2.balanceOf(bridge2.address);
            const options = {value: ethers.utils.parseEther("0.000001")};
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
    describe("Refund", async () => {
        it("User should be able to request a refund if operation fails", async () =>{
            const {limeToken1,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            const balanceInitial= await limeToken1.balanceOf(account1.address);
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const options = {value: ethers.utils.parseEther("0.000001")};
            const newRequestTransaction = await bridge1.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash,options);
            const txReceipt = await newRequestTransaction.wait();
            const [newTransferBridgeRequest] = txReceipt.events.filter((el)=>{ return el.event == 'NewTransferBridgeRequest'});
            const [user,amount,destination,timelock,_hashlock,transferId] = newTransferBridgeRequest.args
            const balanceBeforeRefund = await limeToken1.balanceOf(account1.address);
            //due to this will not fail, for mocking purposes the request for the bridge 2 will no be triggered, so the user can request the refund
            await bridge1.connect(account1).requestRefund(transferId);
            const balanceBeforeAfter = await limeToken1.balanceOf(account1.address);
            expect(balanceBeforeAfter).to.eql(balanceInitial);
            expect(balanceBeforeRefund).to.lessThan(balanceInitial);

        }),
        it("User cannot request a refund of a TX from another user", async () =>{
            const {limeToken1,limeToken2,bridge1,bridge2,account1,account2} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            const balanceInitial= await limeToken1.balanceOf(account1.address);
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const options = {value: ethers.utils.parseEther("0.000001")};
            const newRequestTransaction = await bridge1.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash,options);
            const txReceipt = await newRequestTransaction.wait();
            const [newTransferBridgeRequest] = txReceipt.events.filter((el)=>{ return el.event == 'NewTransferBridgeRequest'});
            const [user,amount,destination,timelock,_hashlock,transferId] = newTransferBridgeRequest.args
            const balanceBeforeRefund = await limeToken1.balanceOf(account1.address);
            //due to this will not fail, for mocking purposes the request for the bridge 2 will no be triggered, so the user can request the refund
            await expect(bridge1.connect(account2).requestRefund(transferId)).to.revertedWith("[Bridge] User is not the owner of this Transaction Id");
        }),
        it("User cannor refund 2 times the same tx", async () =>{
            const {limeToken1,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            const balanceInitial= await limeToken1.balanceOf(account1.address);
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const options = {value: ethers.utils.parseEther("0.000001")};
            const newRequestTransaction = await bridge1.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash,options);
            const txReceipt = await newRequestTransaction.wait();
            const [newTransferBridgeRequest] = txReceipt.events.filter((el)=>{ return el.event == 'NewTransferBridgeRequest'});
            const [user,amount,destination,timelock,_hashlock,transferId] = newTransferBridgeRequest.args
            const balanceBeforeRefund = await limeToken1.balanceOf(account1.address);
            //due to this will not fail, for mocking purposes the request for the bridge 2 will no be triggered, so the user can request the refund
            await bridge1.connect(account1).requestRefund(transferId);
            const balanceBeforeAfter = await limeToken1.balanceOf(account1.address);
            expect(balanceBeforeAfter).to.eql(balanceInitial);
            expect(balanceBeforeRefund).to.lessThan(balanceInitial);
            await expect(bridge1.connect(account1).requestRefund(transferId)).to.rejectedWith("[Bridge] Transfer ID was refunded");
        })
    })

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
        it("Init dest tx should revert if fee is not enough should revert", async () =>{
            const {limeToken1,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const options = {value: ethers.utils.parseEther("0.000001")};
            const newRequestTransaction = await bridge1.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash,options);
            const txReceipt = await newRequestTransaction.wait();
            const [newTransferBridgeRequest] = txReceipt.events.filter((el)=>{ return el.event == 'NewTransferBridgeRequest'});
            const [user,amount,destination,timelock,_hashlock,transferId] = newTransferBridgeRequest.args
            await expect(bridge2.connect(account1).initDestinationTransfer(amount,timelock,destination,_hashlock,transferId)).to.rejectedWith("[Fee value] the current paid fee is not enough");
        }),
        it("Bridges balances should increase after a full transaction is done", async () =>{
            const {limeToken1,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const bridge1EthBalInitial = await bridge1.getBalance();
            const bridge2EthBalInitial = await bridge2.getBalance();
            const options = {value: ethers.utils.parseEther("0.000001")};
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
            const bridge1EthBalFinal = await bridge1.getBalance();
            const bridge2EthBalFinal = await bridge2.getBalance();
            expect(bridge1EthBalFinal).to.greaterThan(bridge1EthBalInitial);
            expect(bridge2EthBalFinal).to.greaterThan(bridge2EthBalInitial);
        }),
        it("Admin can widthdraw charged fees", async () =>{
            const {limeToken1,owner,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const bridge1EthBalInitial = await bridge1.getBalance();
            const bridge2EthBalInitial = await bridge2.getBalance();
            const options = {value: ethers.utils.parseEther("0.000001")};
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
            const bridge1EthBalFinal = await bridge1.getBalance();
            const bridge2EthBalFinal = await bridge2.getBalance();
            expect(bridge1EthBalFinal).to.greaterThan(bridge1EthBalInitial);
            expect(bridge2EthBalFinal).to.greaterThan(bridge2EthBalInitial);
            const ownerBalance = await ethers.provider.getBalance(owner.address);
            await bridge1.withdrawFees();
            await bridge2.withdrawFees();
            const ownerBalance2 = await ethers.provider.getBalance(owner.address);
            expect(ownerBalance2).to.greaterThan(ownerBalance);
            const bridge1EthBalAfterW = await bridge1.getBalance();
            const bridge2EthBalAfterW = await bridge2.getBalance(); 
            expect(bridge1EthBalAfterW).to.equal(0);
            expect(bridge2EthBalAfterW).to.equal(0);
        }),
        it("Not Admin cannot widthdraw charged fees", async () =>{
            const {limeToken1,owner,limeToken2,bridge1,bridge2,account1} = await loadFixture(Tkn2BridgesFixture);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken1.connect(account1).approve(bridge1.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 1;
            const options = {value: ethers.utils.parseEther("0.000001")};
            await bridge1.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash,options);
            await  expect(bridge1.connect(account1).withdrawFees()).to.revertedWith("Ownable: caller is not the owner");
        })

    })
});