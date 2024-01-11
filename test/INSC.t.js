const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { MerkleTree } = require('merkletreejs');
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("INSC+", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployINSCFixture() {
    // Contracts are deployed using the first signer/account by default
    const [deployer, owner, user1, user2, user3, user4, user5] = await ethers.getSigners();

    const name = "INSC Plus";
    const symbol = "INSC+";
    const maxSupply = 3000;
    const mintLimit = 1000;
    const tickNumberMax = 9;
    const INSC = await ethers.getContractFactory("INS20");
    const insc = await INSC.deploy(maxSupply, mintLimit,  owner.address);

    // ----------- Merkle -----------

    const values = [
      [user1.address, 1000],
      [user2.address, 1000], // test same tokenId
      [user3.address, 10000],
      [user4.address, 10001],
      [user5.address, 10002]
    ]

    // caculate leaves node
    let leaves = [];
    for (let i = 0; i < values.length; i++) {
      const types = ["address", "uint256"];
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

    const userList = [user2, user3, user4, user5];
    return { insc, name, symbol, maxSupply, mintLimit, tickNumberMax, owner, user1, user2, user3, user4, user5, userList, root, values, proofs};
  }

  describe("Deployment", function () {
    it("Should set the right name", async function () {
      const { insc, name } = await loadFixture(deployINSCFixture);

      expect(await insc.name()).to.equal(name);
    });

    it("Should set the right symbol", async function () {
      const { insc, symbol } = await loadFixture(deployINSCFixture);

      expect(await insc.symbol()).to.equal(symbol);
    });

    it("Should set the right maxSupply", async function () {
      const { insc, maxSupply } = await loadFixture(deployINSCFixture);

      expect(await insc.maxSupply()).to.equal(maxSupply);
    });

    it("Should set the right mintLimit", async function () {
      const { insc, mintLimit } = await loadFixture(deployINSCFixture);

      expect(await insc.mintLimit()).to.equal(mintLimit);
    });

    it("Should set the right tickNumberMax", async function () {
      const { insc, maxSupply, mintLimit , tickNumberMax} = await loadFixture(deployINSCFixture);

      expect(await insc.tickNumberMax()).to.equal(maxSupply * 3 / mintLimit).to.equal(tickNumberMax);
    });

    it("Should set the right owner", async function () {
      const { insc, owner } = await loadFixture(deployINSCFixture);

      expect(await insc.owner()).to.equal(owner.address);
    });
  });

  describe("Inscribe", function () {
    it("Should revert if inscribe is not open", async function () {
      const { insc, owner, user1 , root, values, proofs} = await loadFixture(deployINSCFixture);

      await insc.connect(owner).setMerkleRoot(root);

      const [, tokenIdUser1] = values[0];
      const proofUser1 = proofs[0];

      await expect(insc.connect(user1).inscribe(tokenIdUser1, proofUser1)).to.be.revertedWith("Is not open");
    });

    it("Should revert if exceeded mint limit", async function () {
      const { insc, owner, userList, maxSupply, mintLimit, root, values, proofs} = await loadFixture(deployINSCFixture);

      await insc.connect(owner).setMerkleRoot(root);
      await insc.connect(owner).openInscribe();
      
      for (let i = 0; i < maxSupply / mintLimit; i++) {
        const [, tokenIdUserI] = values[i + 1];
        const proofUserI = proofs[i + 1];
        await insc.connect(userList[i]).inscribe(tokenIdUserI, proofUserI);
      }

      const [, tokenIdUserLast] = values[values.length - 1]
      const proofUserLast = proofs[proofs.length - 1];
      await expect(insc.connect(userList[userList.length - 1]).inscribe(tokenIdUserLast, proofUserLast)).to.be.revertedWith("Exceeded mint limit");
    });

    it("Should revert if msg.sender is wrong", async function () {
      const { insc, owner, user3 , root, values, proofs} = await loadFixture(deployINSCFixture);

      await insc.connect(owner).setMerkleRoot(root);
      await insc.connect(owner).openInscribe();

      const [, tokenIdUser1] = values[0];
      const proofUser1 = proofs[0];

      await expect(insc.connect(user3).inscribe(tokenIdUser1, proofUser1)).to.be.revertedWith("Merkle verification failed");
    });

    it("Should revert if tokenId is wrong", async function () {
      const { insc, owner, user1 , root, values, proofs} = await loadFixture(deployINSCFixture);

      await insc.connect(owner).setMerkleRoot(root);
      await insc.connect(owner).openInscribe();

      const [, tokenIdUser1] = values[0];
      const proofUser1 = proofs[0];

      await expect(insc.connect(user1).inscribe(tokenIdUser1 + 1, proofUser1)).to.be.revertedWith("Merkle verification failed");
    });

    it("Should revert if proofs are wrong", async function () {
      const { insc, owner, user1 , root, values, proofs} = await loadFixture(deployINSCFixture);

      await insc.connect(owner).setMerkleRoot(root);
      await insc.connect(owner).openInscribe();

      const [, tokenIdUser1] = values[0];
      const proofUser1 = proofs[0];

      await expect(insc.connect(user1).inscribe(tokenIdUser1, proofs[1])).to.be.revertedWith("Merkle verification failed");
    });

    it("Should revert if use same proofs twice", async function () {
      const { insc, owner, user1 , root, values, proofs} = await loadFixture(deployINSCFixture);

      await insc.connect(owner).setMerkleRoot(root);
      await insc.connect(owner).openInscribe();

      const [, tokenIdUser1] = values[0];
      const proofUser1 = proofs[0];

      await insc.connect(user1).inscribe(tokenIdUser1, proofUser1);
      await expect(insc.connect(user1).inscribe(tokenIdUser1, proofUser1)).to.be.revertedWithCustomError(insc, "ERC721InvalidSender");
    });

    it("Should revert if two uses inscribe same tokenId", async function () {
      const { insc, owner, user1, user2 , root, values, proofs} = await loadFixture(deployINSCFixture);

      await insc.connect(owner).setMerkleRoot(root);
      await insc.connect(owner).openInscribe();

      const [, tokenIdUser1] = values[0];
      const proofUser1 = proofs[0];
      await insc.connect(user1).inscribe(tokenIdUser1, proofUser1);

      // user2 has the same tokenID proofs
      const [, tokenIdUser2] = values[1];
      const proofUser2 = proofs[1];
      await expect(insc.connect(user2).inscribe(tokenIdUser2, proofUser2)).to.be.revertedWithCustomError(insc, "ERC721InvalidSender");
    });

    it("Should succeed if all conditions are met", async function () {
      const { insc, owner, user1, root, values, proofs, mintLimit} = await loadFixture(deployINSCFixture);

      await insc.connect(owner).setMerkleRoot(root);
      await insc.connect(owner).openInscribe();

      const [, tokenIdUser1] = values[0];
      const proofUser1 = proofs[0];
      // event check
      const hexString = '0x' + Buffer.from('data:text/plain;charset=utf-8,{"p":"ins-20","op":"mint","tick":"INSC+","amt":"1000"}', 'utf8').toString('hex');
      await expect(insc.connect(user1).inscribe(tokenIdUser1, proofUser1)).to.emit(insc, "Inscribe").withArgs(tokenIdUser1, hexString);

      // data status check
      expect(await insc.balanceOf(user1.address)).to.equal(1);
      expect(await insc.tickNumber()).to.equal(1);
      expect(await insc.ownerOf(tokenIdUser1)).to.equal(user1.address);
      expect(await insc.totalSupply()).to.equal(mintLimit * 1);
    });

    it("For production environment", async function () {
      
    });
  });
})