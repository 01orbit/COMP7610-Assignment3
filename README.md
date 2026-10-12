# HKU Drone Club Assignment 3

This repository contains the CPT ERC-20 token, the Campus-Memo ERC-721 collection, tests, a Sepolia deployment script, and the two-page LaTeX operation report.

## Files

- `contracts/CPT.sol`: treasury, administrator mint/distribution/burn/recovery, membership application/approval, welcome points, and withdrawal burn.
- `contracts/CampusMemo.sol`: ten-token ERC-721 collection; only CPT administrators can issue NFTs to members, burning 100 CPT from the administrator per mint, and owners can list, cancel, or sell NFTs for CPT through an escrowed marketplace.
- `test/assignment3.js`: automated Hardhat tests.
- `scripts/deploy.js`: Sepolia deployment script.
- `IMPLEMENTATION_PLAN.md`: design and verification plan.
- `FullName_UID_Assignment3_Report.tex`: report template; replace all red placeholders before submission.
- `typst-sudo-docs/main.typ`: full `sudo-docs` exploration with its standard cover page.
- `typst-sudo-docs/main-compact.typ`: compact two-page `sudo-docs` version for the assignment limit.

## Local checks

```bash
npm install
npm run compile
npm test
```

## NFT issuance and trading

Only an address holding CPT's current `ADMIN_ROLE` can call
`CampusMemo.mintMemo(memberAddress)`. The recipient must be an approved member.
The administrator must hold at least 100 CPT and first call
`CPT.approve(campusMemoAddress, 100000000000000000000)` from their own account.
Each issuance burns the administrator's 100 CPT and sends the new NFT directly
to the member; the member's points are not charged. The lifetime mint cap is 10.
`MemoMinted(admin, recipient, tokenId)` records both parties.

There is no administrative NFT recovery or public NFT burn function. Owners
retain standard transfers and CPT marketplace trades, including after leaving
the club. Listing temporarily escrows the NFT; cancellation returns it to the
seller. Administrator status alone grants no authority over issued NFTs.

## Administrator point deductions

Administrators can use `adminBurnPoints(account, amount)` to destroy CPT or
`adminRecoverPoints(account, amount)` to return CPT to the token contract's
treasury for redistribution. Neither requires user approval. Recovery preserves
total supply, membership, and NFT ownership. In Remix, 20 CPT must be entered as
`20000000000000000000` (18 decimals). To verify recovery, compare the user's and
treasury's `balanceOf` before/after and confirm `totalSupply()` is unchanged.

## Sepolia deployment

```bash
export SEPOLIA_RPC_URL="<RPC URL>"
export DEPLOYER_PRIVATE_KEY="<Sepolia test-wallet private key>"
export NFT_BASE_URI="ipfs://<CID>/"
npm run deploy:sepolia
```

Do not commit the private key or `.env` file. The report must contain the actual Sepolia addresses and URI produced by the student's deployment.
