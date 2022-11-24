const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
  const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
  const { expect } = require("chai");

  describe("LMT Token", () => {

    async function deployTkn() {

        // Contracts are deployed using the first signer/account by default
        const [owner, account1, account2, account3] = await ethers.getSigners();
        const LimeToken = await ethers.getContractFactory("LimeToken");
        const limeToken = await LimeToken.deploy();
        console.log("Lime Token Address: " + limeToken.address);
        return { limeToken,owner, account1, account2, account3 };
    }
    
    describe("Basic ERC20 functions",() => {
        it("Owner should be able to mint tokens to Account1", async ()=> {
            const {limeToken,owner, account1, account2, account3 } = await loadFixture(deployTkn);
            const tkns = "10000.0";
            await limeToken.mint(account1.address,ethers.utils.parseEther(tkns));
            const tkntInAccount1= await limeToken.balanceOf(account1.address);
            expect(tkns).to.equal(ethers.utils.formatEther(tkntInAccount1));

        }),
        it("Owner should be able to pause the LMT contract", async () => {
            const {limeToken,owner, account1, account2, account3 } = await loadFixture(deployTkn);
            const tkns = "10000.0";
            await limeToken.mint(account1.address,ethers.utils.parseEther(tkns));
            const tkntInAccount1= await limeToken.balanceOf(account1.address);
            expect(tkns).to.equal(ethers.utils.formatEther(tkntInAccount1));
            await limeToken.pause();
            const status = await limeToken.paused();
            expect(status).to.equal(true);
        }),
        it("Owner should be able to resume the LMT contract", async () => {
            const {limeToken,owner, account1, account2, account3 } = await loadFixture(deployTkn);
            const tkns = "10000.0";
            await limeToken.mint(account1.address,ethers.utils.parseEther(tkns));
            const tkntInAccount1= await limeToken.balanceOf(account1.address);
            expect(tkns).to.equal(ethers.utils.formatEther(tkntInAccount1));
            await limeToken.pause();
            let status = await limeToken.paused();
            expect(status).to.equal(true);
            await limeToken.unpause();
            status = await limeToken.paused();
            expect(status).to.equal(false);
        }),
        it("Account1 should be able to transfer to  Account2", async ()=> {
            const {limeToken,owner, account1, account2, account3 } = await loadFixture(deployTkn);
            const tkns = "10000.0";
            await limeToken.mint(account1.address,ethers.utils.parseEther(tkns));
            let tkntInAccount1= await limeToken.balanceOf(account1.address);
            expect(tkns).to.equal(ethers.utils.formatEther(tkntInAccount1));
            const tknsTx = "5000.0";
            await limeToken.connect(account1).transfer(account2.address,ethers.utils.parseEther(tknsTx));
            const tkntInAccount2= await limeToken.balanceOf(account2.address);
            tkntInAccount1= await limeToken.balanceOf(account1.address);
            expect(ethers.utils.formatEther(tkntInAccount2)).to.equal(tknsTx);
            expect(ethers.utils.formatEther(tkntInAccount1)).to.equal(tknsTx);
        }),
        it("Account1 should be able to generate an allowance to tranfer to Account2, and this be executed by Owner", async () => {
            const {limeToken,owner, account1, account2, account3 } = await loadFixture(deployTkn);
            const tkns = "10000.0";
            await limeToken.mint(account1.address,ethers.utils.parseEther(tkns));
            let tkntInAccount1= await limeToken.balanceOf(account1.address);
            expect(tkns).to.equal(ethers.utils.formatEther(tkntInAccount1));
            const allowTkns = ethers.utils.parseEther("5000");
            await limeToken.connect(account1).approve(owner.address,allowTkns);
            await limeToken.transferFrom(account1.address,account2.address,allowTkns);
            const tkntInAccount2= await limeToken.balanceOf(account2.address);
            tkntInAccount1= await limeToken.balanceOf(account1.address);
            expect(ethers.utils.formatEther(tkntInAccount2)).to.equal(ethers.utils.formatEther(allowTkns));
            expect(ethers.utils.formatEther(tkntInAccount1)).to.equal(ethers.utils.formatEther(allowTkns));
        }),
        it("Account2 cannot do a transferfrom Account1 without allowance", async ()=>{
            const {limeToken,owner, account1, account2, account3 } = await loadFixture(deployTkn);
            const tkns = "10000.0";
            await limeToken.mint(account1.address,ethers.utils.parseEther(tkns));
            let tkntInAccount1= await limeToken.balanceOf(account1.address);
            expect(tkns).to.equal(ethers.utils.formatEther(tkntInAccount1));
            const allowTkns = ethers.utils.parseEther("5000");
            await expect(limeToken.transferFrom(account1.address,account2.address,allowTkns)).to.revertedWith("ERC20: insufficient allowance");
        })
    })

});