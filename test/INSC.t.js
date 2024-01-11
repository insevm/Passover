describe("INSC+", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployINSCFixture() {
    // Contracts are deployed using the first signer/account by default
    const [deployer, owner, user1, user2, user3, user4, user5] = await ethers.getSigners();

    const name = "INSC Plus";
    const symbol = "INSC+";
    const maxSupply = 21000000;
    const mintLimit = 1000;
    const tickNumberMax = 63000;
    const INSC = await ethers.getContractFactory("INS20");
    const insc = await INSC.deploy(symbol, maxSupply, mintLimit, tickNumberMax, owner.address);

    // ----------- Merkle -----------

    const values = [
      [user1.address, 1000],
      [user2.address, 1000],
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

    return { insc, name, symbol, owner, user1, user2, user3, user4, user5, root, values, proofs};
  }
})