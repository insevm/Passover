// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "contracts/ERC7583/IERC7583.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

struct Tick {
  string op;
  uint256 amt;
}

contract INS20 is IERC7583, ERC721, Ownable{
  uint128 public maxSupply; // 21,000,000
  uint128 public mintLimit; // 1000

  // number of tickets minted
  uint128 private tickNumber;
  uint128 private _totalSupply;
  string private _tick;

  bytes32 public root;

  // for svg
  mapping(uint256 => Tick) internal _tickets;

  constructor(
    string memory tick,
    address owner
  )ERC721("ins-20", tick) Ownable(owner){

  }

  /// @notice This is the entry point for users who have qualified to inscribe new INSC tokens.
  /// @dev Before inscribing, you need to obtain the correct Merkle proofs.
  /// @param tokenID TokenID that will be inscribed.
  /// @param proofs Merkle proofs.
  function inscribe(uint256 tokenID, bytes32[] calldata proofs) public {
    address owner = msg.sender;

    // merkle verify
    bytes32 leaf = keccak256(abi.encode(owner, tokenID));
    require(
        MerkleProof.verify(proofs, root, leaf),
        "Merkle verification failed"
    );

    _mint(owner, tokenID);
    emit Inscribe(tokenID, bytes('"data:text/plain;charset=utf-8{"p":"ins-20","op":"mint","tick":"INSC","amt":"1000"}'));
  }

  function setMerkleRoot(bytes32 root_) public onlyOwner {
    root = root_;
  }
}