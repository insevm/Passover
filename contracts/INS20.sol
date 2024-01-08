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
  bool public isFTOpen;
  bool public isInscribeOpen;

  constructor(
    string memory tick,
    address owner
  )ERC721("ins-20", tick) Ownable(owner){

  }

  /// @notice This is the entry point for users who have qualified to inscribe new INSC tokens.
  /// @dev Before inscribing, you need to obtain the correct Merkle proofs.
  /// @param tokenId TokenId that will be inscribed.
  /// @param proofs Merkle proofs.
  function inscribe(uint256 tokenId, bytes32[] calldata proofs) public {
    require(isInscribeOpen, "Is not open");
    require(tickNumber * mintLimit <= maxSupply, "Exceeded mint limit");
    address owner = msg.sender;

    // merkle verify
    bytes32 leaf = keccak256(abi.encode(owner, tokenId));
    require(
        MerkleProof.verify(proofs, root, leaf),
        "Merkle verification failed"
    );

    tickNumber++;
    _mint(owner, tokenId);
    emit Inscribe(tokenId, bytes('"data:text/plain;charset=utf-8,{"p":"ins-20","op":"mint","tick":"INSC","amt":"1000"}'));
  }

  /**
   *  --------- overide transfer ---------
   */
  /// @dev embed Inscribe event into Transfer of ERC721
  function transferFrom(address from, address to, uint256 tokenId) public override {
    ERC721.transferFrom(from, to, tokenId);
    emit Inscribe(tokenId, bytes('"data:text/plain;charset=utf-8,{"p":"ins-20","op":"transfer","tick":"INSC","amt":"1000"}'));
  }

  /// @dev embed Inscribe event into Transfer of ERC721
  function safeTransferFrom(address from, address to, uint256 tokenId) public override {
    safeTransferFrom(from, to, tokenId, "");
  }

  /// @dev embed Inscribe event into Transfer of ERC721
  function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public override {
    ERC721.safeTransferFrom(from, to, tokenId, data);
    emit Inscribe(tokenId, bytes('"data:text/plain;charset=utf-8,{"p":"ins-20","op":"transfer","tick":"INSC","amt":"1000"}'));
  }
  
  /// @dev Won't support tokenURI anymore.
  function tokenURI(uint256 tokenId) public pure override returns (string memory) {
    return "";
  }

  /**
   *  --------- owner access ---------
   */

  function setMerkleRoot(bytes32 root_) public onlyOwner {
    root = root_;
  }

  function openFT() public onlyOwner {
    isFTOpen = true;
  }

  function openInscribe() public onlyOwner {
    isInscribeOpen = true;
  }
}