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

//

  describe("Bridge", () => {

    async function ContractsTkn() {

        // Contracts are deployed using the first signer/account by default
        const [owner, account1, account2, account3] = await ethers.getSigners();
        const LimeToken = await ethers.getContractFactory("LimeToken");
        const limeToken = await LimeToken.deploy();
        console.log("Lime Token Address: " + limeToken.address);
        const Bridge = await ethers.getContractFactory("Bridge");
        const bridge = await Bridge.deploy(limeToken.address);
        console.log("Bridge Address: " + bridge.address);
        const tkns = "10000.0";
        await limeToken.mint(account1.address,ethers.utils.parseEther(tkns));


        return {limeToken,bridge,owner, account1, account2, account3 };
    }
    
    describe("Bridge Settings and basic functionallity tests",() => {
        it("LMT address in Bridge contract should be the same as the deployed", async ()=> {
            const {limeToken,bridge} = await loadFixture(ContractsTkn);
            const addr = await bridge.getLMT();
            expect(addr).to.equal(limeToken.address);
        })
        it("Lock Time should be equal to 45 seconds", async ()=>{
            const {limeToken,bridge} = await loadFixture(ContractsTkn);
            const lockTime = await bridge.LOCK_TIME();
            expect(lockTime).to.equal(45);
        }),
        it("Pausable", async ()=>{
            console.log("To implement");
        }),
        it("Resumable", async ()=>{
            console.log("To implement");
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
            const newRequestTransaction = await bridge.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash);
            const txReceipt = await newRequestTransaction.wait();
            const [newTransferBridgeRequest] = txReceipt.events.filter((el)=>{ return el.event == 'NewTransferBridgeRequest'});
            const [sender,amount,destination] = newTransferBridgeRequest.args;
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
            await expect(bridge.connect(account1).requestTransaction(
                ethers.utils.parseEther("5000"),
                destNetwork,
                hashlock.hash))
                .to.revertedWith("LMT allowance must be >= amount");

        }),
        it("Request Transaction should failed when is repited",async ()=> {
            const {limeToken,bridge,account1} = await loadFixture(ContractsTkn);
            const allowTkns = ethers.utils.parseEther("2000");
            await limeToken.connect(account1).approve(bridge.address,allowTkns);
            const hashlock  = newHashLock();
            const destNetwork = 0;
            const newRequestTransaction = await bridge.connect(account1).requestTransaction(allowTkns,destNetwork,hashlock.hash);
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
                .requestTransaction(allowTkns2,destNetwork,hashlock.hash))
                .to.revertedWith('Transfer already in progress');
        })

    })

});