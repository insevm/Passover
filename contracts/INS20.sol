// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "contracts/ERC7583/IERC7583.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract INS20 is IERC7583, ERC721, Ownable{
  using Strings for uint256;

  bytes public constant transferInsData = bytes('data:text/plain;charset=utf-8,{"p":"ins-20","op":"transfer","tick":"INSC+","amt":"1000"}');

  uint64 public maxSupply; // 21,000,000
  uint64 public mintLimit; // 1000
  // number of tickets minted
  uint64 private tickNumber;
  uint64 private tickNumberMax; // 21,000 * 3 = 63,000

  uint128 private _totalSupply;
  string private _tick;

  bytes32 public root;
  bool public isFTOpen;
  bool public isInscribeOpen;

  // the FT slot of users. user address => slotId(insId)
  mapping (address => uint256) public slotFT;
  mapping (uint256 => bool) insTransferred;

  // -------- IERC20 --------
  // slot balance
  mapping(uint256 => uint256) internal _balancesSlot;
  mapping(address => mapping(address => uint256)) private _allowances;

  constructor(
    string memory tick,
    address owner
  )ERC721("ins-20", tick) Ownable(owner){

  }

  /// @notice This is the entry point for users who have qualified to inscribe new INSC tokens.
  /// @dev Before inscribing, you need to obtain the correct Merkle proofs.
  /// @dev All inscriptions must be completed before FT can be opened.
  /// @param tokenId TokenId that will be inscribed.
  /// @param proofs Merkle proofs.
  function inscribe(uint256 tokenId, bytes32[] calldata proofs) public recordSlot(address(0), msg.sender, tokenId){
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
    _balancesSlot[tokenId] = mintLimit;
    emit Inscribe(tokenId, bytes('data:text/plain;charset=utf-8,{"p":"ins-20","op":"mint","tick":"INSC+","amt":"1000"}'));
  }

  /**
   *  --------- overide balance ---------
   */

  

  /**
   *  --------- overide approve ---------
   */



  /**
   *  --------- overide transfer ---------
   */

  /// @notice Transfer like FT for DeFi compatibility. Only the balance in the slot can be transferred using this function.
  /// @dev Originally, it was not intended to use storage variables to store the data contained in inscriptions. However, for the sake of DeFi compatibility, storage variables are now used to store the balance of slot inscriptions.
  /// @param to Receiver address
  /// @return value The amount sent
  function transfer(address to, uint256 value) public virtual returns (bool) {
    address from = msg.sender;
    require(isFTOpen, "The ability of FT has not been granted");
    _transferFT(from, to, value);
    return true;
  }

  function _transferFT(address from, address to, uint256 value) internal {
    require(slotFT[from] != 0, "The sender must own a slot");

    // Slots can be minted until the limit is reached.
    if(slotFT[to] == 0){
      require(tickNumber + 1 <= tickNumberMax, "The number of slots has reached the limit");
      _mint(to, tickNumber);
      slotFT[to] = tickNumber;
      // _balancesSlot[slotFT[to]] = 0; // use default value
      tickNumber++;
    }

    uint256 fromBalance = _balancesSlot[slotFT[from]];
    require(fromBalance >= value, "Insufficient balance");

    unchecked {
      _balancesSlot[slotFT[from]] = fromBalance - value;
    }
    _balancesSlot[slotFT[to]] += value;

    emit Transfer(from, to, value);
    emit Inscribe(slotFT[from], bytes(string.concat(
        '{"p":"ins-20","op":"transfer","tick":"INSC+","amt":"',
        _balancesSlot[slotFT[from]].toString(),
        '"}'
      ))
    );
    emit Inscribe(slotFT[to], bytes(string.concat(
        '{"p":"ins-20","op":"transfer","tick":"INSC+","amt":"',
        _balancesSlot[slotFT[to]].toString(),
        '"}'
      ))
    );
  }

  /// @notice You can freely transfer the balances between any two of your inscriptions, including slots.
  /// @dev If compatibility with existing DeFi is not considered, the storage and computation of balance here would be unnecessary.
  /// @param from Inscription with a decreased balance
  /// @param to Inscription with a increased balance
  /// @param amount The value you gonna transfer
  function waterToWine(uint256 from, uint256 to, uint256 amount) public {
    require(isFTOpen, "The ability of FT has not been granted");
    require(ownerOf(from) == msg.sender && ownerOf(to) == msg.sender, "Is not yours");

    uint256 fromBalance = _balancesSlot[from];
    require(fromBalance >= amount, "Insufficient balance");
    unchecked {
      _balancesSlot[from] = fromBalance - amount;
    }
    _balancesSlot[to] += amount; 

    emit Inscribe(from, bytes(string.concat(
        '{"p":"ins-20","op":"transfer","tick":"INSC+","amt":"',
        _balancesSlot[from].toString(),
        '"}'
      ))
    );
    emit Inscribe(to, bytes(string.concat(
        '{"p":"ins-20","op":"transfer","tick":"INSC+","amt":"',
        _balancesSlot[to].toString(),
        '"}'
      ))
    );
  }
  
  /// @dev embed Inscribe event into Transfer of ERC721
  function transferFrom(address from, address to, uint256 tokenIdOrAmount) public override returns(bool) {
    if(!isFTOpen) {
      // Moved the contents of 'recordSlot modify' here.
      if (from == address(0)) _balancesSlot[tokenIdOrAmount] = mintLimit;
      
      if (from != address(0) && slotFT[from] == tokenIdOrAmount){
        require(balanceOf(from) == 1, "Slot can only be transferred at the end");
        slotFT[from] = 0;
      } 

      ERC721.transferFrom(from, to, tokenIdOrAmount);
      if(!insTransferred[tokenIdOrAmount]) {
        emit Inscribe(tokenIdOrAmount, transferInsData);
        insTransferred[tokenIdOrAmount] = true;
      }

      if (to != address(0) && slotFT[to] == 0) {
        slotFT[to] = tokenIdOrAmount;
      }
    }else{
      // TODO: _spendAllowance(from, msg.sender, tokenIdOrAmount);
      _transferFT(from, to, tokenIdOrAmount);
    }
  }

  /// @dev embed Inscribe event into Transfer of ERC721
  function safeTransferFrom(address from, address to, uint256 tokenId) public override {
    safeTransferFrom(from, to, tokenId, "");
  }

  /// @dev embed Inscribe event into Transfer of ERC721
  function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public override recordSlot(from, to, tokenId){
    ERC721.safeTransferFrom(from, to, tokenId, data);
    if(!insTransferred[tokenId]) {
      emit Inscribe(tokenId, transferInsData);
      insTransferred[tokenId] = true;
    }
  }
  
  /// @dev Will close this function in the future.
  function tokenURI(
    uint256 tokenID
  ) public view override returns (string memory) {
    string memory output = '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 350 350"> <style>.base { fill: white; font-family: serif; font-size: 14px; }</style><rect width="100%" height="100%" fill="black" /><text x="100" y="100" class="base">{</text><text x="130" y="130" class="base">"p":"ins-20",</text><text x="130" y="160" class="base">"op":"mint",</text><text x="130" y="190" class="base">"tick":"insc",</text><text x="130" y="220" class="base">"amt":1000</text><text x="100" y="250" class="base">}</text></svg>';

    string memory json = Base64.encode(
      bytes(
        string(
          abi.encodePacked(
            '{"description": "INS20 is a social experiment, a first attempt to practice inscription within the EVM.", "image": "data:image/svg+xml;base64,',
            Base64.encode(bytes(output)),
            '"}'
          )
        )
      )
    );
    output = string(abi.encodePacked("data:application/json;base64,", json));
    return isFTOpen ? "Not support tokenURI any more." : output;
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

  /**
   *  --------- modify ---------
   */

  /// @notice Slot can only be transferred at the end. If the user does not have a slot, then this tokenId will serve as his slot.
  /// @dev This modify is used only for the transfer of NFTs.
  /// @dev The balance of FT is only related to the slot.
  /// @param from Sender
  /// @param to Receiver
  /// @param tokenId TokenID of NFT
  modifier recordSlot(address from, address to, uint256 tokenId) {
    // record the balance of the slot
    if (from == address(0)) _balancesSlot[tokenId] = mintLimit;
    
    if (from != address(0) && slotFT[from] == tokenId){
      require(balanceOf(from) == 1, "Slot can only be transferred at the end");
      slotFT[from] = 0;
    } 
    _;
    if (to != address(0) && slotFT[to] == 0) {
      slotFT[to] = tokenId;
    }
  }
}