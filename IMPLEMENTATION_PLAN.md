# Assignment 3 implementation plan

## Goal

Deliver a small, reproducible HKU Drone Club membership system that can be compiled in Remix, tested automatically in Remix VM, and deployed to Sepolia with a verifiable report. The system must keep CPT accounting explicit, let administrators issue the ten commemorative NFTs, keep NFTs after membership withdrawal, and support CPT-priced secondary trading.

## Contract design

`CPT.sol` uses OpenZeppelin ERC20, ERC20Burnable and AccessControl. The initial 1,000 CPT are held by the CPT contract as a treasury. A user applies for membership; an administrator approves the application and transfers 50 welcome CPT from the treasury. The administrator can mint additional CPT, distribute treasury CPT, burn a user's CPT with `adminBurnPoints`, or recover it to the treasury with `adminRecoverPoints`. A member's `withdrawFromClub` burns all of that user's remaining CPT and clears membership. Ordinary ERC20 transfers remain available.

`CampusMemo.sol` uses ERC721 and ReentrancyGuard. Only an address with CPT's current `ADMIN_ROLE` can issue IDs 1–10 to current members. The administrator must approve 100 CPT to the NFT contract; that amount is burned from the administrator. There is no NFT burn or administrative recovery. Owners may transfer directly or list an NFT in escrow and sell it for CPT. Membership is not checked for listing, buying or ordinary transfer, so an NFT remains with a former member and can still be traded.

The constructor stores one printable image URL. `tokenURI(id)` builds the JSON on-chain and returns a base64 data URI. This avoids ten external JSON files while keeping the image in a normal version-pinned GitHub repository. The generated JSON is stable across transfers and withdrawal.

## Verification workflow

1. `npm test` runs the Hardhat suite.
2. `npm run remix:prepare` produces files ready to paste into Remix.
3. Compile both contracts in Remix with OpenZeppelin `5.0.2` imports.
4. Run `scripts/remix-test.js` in Remix VM. It deploys fresh contracts and checks the complete flow.
5. For Sepolia, set `NFT_IMAGE_URL`, `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY`, then run `npm run deploy:sepolia`.
6. Record the two addresses, transaction hashes, network chain ID `11155111`, and a decoded `tokenURI(1)` in the report.

## Files kept for submission

The LaTeX report is retained and compiled as the report artifact. Typst files and the old Gist metadata generator were removed because the final design no longer uses Typst or external JSON metadata.
