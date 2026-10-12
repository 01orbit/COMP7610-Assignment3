// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CPT
 * @notice HKU Drone Club's fungible points token.
 *
 * The first 1,000 CPT are held by this contract as the club treasury.
 * Administrators can distribute treasury points and mint additional points.
 * Administrators can also remove a specified amount of CPT from a user's
 * balance when an administrative correction or penalty is required.
 * Members can apply for membership, and an administrator approves the
 * application with a fixed welcome allocation. Members can leave by burning
 * all of their remaining CPT.
 */
contract CPT is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 public constant INITIAL_SUPPLY = 1_000 ether;
    uint256 public constant WELCOME_POINTS = 50 ether;

    mapping(address => bool) public isMember;
    mapping(address => bool) public membershipApplications;

    event MembershipApplied(address indexed applicant);
    event MembershipApproved(address indexed member, uint256 welcomePoints);
    event MemberWithdrawn(address indexed member, uint256 burnedPoints);
    event PointsDistributed(address indexed recipient, uint256 amount);
    event PointsMinted(address indexed recipient, uint256 amount);
    event PointsBurnedByAdmin(address indexed account, uint256 amount);

    constructor(address initialAdmin) ERC20("Club Point Token", "CPT") {
        require(initialAdmin != address(0), "Invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ADMIN_ROLE, initialAdmin);

        // The initial batch is the club's treasury reserve.
        _mint(address(this), INITIAL_SUPPLY);
    }

    function applyForMembership() external {
        require(!isMember[msg.sender], "Already a member");
        require(!membershipApplications[msg.sender], "Application exists");

        membershipApplications[msg.sender] = true;
        emit MembershipApplied(msg.sender);
    }

    function approveMembership(address applicant)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(applicant != address(0), "Invalid applicant");
        require(!isMember[applicant], "Already a member");
        require(membershipApplications[applicant], "No application");
        require(
            balanceOf(address(this)) >= WELCOME_POINTS,
            "Treasury is empty"
        );

        membershipApplications[applicant] = false;
        isMember[applicant] = true;
        _transfer(address(this), applicant, WELCOME_POINTS);

        emit MembershipApproved(applicant, WELCOME_POINTS);
    }

    function distributePoints(address recipient, uint256 amount)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(recipient != address(0), "Invalid recipient");
        require(balanceOf(address(this)) >= amount, "Treasury is empty");

        _transfer(address(this), recipient, amount);
        emit PointsDistributed(recipient, amount);
    }

    function mintPoints(address recipient, uint256 amount)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(recipient != address(0), "Invalid recipient");
        _mint(recipient, amount);
        emit PointsMinted(recipient, amount);
    }

    /**
     * @notice Permanently remove CPT from a user's balance.
     * @dev This is deliberately administrator-only and does not require an
     * allowance from the account. It cannot remove more than the account owns.
     */
    function adminBurnPoints(address account, uint256 amount)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(account != address(0), "Invalid account");
        require(balanceOf(account) >= amount, "Insufficient points");

        _burn(account, amount);
        emit PointsBurnedByAdmin(account, amount);
    }

    /**
     * @notice Leave the club and permanently burn all CPT held by the caller.
     * Existing NFTs are not affected, but the caller can no longer mint new
     * Campus-Memo NFTs until they submit and receive a new membership approval.
     */
    function withdrawFromClub() external {
        require(isMember[msg.sender], "Not a member");

        uint256 burnedPoints = balanceOf(msg.sender);
        isMember[msg.sender] = false;
        _burn(msg.sender, burnedPoints);

        emit MemberWithdrawn(msg.sender, burnedPoints);
    }
}
