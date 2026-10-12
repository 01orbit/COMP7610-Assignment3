// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

interface ICPTMembership {
    function ADMIN_ROLE() external view returns (bytes32);
    function hasRole(bytes32 role, address account) external view returns (bool);
    function burnFrom(address account, uint256 amount) external;
    function isMember(address account) external view returns (bool);
    function transferFrom(address from, address to, uint256 amount)
        external
        returns (bool);
}

/**
 * @title CampusMemo
 * @notice Administrators issue limited-edition NFTs to members. Existing NFTs
 * can be traded by their owners; there is no administrative recovery or burn.
 */
contract CampusMemo is ERC721, ReentrancyGuard {
    uint256 public constant MAX_SUPPLY = 10;
    uint256 public constant MINT_COST = 100 ether;

    ICPTMembership public immutable cpt;
    /** @dev One stable image is stored off-chain; each JSON document is generated on-chain. */
    string public imageURI;
    uint256 public nextTokenId = 1;

    struct Listing {
        address seller;
        uint256 price;
    }

    mapping(uint256 => Listing) public listings;

    event MemoMinted(
        address indexed admin,
        address indexed recipient,
        uint256 indexed tokenId
    );
    event MemoListed(
        address indexed seller,
        uint256 indexed tokenId,
        uint256 price
    );
    event MemoPurchased(
        address indexed buyer,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 price
    );
    event MemoListingCancelled(address indexed seller, uint256 indexed tokenId);

    constructor(address cptAddress, string memory imageURI_)
        ERC721("Campus-Memo", "CMEMO")
    {
        require(cptAddress != address(0), "Invalid CPT address");
        require(_isSafeImageURI(imageURI_), "Invalid image URI");
        cpt = ICPTMembership(cptAddress);
        imageURI = imageURI_;
    }

    /**
     * @notice Issue a new NFT directly to a club member.
     * @dev The caller must hold CPT's current ADMIN_ROLE and approve this
     * contract to burn 100 CPT from the caller's own balance for each mint.
     */
    function mintMemo(address recipient) external nonReentrant {
        require(
            cpt.hasRole(cpt.ADMIN_ROLE(), msg.sender),
            "Not a club administrator"
        );
        require(nextTokenId <= MAX_SUPPLY, "Maximum supply reached");
        require(recipient != address(0), "Invalid recipient");
        require(cpt.isMember(recipient), "Recipient is not a club member");

        // The administrator pays; the recipient's CPT balance is unchanged.
        cpt.burnFrom(msg.sender, MINT_COST);

        uint256 tokenId = nextTokenId;
        nextTokenId++;
        _safeMint(recipient, tokenId);

        emit MemoMinted(msg.sender, recipient, tokenId);
    }

    /**
     * @notice Escrow an owned NFT for sale at a CPT price selected by its owner.
     * @dev The seller does not need to be a current club member. This preserves
     * the ability to trade an NFT after leaving the club.
     */
    function listMemo(uint256 tokenId, uint256 price) external nonReentrant {
        require(price > 0, "Price must be positive");
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(listings[tokenId].seller == address(0), "Already listed");

        listings[tokenId] = Listing({seller: msg.sender, price: price});
        // Direct ownership transfer avoids requiring the NFT contract to be an
        // ERC721Receiver while keeping the token in marketplace escrow.
        _transfer(msg.sender, address(this), tokenId);

        emit MemoListed(msg.sender, tokenId, price);
    }

    /** @notice Cancel a listing and return the escrowed NFT to its seller. */
    function cancelMemoListing(uint256 tokenId) external nonReentrant {
        Listing memory listing = listings[tokenId];
        require(listing.seller == msg.sender, "Not listing seller");

        delete listings[tokenId];
        _transfer(address(this), msg.sender, tokenId);

        emit MemoListingCancelled(msg.sender, tokenId);
    }

    /**
     * @notice Buy an escrowed NFT with CPT.
     * @dev The buyer must approve this contract to spend the listed CPT price.
     * Membership is not required: NFT ownership remains transferable after exit.
     */
    function buyMemo(uint256 tokenId) external nonReentrant {
        Listing memory listing = listings[tokenId];
        require(listing.seller != address(0), "Not listed");
        require(msg.sender != listing.seller, "Seller cannot buy own NFT");

        require(
            cpt.transferFrom(msg.sender, listing.seller, listing.price),
            "CPT payment failed"
        );

        delete listings[tokenId];
        _transfer(address(this), msg.sender, tokenId);

        emit MemoPurchased(
            msg.sender,
            listing.seller,
            tokenId,
            listing.price
        );
    }

    function totalMinted() external view returns (uint256) {
        return nextTokenId - 1;
    }

    /**
     * @notice Return a self-contained, base64-encoded JSON metadata document.
     * @dev The image itself stays in a public GitHub repository. Keeping the
     * JSON here avoids maintaining ten nearly identical external files while
     * preserving stable metadata after transfers or club withdrawal.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        _requireOwned(tokenId);
        string memory json = string.concat(
            '{"name":"Campus-Memo #',
            Strings.toString(tokenId),
            '","description":"A limited-edition commemorative NFT of the HKU Drone Club.",',
            '"image":"',
            imageURI,
            '","attributes":[{"trait_type":"Edition","value":',
            Strings.toString(tokenId),
            '}]}'
        );
        return string.concat(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        );
    }

    /**
     * @dev The JSON builder intentionally accepts URI schemes such as https://,
     * ipfs:// and ar://. Printable URI characters are enough for this course
     * project and prevent quotes, backslashes, and control bytes from breaking
     * the generated JSON string.
     */
    function _isSafeImageURI(string memory candidate)
        private
        pure
        returns (bool)
    {
        bytes memory value = bytes(candidate);
        if (value.length == 0) return false;
        for (uint256 i = 0; i < value.length; i++) {
            uint8 character = uint8(value[i]);
            if (character < 0x21 || character > 0x7e) return false;
            if (character == 0x22 || character == 0x5c) return false;
        }
        return true;
    }
}
