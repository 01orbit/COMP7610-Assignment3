# HKU Drone Club Assignment 3

This repository contains the CPT ERC-20 token, the Campus-Memo ERC-721 collection, tests, a Sepolia deployment script, and the two-page LaTeX operation report.

## Files

- `contracts/CPT.sol`: treasury, administrator mint/distribution/deduction, membership application/approval, welcome points, and withdrawal burn.
- `contracts/CampusMemo.sol`: ten-token ERC-721 collection; each mint burns 100 CPT, and owners can list, cancel, or sell NFTs for CPT through an escrowed marketplace.
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

## Sepolia deployment

```bash
export SEPOLIA_RPC_URL="<RPC URL>"
export DEPLOYER_PRIVATE_KEY="<Sepolia test-wallet private key>"
export NFT_BASE_URI="ipfs://<CID>/"
npm run deploy:sepolia
```

Do not commit the private key or `.env` file. The report must contain the actual Sepolia addresses and URI produced by the student's deployment.
