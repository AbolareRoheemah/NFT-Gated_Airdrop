import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { MerkleTree } from 'merkletreejs';
import keccak256 from "keccak256";
const helpers = require("@nomicfoundation/hardhat-network-helpers");



const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const BAYC_ADDRESS = "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D";
const AIRDROP_CLAIMER = "0xaAa2DA255DF9Ee74C7075bCB6D81f97940908A5D";

describe("Airdrop Claim", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployAirdropClaim() {
    await helpers.impersonateAccount(AIRDROP_CLAIMER);
    const impersonatedClaimer = await ethers.getSigner(AIRDROP_CLAIMER);

    const [owner, otherAccount, otherAccount1, otherAccount2, otherAccount3, otherAccount4] = await hre.ethers.getSigners();
    const leafNodes = [ owner, otherAccount, otherAccount1, otherAccount2, otherAccount3, otherAccount4, impersonatedClaimer].map((addr) =>
      keccak256(ethers.solidityPacked(["address", "uint256"], [addr.address, ethers.parseUnits("1", 18)]))
    );
  
    const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
    const rootHash = merkleTree.getHexRoot();

    const Airdrop = await hre.ethers.getContractFactory("Airdrop");
    const airdrop = await Airdrop.deploy(DAI, rootHash);

    return { airdrop, owner, AIRDROP_CLAIMER, merkleTree, impersonatedClaimer };
  }

  describe("Deployment", function () {
    it("Should claim successfully", async function () {
      const { airdrop, impersonatedClaimer, merkleTree } = await loadFixture(deployAirdropClaim);
      const TOKEN_HOLDER = "0xf584F8728B874a6a5c7A8d4d387C9aae9172D621";
      await helpers.setBalance(AIRDROP_CLAIMER, ethers.parseEther("1"));

      await helpers.impersonateAccount(TOKEN_HOLDER);
      const impersonatedSigner = await ethers.getSigner(TOKEN_HOLDER);

      const Trsfamount = ethers.parseUnits("2", 18);
      const Claimamount = ethers.parseUnits("1", 18);

      const DAI_Contract = await ethers.getContractAt("IERC20", DAI, impersonatedSigner);

      await DAI_Contract.transfer(airdrop, Trsfamount);

      const leaf = keccak256(ethers.solidityPacked(["address", "uint256"], [AIRDROP_CLAIMER, Claimamount]));
     
      const proof = merkleTree.getHexProof(leaf);

      const claimTx = await airdrop.connect(impersonatedClaimer).claim(AIRDROP_CLAIMER, Claimamount, proof);

      claimTx.wait();

      expect(await claimTx).to.emit(airdrop, "ClaimSuccessful")
      .withArgs(AIRDROP_CLAIMER, Claimamount);

    });
  });
});
