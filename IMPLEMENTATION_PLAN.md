# COMP7610 Assignment 3 implementation plan

## Objective

Build the HKU Drone Club on-chain system required by the assignment and add three coherent member features:

1. members can apply and, after administrator approval, receive a welcome allocation of CPT;
2. members can leave by burning all CPT they still hold, which also revokes membership;
3. CPT and Campus-Memo keep the standard ERC-20/ERC-721 transfer flows.

The implementation deliberately keeps **minting and treasury distribution administrator-only**. A member may apply for membership, but only an administrator can approve the application and move the welcome allocation from the club treasury. This preserves the assignment's permission requirement.

## Contract design

### `contracts/CPT.sol`

- OpenZeppelin `ERC20`, `ERC20Burnable`, and `AccessControl`.
- Symbol: `CPT`; decimals: the OpenZeppelin default of 18.
- The constructor mints exactly `1,000 ether` to the CPT contract address as the club treasury.
- `ADMIN_ROLE` can call `mintPoints()` for additional points, `distributePoints()` for treasury distributions, and `adminBurnPoints()` to permanently deduct a specified amount from a user's balance.
- `applyForMembership()` records a member's application.
- `approveMembership()` is administrator-only, marks the address as a member, and transfers `50 CPT` from the treasury as welcome points.
- `withdrawFromClub()` is member-only, burns the caller's remaining CPT, and revokes membership.
- `adminBurnPoints()` is administrator-only, requires sufficient balance, burns the requested amount, and emits `PointsBurnedByAdmin`.
- `adminRecoverPoints()` is administrator-only, requires a nonzero account and sufficient balance, and transfers the requested amount to `address(this)` without an allowance. It emits `PointsRecoveredByAdmin`; recovered CPT can be redistributed, while total supply, membership, and NFT ownership remain unchanged.
- Standard `transfer`, `approve`, `transferFrom`, and `burn` remain available.

### `contracts/CampusMemo.sol`

- OpenZeppelin `ERC721` and `ReentrancyGuard`.
- Name: `Campus-Memo`; symbol: `CMEMO`.
- `MAX_SUPPLY = 10`; token IDs start at 1.
- Only an address with CPT's current `ADMIN_ROLE` can call `mintMemo(memberAddress)`. The recipient must be a member. The administrator holds and approves `100 CPT` before issuing the NFT directly to the member.
- `mintMemo(memberAddress)` burns 100 CPT from the administrator, leaving the recipient's CPT unchanged. `MemoMinted(admin, recipient, tokenId)` records issuance. CPT role grants/revocations are checked on each call.
- `tokenURI()` is generated from the constructor-supplied IPFS base URI, such as `ipfs://CID/1`.
- Standard `safeTransferFrom()` and approval functions remain available.
- An owner can call `listMemo(tokenId, price)` to escrow an NFT for a CPT price. A buyer approves the marketplace contract for that price and calls `buyMemo(tokenId)`; CPT moves to the seller and the NFT moves to the buyer.
- A seller can call `cancelMemoListing(tokenId)` to recover an escrowed NFT. Sellers do not need to remain club members, so an NFT can still be traded after withdrawal.

## Invariants and security decisions

- No non-administrator can mint CPT, distribute treasury CPT, or invoke `adminBurnPoints()` or `adminRecoverPoints()`.
- Membership approval requires an application and cannot be repeated while membership is active.
- NFT supply can never exceed 10. Issued NFTs have no public burn or administrative recovery function; only owners or their authorized operators can transfer them.
- NFT minting checks administrator permission, recipient membership, and the lifetime cap before burning the administrator's CPT; it uses `nonReentrant`.
- A member's withdrawal does not destroy existing NFTs; it only burns remaining CPT and prevents further NFT issuance to that address until membership is approved again.
- The initial 1,000 CPT reserve is separate from later administrator minting, making the initial-supply requirement auditable.

## Verification plan

`test/assignment3.js` covers initial supply, membership approval, unauthorized approval, CPT transfer, administrator CPT deduction, withdrawal burn, NFT payment burn, NFT transfer, CPT NFT purchase, listing cancellation, URI generation, and the ten-NFT cap. Run:

```bash
npm install
npm run compile
npm test
```

## Sepolia deployment plan

Set `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, and `NFT_BASE_URI`, then run:

```bash
npm run deploy:sepolia
```

Record the printed CPT address, Campus-Memo address, deployment transaction hashes, Sepolia Chain ID `11155111`, and the final IPFS URI in the report. Verify the contracts on Sepolia Etherscan before submission.

## Current status

- Contracts implemented.
- Hardhat compilation passes.
- Twenty-two automated tests pass, including administrator-only NFT issuance, role grant/revocation, administrator payment, rejection of non-member recipients, unauthorized NFT transfer, and trading after withdrawal.
- LaTeX report template prepared with placeholders for the student's name, UID, screenshots, Sepolia addresses, and IPFS CID.
- A real Sepolia deployment is still an external-wallet operation and must be performed with the student's funded MetaMask account.
