#import "@preview/sudo-docs:0.1.0": *

#let accent = rgb("#146C94")

#let decision(title, body) = block(
  fill: rgb("#F2F7F9"),
  stroke: (left: 3pt + accent),
  radius: 4pt,
  inset: 8pt,
  breakable: true,
)[
  #text(fill: accent, weight: "bold")[Design decision: #title]\
  #body
]

#let step(number, title, action, expected, reason) = block(
  fill: rgb("#FAFBFC"),
  stroke: 0.6pt + rgb("#D8E0E6"),
  radius: 4pt,
  inset: 8pt,
  breakable: true,
)[
  #text(fill: accent, weight: "bold")[Step #number — #title]\
  #text(weight: "bold")[操作：] #action\
  #text(weight: "bold")[预期：] #expected\
  #text(fill: rgb("#4E5D68"), style: "italic")[为什么： #reason]
]

#show: project.with(
  title: "HKU Drone Club: Deployment and Verification Guide",
  subtitle: "CPT + Campus-Memo smart contract assignment",
  author: ("Full Name", "UID"),
  affiliation: "COMP7610 Smart Contract Lab",
  year: "2026",
  toc: false,
  lang: "en",
  main-color: accent,
  logo: none,
)

= Read this guide first

This document is written as an operator's guide. Follow the numbered steps in order, then use the verification table to compare the observed chain state with the intended design. Replace every redacted value before submission.

#decision(
  "Separate economic points from commemorative ownership",
  [CPT is a fungible ERC-20 resource: it can be distributed, transferred, approved, and burned. Campus-Memo is a scarce ERC-721 record: at most ten exist, each has its own token ID and URI, and an already-earned NFT remains with its owner when that member leaves.]
)

= Contract model

#adt-card(
  name: "CPT — club points",
  desc: [The constructor mints exactly 1,000 CPT to the token contract as a treasury reserve. Only `ADMIN_ROLE` can mint, distribute treasury points, or call `adminBurnPoints()` to permanently deduct a specified amount from a user's balance.],
  impl: [
    - `applyForMembership()` records a request.
    - `approveMembership()` grants membership and 50 welcome CPT.
    - `withdrawFromClub()` burns the caller's remaining CPT and revokes membership.
  ],
  funcs: [
    - Standard ERC-20 `transfer` remains available.
    - A member's existing NFT is unaffected by withdrawal.
  ]
)

#adt-card(
  name: "Campus-Memo — limited NFT",
  desc: [The ERC-721 collection has a hard cap of 10. A member must approve 100 CPT and call `mintMemo()`; the payment is burned through `burnFrom()`.],
  impl: [
    - Token IDs start at 1.
    - `tokenURI(id)` is the IPFS base URI plus the ID.
    - `safeTransferFrom()` supports ordinary NFT transfers.
  ],
  funcs: [
    - Membership is checked before minting.
    - Existing NFTs remain collectible after withdrawal.
    - `listMemo()` + `buyMemo()` exchange an escrowed NFT for CPT; `cancelMemoListing()` returns it.
  ]
)

= Local verification

Run the same checks used by the submitted implementation before using a wallet:

```bash
npm install
npm run compile
npm test
```

The test suite covers the initial treasury, admin permissions, welcome points, CPT transfers, administrator CPT deduction, withdrawal burn, preservation of an NFT after withdrawal, NFT payment burn, NFT transfers, CPT NFT purchase, listing cancellation, URI generation, and rejection of the 11th NFT.

= Sepolia deployment

#step(
  1,
  "Prepare the wallet",
  [In MetaMask select Sepolia (Chain ID `11155111`) and obtain test ETH. Use a test-only account.],
  [MetaMask shows Sepolia and the account has enough test ETH for two deployments and several calls.],
  [The assignment needs public, inspectable contract addresses; a local Remix VM address is not a Sepolia submission address.]
)

#step(
  2,
  "Prepare the metadata URI",
  [Pin the ten JSON metadata files to IPFS and set a base URI such as `ipfs://CID/`.],
  [`ipfs://CID/1.json` through `ipfs://CID/10.json` are reachable and contain name, description, image, and attributes.],
  [The URI is part of the NFT's verifiable identity and must be recorded in the final report.]
)

#step(
  3,
  "Deploy CPT",
  [In Remix compile `contracts/CPT.sol` with Solidity 0.8.24, choose `Injected Provider — MetaMask`, then deploy `CPT(initialAdmin)`.],
  [Record the CPT address. `totalSupply()` is 1,000 CPT and `balanceOf(CPT address)` is 1,000 CPT.],
  [The initial batch is held by the treasury so welcome allocations and admin distributions do not create an untracked initial balance.]
)

#step(
  4,
  "Deploy Campus-Memo",
  [Deploy `CampusMemo(cptAddress, "ipfs://CID/")` using the CPT address from Step 3.],
  [Record the Campus-Memo address. `MAX_SUPPLY()` is 10 and `MINT_COST()` is 100 CPT.],
  [The NFT contract reads membership from CPT and burns the approved payment during minting.]
)

#step(
  5,
  "Onboard a member",
  [From a student account call `applyForMembership()`. Switch back to the admin account and call `approveMembership(student)`.],
  [`isMember(student)` is true and the student balance increases by 50 CPT. A non-admin approval reverts.],
  [Members request access, but administrators remain the only parties that distribute treasury points.]
)

#step(
  6,
  "Mint and transfer",
  [The member calls `approve(campusMemoAddress, 100 CPT)`, then `mintMemo()`. Test `transfer` and `safeTransferFrom` with a second account. An owner can call `listMemo(1, price)`; a buyer approves that CPT amount and calls `buyMemo(1)`.],
  [The member owns token 1, a purchase pays CPT to the seller and changes `ownerOf(1)`, and `cancelMemoListing(1)` returns an unsold token.],
  [CPT is a transferable resource; the NFT is a transferable, individually identified, and tradeable commemorative object.]
)

#step(
  7,
  "Exit without losing the souvenir",
  [From the member account call `withdrawFromClub()`.],
  [The member's CPT balance is zero, `isMember` is false, `MemberWithdrawn` is emitted, and an unsold `ownerOf(1)` is still the former member.],
  [Membership status controls future club privileges; it does not confiscate a previously earned commemorative NFT.]
)

= Verification checklist

#table(
  columns: (1.35fr, 1.25fr, 2.7fr),
  table.header[*Check*][*Expected state*][*Evidence to capture*],
  [Initial supply], [1,000 CPT], [`totalSupply()` and treasury `balanceOf`],
  [Welcome allocation], [50 CPT], [`MembershipApproved` and member balance],
  [NFT payment], [100 CPT burned], [`totalSupply()` before/after `mintMemo()`],
  [NFT scarcity], [No token 11], [reverted `mintMemo()` transaction],
  [Exit policy], [CPT burned; NFT retained], [`isMember=false`, zero CPT, unchanged `ownerOf(1)`],
  [Metadata], [Correct IPFS URI], [`tokenURI(1)` and browser/IPFS check],
)

= Final submission record

- CPT address: `REPLACE_WITH_SEPOLIA_ADDRESS`
- Campus-Memo address: `REPLACE_WITH_SEPOLIA_ADDRESS`
- Deployment transactions: `REPLACE_WITH_TX_HASHES`
- NFT base URI: `ipfs://REPLACE_WITH_CID/`
- Example `tokenURI(1)`: `REPLACE_WITH_TOKEN_URI`
- Student name and UID: `REPLACE_WITH_FULL_NAME_AND_UID`

Keep the screenshots for MetaMask network selection, deployed contracts, member approval, NFT minting, transfers, and withdrawal with unchanged `ownerOf(1)`. This file is an additional Typst version; the existing LaTeX report remains in the project unchanged.
