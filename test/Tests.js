const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
  const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
  const { expect } = require("chai");

  describe("Bridge", () => {

    async function deployTkn() {

        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();
    
        const LimeToken = await ethers.getContractFactory("LimeToken");
        const limeToken = await LimeToken.deploy();
        console.log("Lime Token Address: " + limeToken.address);
    
        return { limeToken,owner, otherAccount };
    }
    

    describe("LMT basic coverage",() => {
        it("Owner should be able to mint tokens to Account1", async ()=> {

        }),
        it("Owner should be able to pause the LMT contract", async () => {

        }),
        it("Owner should be able to resume the LMT contract", async () => {

        }),
        it("Account1 should be able to transfer to  Account2", async ()=> {

        }),
        it("Account1 should be able to generate an allowance to tranfer to Account2, and this be executed by Owner", async () => {

        }),
        it("Account2 cannot do a transferfrom Account1 without allowance", async ()=>{

        })


    })

});