#import "@preview/sudo-docs:0.1.0": *

#let accent = rgb("#4D1D14")
#let light = rgb("#F5F2F0")

#set document(
  title: "HKU Drone Club: Deployment and Verification Guide",
  author: "Full Name / UID",
)
#set page(
  paper: "a4",
  margin: (top: 1.45cm, bottom: 1.2cm, x: 1.55cm),
  numbering: "1",
  number-align: right,
  header: context {
    align(right)[
      #text(size: 7pt, fill: accent.lighten(20%), style: "italic")[
        COMP7610 · CPT + Campus-Memo
      ]
    ]
  },
  footer: context {
    align(right)[#text(size: 7pt)[#counter(page).display()]]
  },
)
#set text(font: "Noto Serif", size: 8.8pt, lang: "en")
#set par(leading: 0.55em, justify: true)
#set heading(numbering: "1.")
#show heading: set text(fill: accent, weight: "bold")
#show heading: set block(above: 0.75em, below: 0.35em)
#show raw.where(block: true): it => block(
  fill: luma(242),
  inset: 6pt,
  radius: 3pt,
  width: 100%,
  stroke: (left: 3pt + accent),
  [
    #set text(font: "DejaVu Sans Mono", size: 7.5pt)
    #raw(it.text, lang: it.lang, block: false)
  ]
)

#let decision(title, body) = block(
  fill: light,
  stroke: (left: 2.5pt + accent),
  radius: 3pt,
  inset: 6pt,
  breakable: true,
)[
  #text(fill: accent, weight: "bold")[Design decision: #title]\
  #body
]

#let step(number, title, action, expected, reason) = block(
  fill: rgb("#FBFBFB"),
  stroke: 0.45pt + rgb("#D9D2CE"),
  radius: 3pt,
  inset: 5pt,
  breakable: true,
)[
  #text(fill: accent, weight: "bold")[Step #number — #title]\
  #text(weight: "bold")[操作：] #action\
  #text(weight: "bold")[预期：] #expected\
  #text(fill: rgb("#5A5551"), style: "italic")[为什么： #reason]
]

#align(center)[
  #text(size: 17pt, fill: accent, weight: "bold")[HKU Drone Club]\
  #text(size: 12pt, weight: "bold")[Deployment and Verification Guide]\
  #text(size: 8.5pt, style: "italic")[CPT + Campus-Memo · COMP7610 Smart Contract Lab]\
  #text(size: 8pt)[Full Name · UID · Sepolia Chain ID 11155111]
]

= Purpose and design

Follow the steps in order, then compare the observed chain state with the checklist. CPT is the club's fungible economic resource; Campus-Memo is a scarce commemorative record. A member's exit burns remaining CPT and revokes future club privileges, while an already-earned NFT remains with its owner.

#adt-card(
  name: "CPT — club points",
  desc: [The constructor mints exactly 1,000 CPT to the token contract as treasury reserve. Only `ADMIN_ROLE` can mint, distribute treasury points, or call `adminBurnPoints()` to permanently deduct a specified amount from a user's balance.],
  impl: [
    - `applyForMembership()` → application.
    - `approveMembership()` → membership + 50 welcome CPT.
    - `withdrawFromClub()` → burn remaining CPT + revoke membership.
  ],
  funcs: [
    - Standard `transfer`, `approve`, and `transferFrom` remain available.
    - Withdrawal does not touch existing NFTs.
  ]
)

#adt-card(
  name: "Campus-Memo — limited NFT",
  desc: [ERC-721 collection with a hard cap of 10. A member approves 100 CPT and calls `mintMemo()`; the payment is burned through `burnFrom()`.],
  impl: [
    - Token IDs start at 1; URI is IPFS base URI + ID.
    - `safeTransferFrom()` supports NFT transfers.
  ],
  funcs: [
    - Membership is checked before minting.
    - Existing NFTs remain collectible after withdrawal.
    - `listMemo()` + `buyMemo()` exchange an escrowed NFT for CPT; `cancelMemoListing()` returns it.
  ]
)

Run the local verification first:

```bash
npm install
npm run compile
npm test
```

= Sepolia operation

#step(1, "Prepare wallet", [Select Sepolia in MetaMask and obtain test ETH. Use a test-only account.], [MetaMask shows Chain ID `11155111` and enough ETH for deployments and calls.], [The report needs public, inspectable Sepolia addresses.])

#step(2, "Prepare URI", [Pin ten JSON metadata files to IPFS and set `ipfs://CID/` as the base URI.], [`ipfs://CID/1.json` through `10.json` are reachable and include name, description, image, and attributes.], [The URI is part of the NFT identity and must be reported.])

#step(3, "Deploy CPT", [In Remix compile `contracts/CPT.sol` with Solidity 0.8.24, choose `Injected Provider — MetaMask`, and deploy `CPT(initialAdmin)`.], [Record the address; `totalSupply()` and treasury `balanceOf` are both 1,000 CPT.], [The first batch is an auditable treasury reserve.])

#step(4, "Deploy Campus-Memo", [Deploy `CampusMemo(cptAddress, "ipfs://CID/")` with the CPT address from Step 3.], [Record the address; `MAX_SUPPLY()` is 10 and `MINT_COST()` is 100 CPT.], [The NFT reads membership from CPT and burns the approved payment.])

#step(5, "Onboard a member", [From a student account call `applyForMembership()`. As admin call `approveMembership(student)`.], [`isMember(student)` is true and the balance increases by 50 CPT; a non-admin approval reverts.], [Members request access, but administrators alone distribute treasury points.])

#step(6, "Mint, transfer, and trade", [The member calls `approve(campusMemoAddress, 100 CPT)`, then `mintMemo()`. Test CPT `transfer` and NFT `safeTransferFrom`. An NFT owner can call `listMemo(tokenId, price)`; a buyer approves that CPT amount and calls `buyMemo(tokenId)`.], [Token 1 is owned by the member, a purchase pays CPT to the seller and changes `ownerOf(1)`, and `cancelMemoListing()` returns an unsold token.], [CPT is fungible; each NFT is individually identified, transferable, and tradeable after escrow.])

#step(7, "Exit without losing the souvenir", [The member calls `withdrawFromClub()`.], [CPT balance is zero, `isMember=false`, `MemberWithdrawn` is emitted, and an unsold `ownerOf(1)` is still the former member.], [Membership status controls future privileges and does not confiscate a commemorative NFT.])

= Verification checklist

#table(
  columns: (1.2fr, 1.2fr, 2.6fr),
  table.header[*Check*][*Expected*][*Evidence*],
  [Initial supply], [1,000 CPT], [`totalSupply()` + treasury `balanceOf`],
  [Welcome allocation], [50 CPT], [`MembershipApproved` + balance],
  [NFT payment], [100 CPT burned], [`totalSupply()` before/after mint],
  [Scarcity], [No token 11], [reverted 11th mint],
  [Exit policy], [CPT burned; NFT retained], [`isMember=false`, zero CPT, unchanged `ownerOf(1)`],
  [Metadata], [Correct URI], [`tokenURI(1)` + IPFS check],
)

= Submission record

- CPT: `REPLACE_WITH_SEPOLIA_ADDRESS`  ·  Campus-Memo: `REPLACE_WITH_SEPOLIA_ADDRESS`
- Transactions: `REPLACE_WITH_TX_HASHES`
- NFT URI: `ipfs://REPLACE_WITH_CID/`  ·  `tokenURI(1)`: `REPLACE_WITH_TOKEN_URI`
- Student: `REPLACE_WITH_FULL_NAME_AND_UID`

Insert screenshots of MetaMask, both deployments, membership approval, NFT mint/transfer/purchase, and withdrawal with unchanged `ownerOf(1)` when unsold. This compact Typst version is additional; the existing LaTeX report is retained alongside it.
