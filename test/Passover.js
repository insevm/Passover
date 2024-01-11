const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require('merkletreejs');

describe("Passover", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployPassoverFixture() {
    // Contracts are deployed using the first signer/account by default
    const [deployer, owner, vault, user1, user2, user3, user4, user5] = await ethers.getSigners();

    const name = "Debt-ETH";
    const symbol = "Debt-ETH";
    const Passover = await ethers.getContractFactory("Passover");
    const passover = await Passover.deploy(name, symbol, vault.address, owner.address, { value: 0 });

    // ----------- Merkle -----------

    const values = [
      [10000, user3.address, "10000000000", "0x5b8f9d597f511d250def7df6911b216ed42665f9f78bc59da4a162ca3bf39781"],
      [10001, user4.address, 2000000, "0x65cf0417d8717af8f203f5fca3db2cda6f6636b104500661a5eb57a4e54813c5"],
      [10002, user5.address, 3000000, "0x314cb864a3c92dcc0917e30366f2126cfd136280b050174785befc5ba42cfeed"]
    ]

    // caculate leaves node
    let leaves = [];
    for (let i = 0; i < values.length; i++) {
      const types = ["uint256", "address", "uint256", "bytes32"];
      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(types, values[i]);
        
      const leaf = ethers.keccak256(encoded);
      leaves.push(leaf);
    }
    let tree = new MerkleTree(leaves, ethers.keccak256, { sort: true });
    // get root
    let root = tree.getHexRoot();

    // calculate merkle proof of leaf
    let proofs = [];
    for (let index = 0; index < leaves.length; index++) {
        const leaf = leaves[index];
        proofs.push(tree.getHexProof(leaf));
    }

    // ----------- Merkle Over -----------

    return { passover, name, symbol, owner, vault, user1, user2, user3, user4, user5, root, values, proofs};
  }

  describe("Deployment", function () {
    it("Should set the right name", async function () {
      const { passover, name } = await loadFixture(deployPassoverFixture);

      expect(await passover.name()).to.equal(name);
    });

    it("Should set the right symbol", async function () {
      const { passover, symbol } = await loadFixture(deployPassoverFixture);

      expect(await passover.symbol()).to.equal(symbol);
    });

    it("Should set the right vault", async function () {
      const { passover, vault } = await loadFixture(deployPassoverFixture);

      expect(await passover.vault()).to.equal(vault.address);
    });

    it("Should set the right owner", async function () {
      const { passover, owner } = await loadFixture(deployPassoverFixture);

      expect(await passover.owner()).to.equal(owner.address);
    });
  });

  describe("Owner Access", function () {
    describe("setClaimLossesDirectRoot", function () {
      it("Should revert with the right error if others called this function", async function () {
        const { passover, user1 } = await loadFixture(deployPassoverFixture);

        const hash = ethers.keccak256(ethers.toUtf8Bytes('hello world!'))
        await expect(passover.connect(user1).setClaimLossesDirectRoot(hash)).to.be.revertedWithCustomError(passover, "OwnableUnauthorizedAccount");
      });

      it("Should succeed if the owner calls it", async function () {
        const { passover, owner } = await loadFixture(deployPassoverFixture);

        const hash = ethers.keccak256(ethers.toUtf8Bytes('hello world!'))
        await passover.connect(owner).setClaimLossesDirectRoot(hash);
        expect(await passover.rootClaimLossesDirect()).to.equal(hash);
      });
    });

    describe("setRefundRoot", function () {
      it("Should revert with the right error if others called this function", async function () {
        const { passover, user1 } = await loadFixture(deployPassoverFixture);

        const hash = ethers.keccak256(ethers.toUtf8Bytes('hello world!'))
        await expect(passover.connect(user1).setRefundRoot(hash)).to.be.revertedWithCustomError(passover, "OwnableUnauthorizedAccount");
      });

      it("Should succeed if the owner calls it", async function () {
        const { passover, owner } = await loadFixture(deployPassoverFixture);

        const hash = ethers.keccak256(ethers.toUtf8Bytes('hello world!'))
        await passover.connect(owner).setRefundRoot(hash);
        expect(await passover.rootRefund()).to.equal(hash);
      });
    });

    describe("setClaimLossesAfterRefundRoot", function () {
      it("Should revert with the right error if others called this function", async function () {
        const { passover, user1 } = await loadFixture(deployPassoverFixture);

        const hash = ethers.keccak256(ethers.toUtf8Bytes('hello world!'))
        await expect(passover.connect(user1).setClaimLossesAfterRefundRoot(hash)).to.be.revertedWithCustomError(passover, "OwnableUnauthorizedAccount");
      });

      it("Should succeed if the owner calls it", async function () {
        const { passover, owner } = await loadFixture(deployPassoverFixture);

        const hash = ethers.keccak256(ethers.toUtf8Bytes('hello world!'))
        await passover.connect(owner).setClaimLossesAfterRefundRoot(hash);
        expect(await passover.rootClaimLossesAfterRefund()).to.equal(hash);
      });
    });

    describe("pause", function () {
      it("Should revert with the right error if others called this function", async function () {
        const { passover, user1 } = await loadFixture(deployPassoverFixture);

        await expect(passover.connect(user1).pause()).to.be.revertedWithCustomError(passover, "OwnableUnauthorizedAccount");
      });

      it("Should succeed if the owner calls it", async function () {
        const { passover, owner } = await loadFixture(deployPassoverFixture);

        await passover.connect(owner).pause();
        expect(await passover.paused()).to.equal(true);
      });
    });

    describe("unpause", function () {
      it("Should revert with the right error if others called this function", async function () {
        const { passover, user1 } = await loadFixture(deployPassoverFixture);

        await expect(passover.connect(user1).unpause()).to.be.revertedWithCustomError(passover, "OwnableUnauthorizedAccount");
      });

      it("Should succeed if the owner calls it", async function () {
        const { passover, owner } = await loadFixture(deployPassoverFixture);

        await passover.connect(owner).pause();
        await passover.connect(owner).unpause();
        expect(await passover.paused()).to.equal(false);
      });
    });
  });

  describe("ClaimLossesDirect", function () {
    it("Should revert if tokenId is wrong", async function () {
      const { passover, owner, user3 , root, values, proofs} = await loadFixture(deployPassoverFixture);

      await passover.connect(owner).setClaimLossesDirectRoot(root);
      await expect(passover.connect(user3).claimLossesDirect(values[1][0],values[0][2],values[0][3],proofs[0])).to.be.revertedWith("Merkle verification failed");
    });

    it("Should revert if amount is wrong", async function () {
      const { passover, owner, user3 , root, values, proofs} = await loadFixture(deployPassoverFixture);

      await passover.connect(owner).setClaimLossesDirectRoot(root);
      await expect(passover.connect(user3).claimLossesDirect(values[0][0],values[1][2],values[0][3],proofs[0])).to.be.revertedWith("Merkle verification failed");
    });

    it("Should revert if txHash is wrong", async function () {
      const { passover, owner, user3 , root, values, proofs} = await loadFixture(deployPassoverFixture);

      await passover.connect(owner).setClaimLossesDirectRoot(root);
      await expect(passover.connect(user3).claimLossesDirect(values[0][0],values[0][2],values[1][3],proofs[0])).to.be.revertedWith("Merkle verification failed");
    });

    it("Should revert if proofs are wrong", async function () {
      const { passover, owner, user3 , root, values, proofs} = await loadFixture(deployPassoverFixture);

      await passover.connect(owner).setClaimLossesDirectRoot(root);
      await expect(passover.connect(user3).claimLossesDirect(values[0][0],values[0][2],values[0][3],proofs[1])).to.be.revertedWith("Merkle verification failed");
    });

    it("Should revert if paused", async function () {
      const { passover, owner, user3 , root, values, proofs} = await loadFixture(deployPassoverFixture);

      await passover.connect(owner).setClaimLossesDirectRoot(root);
      await passover.connect(owner).pause();

      await expect(passover.connect(user3).claimLossesDirect(values[0][0],values[0][2],values[0][3],proofs[0])).to.be.revertedWithCustomError(passover, "EnforcedPause");

      await passover.connect(owner).unpause();
      await passover.connect(user3).claimLossesDirect(values[0][0],values[0][2],values[0][3],proofs[0]);
    });

    it("Should succeed if all conditions are met", async function () {
      const { passover, owner, user4, user5, root, values, proofs} = await loadFixture(deployPassoverFixture);

      await passover.connect(owner).setClaimLossesDirectRoot(root);

      await passover.connect(user4).claimLossesDirect(values[1][0],values[1][2],values[1][3],proofs[1]);
      await passover.connect(user5).claimLossesDirect(values[2][0],values[2][2],values[2][3],proofs[2]);
    });

    it("event & state check", async function () {
      const { passover, owner, user4, user5, root, values, proofs} = await loadFixture(deployPassoverFixture);

      await passover.connect(owner).setClaimLossesDirectRoot(root);

      const [tokenIdUser4, , amountUser4, txHashUser4] = values[1];
      const proofUser4 = proofs[1];
      await expect(passover.connect(user4).claimLossesDirect(tokenIdUser4, amountUser4, txHashUser4, proofUser4))
          .to.emit(passover, "ClaimLosses")
          .withArgs(tokenIdUser4, user4.address,amountUser4, txHashUser4);

      const [tokenIdUser5, , amountUser5, txHashUser5] = values[2];
      const proofUser5 = proofs[2];
      await expect(passover.connect(user5).claimLossesDirect(tokenIdUser5, amountUser5, txHashUser5, proofUser5))
        .to.emit(passover, "ClaimLosses")
        .withArgs(tokenIdUser5, user5.address, amountUser5, txHashUser5);

      // check state
      expect(await passover.balanceOf(user4.address)).to.equal(amountUser4);
      expect(await passover.balanceOf(user5.address)).to.equal(amountUser5);
      expect(await passover.totalSupply()).to.equal(amountUser4 + amountUser5);
    });
  });

  describe("Refund", function () {

  });

  describe("ClaimLossesAfterRefund", function () {
    it("Should revert if tokenId is wrong", async function () {
      const { passover, owner, user3 , root, values, proofs} = await loadFixture(deployPassoverFixture);

      await passover.connect(owner).setClaimLossesAfterRefundRoot(root);
      await expect(passover.connect(user3).claimLossesAfterRefund(values[1][0],values[0][2],values[0][3],proofs[0])).to.be.revertedWith("Merkle verification failed");
    });

    it("Should revert if amount is wrong", async function () {
      const { passover, owner, user3 , root, values, proofs} = await loadFixture(deployPassoverFixture);

      await passover.connect(owner).setClaimLossesAfterRefundRoot(root);
      await expect(passover.connect(user3).claimLossesAfterRefund(values[0][0],values[1][2],values[0][3],proofs[0])).to.be.revertedWith("Merkle verification failed");
    });

    it("Should revert if txHash is wrong", async function () {
      const { passover, owner, user3 , root, values, proofs} = await loadFixture(deployPassoverFixture);

      await passover.connect(owner).setClaimLossesAfterRefundRoot(root);
      await expect(passover.connect(user3).claimLossesAfterRefund(values[0][0],values[0][2],values[1][3],proofs[0])).to.be.revertedWith("Merkle verification failed");
    });

    it("Should revert if proofs are wrong", async function () {
      const { passover, owner, user3 , root, values, proofs} = await loadFixture(deployPassoverFixture);

      await passover.connect(owner).setClaimLossesAfterRefundRoot(root);
      await expect(passover.connect(user3).claimLossesAfterRefund(values[0][0],values[0][2],values[0][3],proofs[1])).to.be.revertedWith("Merkle verification failed");
    });

    it("Should revert if paused", async function () {
      const { passover, owner, user3 , root, values, proofs} = await loadFixture(deployPassoverFixture);

      await passover.connect(owner).setClaimLossesAfterRefundRoot(root);
      await passover.connect(owner).pause();

      await expect(passover.connect(user3).claimLossesAfterRefund(values[0][0],values[0][2],values[0][3],proofs[0])).to.be.revertedWithCustomError(passover, "EnforcedPause");

      await passover.connect(owner).unpause();
      await passover.connect(user3).claimLossesAfterRefund(values[0][0],values[0][2],values[0][3],proofs[0]);
    });

    it("Should succeed if all conditions are met", async function () {
      const { passover, owner, user4, user5, root, values, proofs} = await loadFixture(deployPassoverFixture);

      await passover.connect(owner).setClaimLossesAfterRefundRoot(root);

      await passover.connect(user4).claimLossesAfterRefund(values[1][0],values[1][2],values[1][3],proofs[1]);
      await passover.connect(user5).claimLossesAfterRefund(values[2][0],values[2][2],values[2][3],proofs[2]);
    });

    it("event & state check", async function () {
      const { passover, owner, user4, user5, root, values, proofs} = await loadFixture(deployPassoverFixture);

      await passover.connect(owner).setClaimLossesAfterRefundRoot(root);

      const [tokenIdUser4, , amountUser4, txHashUser4] = values[1];
      const proofUser4 = proofs[1];
      await expect(passover.connect(user4).claimLossesAfterRefund(tokenIdUser4, amountUser4, txHashUser4, proofUser4))
          .to.emit(passover, "ClaimLosses")
          .withArgs(tokenIdUser4, user4.address,amountUser4, txHashUser4);

      const [tokenIdUser5, , amountUser5, txHashUser5] = values[2];
      const proofUser5 = proofs[2];
      await expect(passover.connect(user5).claimLossesAfterRefund(tokenIdUser5, amountUser5, txHashUser5, proofUser5))
        .to.emit(passover, "ClaimLosses")
        .withArgs(tokenIdUser5, user5.address, amountUser5, txHashUser5);

      // check state
      expect(await passover.balanceOf(user4.address)).to.equal(amountUser4);
      expect(await passover.balanceOf(user5.address)).to.equal(amountUser5);
      expect(await passover.totalSupply()).to.equal(amountUser4 + amountUser5);
    });
  });
});
