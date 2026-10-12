# Remix / Sepolia 部署与验证手册

这份手册按“完全没有部署经验”的顺序编写。建议先完成第 1–8 节的 Remix VM 自动测试，再决定是否把同一套合约部署到 Sepolia。Remix VM 测试会自己部署全新的 CPT 和 CampusMemo，不会使用你钱包里已有的合约。

## 1. 先理解最终设计

项目有两个合约：

- `CPT` 是会员积分 ERC-20。初始 1,000 CPT 在 CPT 合约自己的地址中，管理员批准申请时从储备转出 50 CPT 欢迎积分。管理员可以增发、从储备分发、直接销毁用户 CPT，或把用户 CPT 回收到储备。会员退出时，自己的全部 CPT 被销毁，会员状态清除。
- `CampusMemo` 是 ERC-721。只有 CPT 的当前 `ADMIN_ROLE` 可以向当前会员发行 NFT，每枚由管理员支付并销毁 100 CPT。NFT 没有管理员销毁或回收功能；用户退出后仍拥有已经拿到的 NFT。NFT 拥有者可以直接转让，也可以挂单让买家用 CPT 购买。

NFT 元数据采用“链上 JSON + GitHub 图片”：GitHub 只保存一张图片，合约构造函数保存这张图片的固定版本 Raw URL，`tokenURI(id)` 动态生成带有编号的 JSON，并返回 `data:application/json;base64,...`。因此不需要 Gist，也不需要 `campus-memo-1.json` 到 `campus-memo-10.json`。

## 2. 准备本地项目

在项目根目录执行：

```bash
npm install
npm run compile
npm test
```

`npm test` 应全部通过。它使用 Hardhat 本地链，不会访问 GitHub，不需要 MetaMask，也不会花费 Sepolia ETH。

如果你只想先准备给 Remix 的文件：

```bash
npm run remix:prepare
```

命令会生成 `output/remix/contracts/CPT.sol`、`output/remix/contracts/CampusMemo.sol` 和 `output/remix/scripts/remix-test.js`。这些文件是根据当前源码自动复制的，不能把旧的 `output/remix` 文件与新源码混用。

## 3. 准备唯一一张 NFT 图片

### 3.1 在 GitHub 仓库提交图片

1. 在一个公开 GitHub 仓库中创建例如 `images/campus-memo.png` 的图片文件。
2. 提交并推送。
3. 打开该文件的提交记录，复制**完整 40 位 commit SHA**。
4. 组成固定版本 Raw URL：

```text
https://raw.githubusercontent.com/你的用户名/仓库名/完整40位commitSHA/images/campus-memo.png
```

不要使用 `main`、`master` 或其他会变化的分支地址。路径可以是 `.png`、`.jpg` 或其他浏览器支持的格式，只要最终 URL 没有 query、fragment、用户名或密码即可。

把最终 Raw URL 放进浏览器无痕窗口，确认无需登录就能显示图片。合约和部署脚本不会替你下载或检查图片内容，因此必须在部署前完成这一步。完整 commit SHA 固定了图片版本，但仓库仍需保持公开和可访问。

部署脚本和合约还要求 URL 使用可打印字符，不能包含空格、双引号或反斜杠。GitHub Raw URL 天然满足这一点。

### 3.2 这一步不需要做什么

不需要创建 GitHub Gist，不需要建立十个 JSON 文件，也不需要把图片下载进 Solidity 项目。链上 JSON 会引用这一个图片地址；图片内容本身仍由 GitHub 托管。

## 4. 查看和验证链上元数据

发行 NFT 后，在 `CampusMemo` 的 `tokenURI` 中输入 `1`。结果应该以如下前缀开始：

```text
data:application/json;base64,
```

复制完整结果，在本地终端解码：

```bash
npm run metadata:decode -- '把完整tokenURI粘贴在这里'
```

预期 JSON 形状如下，编号会随 token ID 改变：

```json
{
  "name": "Campus-Memo #1",
  "description": "A limited-edition commemorative NFT of the HKU Drone Club.",
  "image": "https://raw.githubusercontent.com/USER/REPO/<commitSHA>/images/campus-memo.png",
  "attributes": [
    { "trait_type": "Edition", "value": 1 }
  ]
}
```

也可以在浏览器开发者工具中只做本地解码：

```js
const uri = `把完整 tokenURI 粘贴在这里`;
JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(uri.split(",")[1]), c => c.charCodeAt(0))));
```

`image` 应与构造函数中保存的 `imageURI` 完全相同；`name` 和 `Edition` 应与 token ID 相同。转让 NFT 或退出会员后再次调用 `tokenURI(1)`，JSON 应保持相同。

## 5. 在 Remix 中打开项目

1. 打开 Remix Desktop 或 `https://remix.ethereum.org`。
2. 在左侧 **File explorers** 中建立 `contracts/CPT.sol`、`contracts/CampusMemo.sol` 和 `scripts/remix-test.js`。
3. 将本地 `output/remix/` 中的三个文件复制进去。不要直接复制 `node_modules`。
4. 如果你手工复制源码，确认 import 是版本固定的：

```solidity
import {ERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol";
```

`prepare-remix.js` 已经自动做了这一步。Remix 可以从 GitHub/npm 找到该版本的 OpenZeppelin；编译时需要联网。

## 6. 编译两个合约

1. 点击左侧 **Solidity compiler**。
2. Compiler version 选择 `0.8.24` 或兼容的 `0.8.x`。
3. 打开 **Advanced configurations**，开启 optimizer、runs 设为 `200`，EVM 版本选择 `paris`，与本地 Hardhat 配置一致。
4. 确认 **Generate contract metadata** 开启，点击 **Compile CPT.sol**。
5. 在合约下拉框选择 `CampusMemo`，点击 **Compile CampusMemo.sol**。
6. 两个合约都出现绿色成功标记后，再运行自动测试。

如果出现 `Source ... not found`，优先重新运行 `npm run remix:prepare`，再把带 `@5.0.2` 的文件复制进去。不要把 OpenZeppelin 5.x 和旧版 OpenZeppelin 文件混在同一个 Remix 工作区。

## 7. Remix VM 自动测试

### 7.1 选择本地链

1. 打开左侧 **Deploy & run transactions**。
2. Environment 选择 **Remix VM (Cancun)** 或当前可用的 Remix VM。
3. 账户至少保留四个默认账户。
4. 不要选择 Injected Provider，不要连接 MetaMask。

脚本开头会检查 chain ID，只允许 `1337` 或 `31337`。如果误选 Sepolia，它会在读取账户和发送交易前停止。

### 7.2 运行脚本

1. 在左侧 **File explorers** 中打开 `scripts/remix-test.js`。
2. 右键文件，选择 **Run**；某些 Remix 版本的菜单名称是 **Run JavaScript**。
3. 在 Remix console 等待输出。

成功结尾应包含：

```text
ALL TESTS PASSED: 22 groups, 333 assertions.
MAINLINE CPT: 0x...
MAINLINE CampusMemo: 0x...
Final mainline: A/B/C = 0 CPT; treasury/supply = 700 CPT; NFT #1 = B; NFTs #2-10 = C.
```

脚本覆盖：初始储备、会员申请、欢迎积分、管理员权限、管理员扣除与回收、管理员支付并发行 NFT、NFT 所有权、退出后保留 NFT、普通转让、CPT 挂单购买、卖家取消、供应上限、ID 2–10 元数据解码、管理员角色变更和失败交易的状态保持。脚本会在隔离 fixture 中重复部署，避免最后一个场景破坏主流程的余额表。

如果 console 出现 `Cannot find CPT.json`，说明没有同时编译两个合约，或 Remix 版本把 artifact 放在了不同目录；重新编译后再次右键运行即可。

## 8. 手动复核关键合约调用

自动脚本通过后，可以用 Remix 的 **Deployed Contracts** 面板手动复核。下面的参数中，地址都使用当前 Remix VM 面板显示的账户地址。

### 8.1 部署参数

用 **Deploy** 面板分别部署：

1. `CPT`：构造参数填部署者账户地址。
2. `CampusMemo`：第一个参数填 CPT 合约地址；第二个参数填第 3 节的完整图片 URL。

CampusMemo 构造函数不会访问 GitHub，它只验证 URL 字符是否能安全放入 JSON。`imageURI()` getter 应返回刚才填入的图片 URL。

### 8.2 会员与欢迎积分

在 CPT 面板：

1. 切换账户 B，调用 `applyForMembership()`。
2. 切回管理员 A，调用 `approveMembership(B)`。
3. 查询 `isMember(B)`，应为 `true`。
4. 查询 `balanceOf(B)`，应为 `50000000000000000000`，即 50 CPT。

### 8.3 管理员发行 NFT

管理员 A 必须先有 100 CPT。可调用 `distributePoints(A, 100000000000000000000)` 从储备转入，再调用：

1. CPT `approve(CampusMemo地址, 100000000000000000000)`。
2. CampusMemo `mintMemo(B)`。
3. 查询 `ownerOf(1)`，应为 B。
4. 查询 `tokenURI(1)`，复制并按第 4 节解码。
5. 查询 CPT `totalSupply()`，应减少 100 CPT；B 的 CPT 不应因发行被扣除。

只有 CPT 当前 `ADMIN_ROLE` 能发行；普通会员调用会失败。管理员不能直接 `transferFrom(B, A, 1)`，因为 ERC-721 仍然遵循拥有者授权。

### 8.4 管理员扣除、回收和会员退出

- `adminBurnPoints(B, amount)`：直接从 B 销毁，减少 B 余额和总供应量。
- `adminRecoverPoints(B, amount)`：直接转回 CPT 储备，不需要 B 授权，总供应量不变，会员状态和 NFT 不变。
- B 调用 `withdrawFromClub()`：B 的剩余 CPT 全部销毁，`isMember(B)` 变为 `false`，但 `ownerOf(1)` 仍是 B，`tokenURI(1)` 仍然可读。

### 8.5 NFT 转让和 CPT 交易

普通转让可以调用 `safeTransferFrom(from, to, tokenId)`。CPT 交易步骤为：

1. 当前拥有者调用 `listMemo(tokenId, price)`，NFT 进入 CampusMemo 合约托管。
2. 买家在 CPT 中调用 `approve(CampusMemo地址, price)`。
3. 买家调用 `buyMemo(tokenId)`。
4. 查询 `ownerOf(tokenId)`，应变成买家；CPT price 转给卖家，listing 清空。
5. 卖家可以在购买前调用 `cancelMemoListing(tokenId)`。

挂单、购买和普通转让都不要求当前为会员，所以退出后仍能继续持有和交易已获得的 NFT。

## 9. Sepolia 部署

### 9.1 准备 MetaMask

1. MetaMask 切换到 **Sepolia test network**。
2. 使用测试账户，不要使用存放真实资产的钱包。
3. 准备少量 Sepolia ETH 作为 gas。
4. 需要让助教查看时，提交合约地址和网络名称；合约交易和公开状态可在 Sepolia Etherscan 查看。

### 9.2 用 Hardhat 脚本部署

本地终端设置变量：

```bash
export SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/你的KEY"
export DEPLOYER_PRIVATE_KEY="0x你的Sepolia测试钱包私钥"
export NFT_IMAGE_URL="https://raw.githubusercontent.com/USER/REPO/<40位commitSHA>/images/campus-memo.png"
npm run deploy:sepolia
```

脚本会在交易前检查：HTTPS、`raw.githubusercontent.com`、用户名、仓库名、40 位 commit SHA、图片路径，以及没有 query/fragment。成功后记录：

- `CPT` 合约地址和 deployment transaction hash；
- `CampusMemo` 合约地址和 deployment transaction hash；
- `NFT image URL`。

脚本不会把私钥写入源码。也可以不用脚本，直接在 Remix 的 Injected Provider 连接 MetaMask，按第 8.1 节手动部署；两种方式使用相同的两个构造参数。

### 9.3 Sepolia 上演示正式部署结果

不要在 Sepolia 运行 `scripts/remix-test.js`，因为它会部署多组新合约并消耗 gas。Sepolia 上按以下顺序手动复核：

1. CPT `name`、`symbol`、`totalSupply` 和 CPT 合约储备余额。
2. CampusMemo `cpt()`、`MAX_SUPPLY()`、`imageURI()`。
3. 用测试账户申请会员，管理员批准。
4. 管理员准备 100 CPT、批准 CampusMemo、发行一枚 NFT。
5. 调用 `tokenURI(1)` 并在本地解码；确认 `image` 是固定 commit URL。
6. 在报告中记录交易哈希、区块浏览器链接和截图。

## 10. 报告和提交材料

建议保存以下证据：

- 两个合约的源码和编译成功截图；
- Remix VM 自动测试 console 的完整成功结尾；
- Sepolia 网络名称和 chain ID `11155111`；
- CPT、CampusMemo 地址及部署交易哈希；
- `imageURI()` 的完整值；
- `tokenURI(1)` 的完整原始 data URI 和解码 JSON，报告必须包含 NFT URI；可另附文本文件方便助教复制，但不能仅用前缀代替报告里的完整值；
- 会员批准、NFT 发行、NFT 买卖、退出后保留 NFT 的交易截图。

`FullName_UID_Assignment3_Report.tex` 是现有 LaTeX 报告源文件。将其中姓名、UID、地址、交易哈希、图片 URL、解码后的 JSON 和截图占位符替换为你的实际值后编译。不要删除旧的 `.tex` 文件；报告 PDF 会输出到 `output/pdf/`。

## 11. 常见问题

| 现象 | 处理 |
|---|---|
| `Invalid image URI` | URL 必须非空，只用可打印字符；部署脚本要求固定 40 位 commit SHA 的 GitHub Raw URL。 |
| `Source ... not found` | 重新运行 `npm run remix:prepare`，复制带 `@5.0.2` 的合约，重新编译。 |
| 自动脚本提示只能在 local VM | 当前选了 Sepolia 或 Injected Provider；切回 Remix VM。 |
| `Cannot find CPT.json` | 两个合约都编译，并在当前 Remix 工作区运行脚本。 |
| `ERC20InsufficientAllowance` | 发行前，管理员批准 CampusMemo 100 CPT；购买前，买家批准 listing price。 |
| `Recipient is not a club member` | 先让该账户申请，再由当前 CPT 管理员批准。 |
| `tokenURI` 不是 HTTP 链接 | 这是预期设计；它是 `data:application/json;base64,...`，按第 4 节解码。 |
| 图片无法显示 | 先把解码 JSON 中的 `image` URL 单独放入浏览器；检查仓库公开、commit SHA 正确、路径大小写正确。JSON 仍然在链上，不会因图片暂时不可访问而丢失。 |
| NFT 退出后仍可查询 | 这是设计要求：退出只销毁 CPT 和会员资格，不销毁或回收 NFT。 |

## 12. 设计取舍

课程作业规模很小，十个固定 JSON 文件会引入 Gist 创建、revision 锁定、Content-Type 和文件命名等额外操作。当前方案把只有 token ID 不同的字段放入链上 JSON，链下只保留图片，步骤更少，也更容易在 Remix 中验证。真实大型项目可以使用 IPFS/Arweave 的不可变 JSON CID；本作业使用 data URI 是为了展示合约逻辑和减少外部服务依赖。
