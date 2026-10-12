# 从 GitHub 图片到网页版 Remix + MetaMask + Sepolia：逐步骤指南

本指南对应当前项目：新会员欢迎积分 **5 CPT**，初始储备 1,000 CPT，最多发行 10 枚 NFT，每枚由管理员支付并销毁 100 CPT。NFT 的 JSON 在链上动态生成，GitHub 仅存放图片，无需 Gist 或十份 JSON。

流程：上传图片 → 准备 Remix 文件 → 编译 → 在 Remix VM 运行完整测试 → 连接 MetaMask / Sepolia → 部署两个合约 → 只读脚本检查初始状态 → 演示功能 → 只读脚本检查演示结果。

本指南没有替你操作钱包或部署。本次新增 Sepolia 检查脚本，只检查语法，未连接钱包或执行链上检查；欢迎积分修改后的完整测试也未代你重跑。

## 1. 上传 NFT 图片到 GitHub 远程仓库

### 1.1 创建或选择公开仓库

1. 登录 GitHub，打开用于存放图片的仓库；没有的话，点击 **New repository** 创建一个。
2. 仓库设为 **Public**，例如命名为 `campus-memo-assets`。
3. 在仓库中点击 **Add file → Upload files**。
4. 上传你的图片，例如 `campus-memo.png`，建议文件名使用英文、数字和短横线。
5. 填写提交说明，例如 `Add Campus-Memo image`，点击 **Commit changes**。如果 GitHub 要求先提交到分支并开 PR，先将它合并，再取最终图片版本。

直接放在仓库根目录即可。若你已有 `images` 文件夹，也可以打开该文件夹再上传，后面的 URL 要包含该目录。[GitHub 上传文件说明](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)。

若你平常通过本地 Git 管理仓库，可以把图片放入该仓库后执行 `git add`、`git commit` 和 `git push`；最终效果相同，不必重复用网页上传。

### 1.2 取得固定版本的图片 URL

1. 打开刚提交的图片文件页面。
2. 按键盘 **`y`**。GitHub 会把链接中的分支名替换为固定 commit SHA。[GitHub 永久链接说明](https://docs.github.com/en/repositories/working-with-files/using-files/getting-permanent-links-to-files)。
3. 复制地址栏中完整的 **40 位十六进制 commit SHA**，不要只复制页面里显示的短编号。
4. 将地址改为以下 Raw URL 形式。

图片在根目录：

```text
https://raw.githubusercontent.com/你的用户名/你的仓库名/完整40位commitSHA/campus-memo.png
https://raw.githubusercontent.com/01orbit/drone-nft-picture/2c2f2b64bbacf9f201216d6a8e9ec9e557df650f/drone-nft.png
```

图片在 `images` 目录：

```text
https://raw.githubusercontent.com/你的用户名/你的仓库名/完整40位commitSHA/images/campus-memo.png
```

例如，页面链接中若出现 `/blob/<commitSHA>/images/campus-memo.png`，Raw 地址就是将域名改为 `raw.githubusercontent.com`，并去掉 `/blob` 那一段。

5. 在浏览器无痕窗口打开最终 Raw URL，确认没有登录也能直接看见图片。
6. 把完整 URL 保存下来，后文简称 **IMAGE_URL**。

不要把 GitHub 图片展示页的 `/blob/` 链接当成图片 URL。不要使用 `main` 或 `master` 作为版本字段；完整 SHA 能固定内容。图片 URL 部署后不能修改，所以先确认路径、大小写和访问权限。仓库之后仍需保持公开和可访问。

## 2. 准备钱包、账户和记录表

### 2.1 准备三个 MetaMask 测试账户

建议使用三个独立地址：

| 代号 | 用途 |
|---|---|
| A | 部署者、俱乐部管理员 |
| B | 新会员、首枚 NFT 接收者和卖家 |
| C | 另一位会员、NFT 买家 |

在 MetaMask 中创建或选择这些账户，记录各自 `0x...` 地址。创建额外账户不等于授予管理员权限；本指南只有 A 拥有初始管理员权限。

A、B、C 都需要少量 **Sepolia ETH** 来支付自己发送交易的 gas。CPT 是积分，不能用于支付 Ethereum 的 gas。只读查询不需要付 gas。

### 2.2 选择 Sepolia

1. 在 MetaMask 网络设置中开启 **Show test networks**，显示测试网络。
2. 选择 **Sepolia / Ethereum Sepolia**。
3. Remix 连上之后，再确认 **Remix 这个已连接网站使用的网络**是 Sepolia。新版 MetaMask 可按网站管理网络，钱包列表的显示筛选与网站当前网络不一定相同。

官方参考：[显示测试网络](https://support.metamask.io/configure/networks/how-to-view-testnets-in-metamask)、[切换网络](https://support.metamask.io/configure/networks/how-to-change-networks)。

从你可以使用的 Sepolia faucet 领取测试 ETH。使用测试账户，无需导出私钥，也无需填写 RPC key：下面的部署完全通过网页版 Remix 和 MetaMask 完成。

### 2.3 建立记录表

把以下内容保存在自己的笔记中：

```text
A（管理员） = 0x861BCc126C001A3313F58436c7629a1B168883aE
B（会员） = 0x136bD9945a73Ba50A060Ea4362f33ede7727332d
C（买家） = 0xa66AebD84583dc72F4803c22EbC4fB34b1908144
IMAGE_URL = https://raw.githubusercontent.com/01orbit/drone-nft-picture/2c2f2b64bbacf9f201216d6a8e9ec9e557df650f/drone-nft.png
T（CPT 合约） = 部署后填写
N（CampusMemo 合约） = 部署后填写
CPT 部署交易哈希 =
CampusMemo 部署交易哈希 =
```

**账户地址、CPT 合约地址和 CampusMemo 合约地址不能混用。** 后文中的 `A`、`B`、`C`、`T`、`N` 都表示表中真实的完整地址，不是让你在 Remix 输入单个字母。

## 3. 把项目文件上传到网页版 Remix

### 3.1 在本地生成专用于 Remix 的文件

在本项目根目录执行：

```bash
npm run remix:prepare
```

如果尚未安装依赖，可以先执行 `npm install`。准备命令只复制文件，不编译、不部署、不运行测试。

生成目录为 `output/remix/`，包含：

```text
contracts/
  CPT.sol
  CampusMemo.sol
scripts/
  remix-test.js
  remix-sepolia-check.js
```

准备脚本会将源码中的 OpenZeppelin import 改成 `@openzeppelin/contracts@5.0.2/...`，便于 Remix 下载固定版本依赖。不要上传 `node_modules`。

### 3.2 上传到网页工作区

1. 打开 [网页版 Remix](https://remix.ethereum.org/)。
2. 在左侧 **File Explorer / File explorers** 创建一个独立工作区，例如 `assignment3`。
3. 建立 `contracts` 和 `scripts` 两个文件夹。
4. 使用文件浏览器中的上传按钮，把上面四个文件放入相应目录。如果你的界面不方便指定上传目录，也可以新建同名文件，粘贴对应文件的完整内容。
5. 打开 `CPT.sol`，确认 `WELCOME_POINTS = 5 ether`。
6. 打开 `CampusMemo.sol`，确认构造参数为 `cptAddress` 和 `imageURI_`，并且含 `Base64` import。

应上传最新生成的文件，避免误用欢迎积分仍为 50 CPT 的旧副本。

## 4. 在 Remix 编译

编译发生在 Remix，**不依赖钱包、不产生 gas，也不需要先连接 MetaMask**。

1. 点击左侧 **Solidity Compiler**。
2. Compiler version 选择 **`0.8.24`**。
3. 打开 **Advanced configurations**，开启 optimizer，runs 填 **`200`**，EVM version 选择 **`paris`**。
4. 在 Remix Settings 的编译设置中开启 **Generate contract metadata**；位置可能随版本不同。它用于生成 JavaScript 测试需要的 ABI 和 bytecode 文件，与 NFT 元数据 JSON 是两回事。
5. 在文件浏览器打开 `contracts/CPT.sol`，点击 **Compile CPT.sol**。
6. 打开 `contracts/CampusMemo.sol`，点击 **Compile CampusMemo.sol**。
7. 确认两个合约均成功编译，没有红色 error。首次编译需要联网下载 OpenZeppelin 依赖。

不要部署 `ICPTMembership` 接口。稍后合约下拉框应选择实际的 **CPT** 或 **CampusMemo**。

官方参考：[Deploy & Run](https://remix-ide.readthedocs.io/en/latest/run.html)、[运行脚本及生成编译 metadata](https://remix-ide.readthedocs.io/en/latest/running_js_scripts.html)。

## 5. 先在 Remix VM 运行完整自动测试

`remix-test.js` 是完整的功能测试，会部署新合约、发行积分、交易 NFT、退出会员并发行满十枚。它使用 Remix VM 的默认解锁账户，因此**只允许在本地 VM 运行**。

1. 打开左侧 **Deploy & Run Transactions**。
2. Environment 选择 **Remix VM (Cancun)**；若没有该标签，使用可用的 Remix VM。脚本允许 chain ID `1337` 或 `31337`。
3. 不必连接 MetaMask，保留至少四个默认 VM 账户。
4. 在文件浏览器中右键 `scripts/remix-test.js`，选择 **Run**；也可以使用脚本编辑器的运行按钮。
5. 等待 Remix 底部 terminal 输出完成。

成功结尾应类似：

```text
ALL TESTS PASSED: 22 groups, 333 assertions.
MAINLINE CPT: 0x...
MAINLINE CampusMemo: 0x...
Final mainline: A/B/C = 0 CPT; treasury/supply = 700 CPT; NFT #1 = B; NFTs #2-10 = C.
```

这是脚本的预期输出，不是本次替你执行后的结果。VM 测试使用离线示例图片地址，不下载图片；实际 GitHub 图片必须在第 1 节单独验证。

VM 合约地址仅用于本地测试，**不要作为作业的 Sepolia 最终地址**。后文会重新部署正式测试网合约。

如果脚本提示缺少 `CPT.json` 或 `CampusMemo.json`，先确认 Generate contract metadata 开启，再重新编译两个合约；文件名和目录应与第 3 节一致。

## 6. 让网页版 Remix 通过 MetaMask 连接 Sepolia

1. 打开 MetaMask，解锁并选择管理员账户 **A**。
2. 在 Remix 的 **Deploy & Run Transactions** 中，将 Environment 从 Remix VM 改为 **Browser Extension**，选择 **MetaMask**。部分版本显示 **Injected Provider - MetaMask**。
3. 在 MetaMask 弹窗中允许 Remix 连接你的测试账户。需要逐步演示 B、C 时，也将它们授权给 Remix。
4. 在 MetaMask 中确认 Remix 网站使用 **Sepolia**。
5. 回到 Remix，确认 Account 显示 A 的地址，网络为 Sepolia，chain ID 为 **`11155111`**。
6. 把顶部 **Value 设置为 `0`**。

每次切换 A、B、C，都在 MetaMask 选择对应账户，并检查 Remix Account 是否已更新。如果没有更新，检查该账户是否授权给 Remix，必要时重新连接；不要在账户显示不一致时发交易。

顶部 Value 控制随交易附带的 ETH，本项目操作不需要附带 ETH。gas 仍由 MetaMask 账户的 Sepolia ETH 支付。[Remix 网络与 Value 说明](https://remix-ide.readthedocs.io/en/latest/run.html)。

## 7. 在 Sepolia 部署 CPT

1. 确认当前账户为 **A**，网络为 Sepolia。
2. Contract 下拉框选择 **CPT**。
3. 展开 Deploy 参数，`initialAdmin` 填 **A 的完整地址**。
4. 确认 Value 为 `0`，点击 **Deploy**。
5. MetaMask 弹出确认窗口，检查网络和账户，确认部署交易。
6. 等待交易确认；不要在 pending 时重复点击 Deploy。
7. Remix 的 **Deployed Contracts** 出现 CPT 实例后，复制地址，记为 **T**。
8. 从 Remix terminal 或 MetaMask 的交易详情记录部署交易哈希。

初始查询应得到：

| 查询 | 预期 |
|---|---|
| `name()` | `Club Point Token` |
| `symbol()` | `CPT` |
| `decimals()` | `18` |
| `WELCOME_POINTS()` | `5000000000000000000`，即 5 CPT |
| `totalSupply()` | `1000000000000000000000`，即 1,000 CPT |
| `balanceOf(T)` | 1,000 CPT 对应的原始整数 |
| `balanceOf(A)` | `0` |

初始积分在 **T 的储备中**，不是在 A 钱包中。管理员身份也不自动等于俱乐部会员。

## 8. 在 Sepolia 部署 CampusMemo

1. 确认仍使用账户 **A**。
2. Contract 下拉框选择 **CampusMemo**，不是 `ICPTMembership`。
3. 展开 Deploy 参数：

   | 参数 | 填写 |
   |---|---|
   | `cptAddress` | 刚部署的 CPT 地址 **T** |
   | `imageURI_` | 第 1 节保存的完整 **IMAGE_URL** |

4. 在单独的输入框填 URL 时通常不需要额外引号；若使用合并参数框，按界面要求填写地址和字符串。
5. 保持 Value 为 `0`，点击 Deploy，在 MetaMask 中确认。
6. 等待确认后复制 CampusMemo 地址，记为 **N**，记录交易哈希。

初始查询应得到：

| 查询 | 预期 |
|---|---|
| `cpt()` | **T** |
| `imageURI()` | 完整 **IMAGE_URL** |
| `MAX_SUPPLY()` | `10` |
| `MINT_COST()` | `100000000000000000000`，即 100 CPT |
| `totalMinted()` | `0` |
| `nextTokenId()` | `1` |

此时尚未发行 NFT，`ownerOf(1)` 和 `tokenURI(1)` 失败是正常的。合约部署成功也不代表图片 URL 一定可访问；图片检查已在第 1 节完成。

## 9. 用 Sepolia 只读脚本检查初始部署

新增的 `scripts/remix-sepolia-check.js` 检查你填入的 **已有合约地址**。它没有部署、授权、转账、发行或退出操作，也不使用 signer，因此运行时不需要支付 gas 或签名。

### 9.1 填写 CONFIG

在 Remix 打开该脚本，把顶部 CONFIG 改为你的真实值：

```js
const CONFIG = {
  cptAddress: "0x这里填T",
  nftAddress: "0x这里填N",
  adminAddress: "0x这里填A",
  imageURI: "这里填完整IMAGE_URL",
  stage: "initial",
  memberAddress: "",
  buyerAddress: ""
};
```

这些字段都是公开信息，不要在脚本中放私钥。

### 9.2 运行并记录

1. 确认 Remix Environment 仍为 MetaMask 连接的 Sepolia。
2. 右键 `scripts/remix-sepolia-check.js`，点击 Run。
3. 查看 terminal，成功应以 `SEPOLIA CHECK PASSED: ... No transactions sent.` 结束。

脚本核对：两个地址确实有合约、名称、符号、18 位小数、5 CPT 欢迎积分、A 的管理权限、NFT 绑定 T、图片地址、发行成本和供应上限。在 `initial` 模式还检查初始储备 1,000 CPT、A 余额 0、未发行 NFT。

因为此时没有 NFT，脚本会提示“尚不能检查 NFT JSON”；发行后再运行即可解码。脚本不会请求图片内容。

若你已经执行过后面的交易，使用 `stage: "inspect"` 查看当前状态，不要继续要求它满足 `initial` 的初始余额条件。

**两份脚本的用途：**

| 脚本 | 网络 | 是否发交易 | 作用 |
|---|---|---|---|
| `remix-test.js` | Remix VM | 是，使用默认解锁测试账户 | 完整状态变化、权限和失败场景测试 |
| `remix-sepolia-check.js` | Sepolia | 否 | 检查已部署合约及当前状态，解码已有 NFT |

将完整 VM 测试脚本放到 Sepolia 会被拒绝。只读检查不是完整的交易测试；正式网络的状态变化由接下来你在 MetaMask 确认的演示交易产生。

## 10. 在 Sepolia 演示会员、NFT 和交易

下面给出一条完整且可复核的流程。**从刚部署的新合约开始，每一步只执行一次。** 最后的余额表和 `after-demo` 脚本模式依赖这条确切顺序。

如果额外增发、分发、销毁，或重复执行某步，余额可能合理但不再满足本指南的最终表，届时使用 `inspect`。

### 10.1 金额输入规则

在函数参数 `amount` 或 `price` 中使用科学计数法：

| 金额 | 输入 |
|---|---|
| 1 CPT | `1e18` |
| 2 CPT | `2e18` |
| 5 CPT | `5e18` |
| 74 CPT | `74e18` |
| 80 CPT | `80e18` |
| 100 CPT | `100e18` |

Remix 官方支持这种参数格式。[科学计数法说明](https://remix-ide.readthedocs.io/en/latest/udapp.html#scientific-notation-in-function-inputs)。NFT 编号仍填 `1`；不要给编号加 `e18`。余额查询会显示完整整数，你可以用只读脚本查看格式化 CPT 余额。

### 10.2 让 B、C 成为会员

1. 切换 MetaMask 到 **B**，确认 Remix Account 更新。
2. 在 CPT 面板调用 `applyForMembership()`，在 MetaMask 确认，等待交易成功。
3. 切回 **A**，调用 `approveMembership(B)`，确认交易。
4. 查询 `isMember(B)` 为 `true`，`balanceOf(B)` 为 5 CPT。
5. 同样让 **C** 提交申请，再由 **A** 批准。

此时 B、C 各 5 CPT，储备 990 CPT，总供应量仍为 1,000 CPT。申请本身不发积分；管理员批准才发欢迎积分。

### 10.3 演示管理员回收 2 CPT

1. 当前账户为 **A**。
2. 在 CPT 调用 `adminRecoverPoints`：`account = B`，`amount = 2e18`。
3. 确认交易后查询：B 余额 3 CPT，储备 992 CPT，总供应量仍为 1,000 CPT。
4. `isMember(B)` 仍为 `true`。

欢迎积分只有 5 CPT，不能直接从新会员回收 20 CPT。`adminBurnPoints` 是另一种销毁操作，此处不执行，以保持后面的统一余额表。

### 10.4 管理员准备发行费用

1. 当前账户 **A**。
2. 在 CPT 调用 `distributePoints`：`recipient = A`，`amount = 100e18`。
3. 查询 A 余额为 100 CPT，储备为 892 CPT。
4. 在 CPT 调用 `approve`：`spender = N`，`value = 100e18`。
5. 查询 `allowance(A, N)`，应为 100 CPT 对应的原始整数。

这里批准的是 **N 合约**花费 **A 的 CPT**。`approve` 不会立即扣积分；发行时才消耗授权并销毁积分。

### 10.5 管理员向 B 发行第一枚 NFT

1. 当前账户 **A**。
2. 在 CampusMemo 调用 `mintMemo(B)`，确认交易。
3. 查询：`ownerOf(1) = B`、`totalMinted() = 1`、A 的 CPT 余额为 0。
4. CPT 总供应量变为 900 CPT；B 余额仍为 3 CPT。

发行消耗管理员的积分，不消耗接收会员积分。普通会员不能发行；管理员也不能向非会员发行。

### 10.6 解码 tokenURI 并验证图片

1. 在 CampusMemo 调用 `tokenURI(1)`，复制完整返回值，前缀应为 `data:application/json;base64,`。
2. 在 `remix-sepolia-check.js` 将 `stage` 改为 `"inspect"`，重新 Run。
3. terminal 应显示 NFT #1 的 owner、完整 URI 及可读 JSON。
4. JSON 应含 `name: "Campus-Memo #1"`、`image: IMAGE_URL` 和 `Edition: 1`。
5. 将 JSON 中的图片地址放到浏览器无痕窗口再次确认可访问。

也可在本地执行：

```bash
npm run metadata:decode -- '粘贴完整tokenURI结果'
```

完整 URI 要保存到报告；只有前缀不算完整 NFT URI。

### 10.7 演示 B 向 C 转让 1 CPT

1. 切换账户 **B**。
2. 在 CPT 调用 `transfer`：`to = C`，`value = 1e18`。
3. 确认后，B 余额为 2 CPT，C 余额为 6 CPT，储备和总供应量不变。

### 10.8 给 C 准备购买费用

1. 切回 **A**。
2. 在 CPT 调用 `distributePoints`：`recipient = C`，`amount = 74e18`。
3. 查询 C 余额为 80 CPT，储备为 818 CPT。

由于欢迎积分改为 5 CPT，C 当前只有 6 CPT，因此这里补 74 CPT，而不是旧示例里的 20 或 30 CPT。

### 10.9 挂单、取消，再重新挂单

1. 切换账户 **B**。
2. 在 CampusMemo 调用 `listMemo`：`tokenId = 1`，`price = 80e18`。
3. 查询 `ownerOf(1) = N`，说明 NFT 进入合约托管；`listings(1)` 的 seller 为 B、price 为 80 CPT。
4. B 调用 `cancelMemoListing(1)`，确认 `ownerOf(1) = B`，挂单清空。
5. B 再次调用 `listMemo(1, 80e18)`。

拥有者直接调用挂单函数即可，无需预先进行 NFT `approve`。购买所需的批准是买家的 CPT 授权，见下一节。

### 10.10 C 用 CPT 买下 NFT

1. 切换账户 **C**。
2. 在 CPT 调用 `approve`：`spender = N`，`value = 80e18`。
3. 在 CampusMemo 调用 `buyMemo(1)`。
4. 确认后：NFT 拥有者为 C，B 余额 82 CPT，C 余额 0，挂单清空，总供应量仍为 900 CPT。

购买价格转给卖家，不销毁，也不作为 ETH 附带给合约。Value 继续保持 0。

### 10.11 C 把 NFT 转回 B

1. 当前账户 **C**。
2. 在 CampusMemo 展开三参数 `safeTransferFrom(address,address,uint256)`：

   ```text
   from = C
   to = B
   tokenId = 1
   ```

3. 确认交易后，`ownerOf(1) = B`。
4. 该步骤是 NFT 普通转让，不转 CPT，所以 B 仍有 82 CPT。

### 10.12 B 退出，保留 NFT

1. 切换账户 **B**。
2. 在 CPT 调用 `withdrawFromClub()`，确认交易。
3. 检查：B 余额为 0、`isMember(B) = false`、NFT #1 仍由 B 拥有。
4. `tokenURI(1)` 不变；C 仍为会员。
5. 此次退出销毁 B 的 82 CPT，因此总供应量从 900 变为 818 CPT。

退出前交易所得的 CPT 也在 B 当前余额里，因此一并销毁。已经获得的 NFT 没有被回收或销毁；之后 B 仍然可以转让或出售它。

## 11. 用脚本核对最终演示结果

在 Sepolia 检查脚本中填上 B、C，改为：

```js
stage: "after-demo",
memberAddress: "0x这里填B",
buyerAddress: "0x这里填C"
```

保留 T、N、A、IMAGE_URL 的真实值，确认 Remix 连的是 Sepolia，再右键 Run。

严格按第 10 节执行后的预期结果为：

| 项目 | 结果 |
|---|---|
| A / B / C 的 CPT 余额 | 都为 0 |
| CPT 储备 `balanceOf(T)` | 818 CPT |
| CPT 总供应量 | 818 CPT |
| B 的会员状态 | `false` |
| C 的会员状态 | `true` |
| 已发行 NFT 数量 | 1 |
| NFT #1 的拥有者 | B |
| NFT #1 元数据 | 名称、图片、编号均正确 |

保存 `SEPOLIA CHECK PASSED` 的输出和对应区块号。脚本把查询固定在同一个区块形成快照；它检查链上最终状态，不证明某个历史交易一定曾发生，所以过程证据仍要保留交易哈希、事件和截图。

如果你额外进行过交易，用 `stage: "inspect"`。该模式仍验证合约参数和已有 NFT JSON，但不会要求当前余额为 818 或 NFT 必须归 B。

## 12. 保存提交材料与恢复 Remix 会话

建议保存：

- T、N 的 Sepolia 合约地址，两个部署交易哈希。
- A、B、C 的地址；网络名称与 chain ID `11155111`。
- 图片 commit SHA 和完整 IMAGE_URL。
- 完整 `tokenURI(1)`、解码 JSON。
- Remix VM 完整测试成功输出。
- Sepolia 初始检查与最终检查成功输出。
- 会员申请 / 批准、发行、交易、退出交易的哈希、事件与截图。
- 源码以及以本人姓名和 UID 命名的报告；最终提交报告仍不超过两页。

在 [Sepolia Etherscan](https://sepolia.etherscan.io/) 搜索地址或交易哈希即可查看公开状态与交易。合约部署并不自动完成源代码验证；若进行源码验证，要保持编译器、optimizer、EVM、依赖及构造参数一致。

关闭或刷新 Remix 后，已部署 Sepolia 合约仍在链上。要重新操作：重新编译源码、连接 Sepolia，在 Contract 下拉框选 CPT，把 T 填入 **At Address** 加载；对 CampusMemo 用 N 同样操作。不要为了恢复界面重新 Deploy。

## 13. 常见问题

| 现象 | 排查 |
|---|---|
| 顶部余额是 ETH，为什么 A 没有 CPT？ | ETH 余额不是积分余额。CPT 初始在 T 的储备中，管理员需 `distributePoints` 或 `mintPoints` 后才能支付发行费。 |
| Remix Account 与 MetaMask 选中账户不一致 | 检查账户是否授权给 Remix，确认网站网络，再重新连接。 |
| `Source ... not found` | 使用最新 `output/remix` 文件，确认 OpenZeppelin import 固定为 `@5.0.2`，并检查联网下载。 |
| `Invalid image URI` | 完整 URL 非空且无空格、引号、反斜杠。先单独打开 Raw 地址。 |
| 新会员收到 50 CPT | 部署了旧版。查询 `WELCOME_POINTS()`；当前源码应为 `5 ether`。旧合约不会因本地改源码自动改变。 |
| `Not a club administrator` | 当前钱包不是 A，或其 CPT 管理角色已被撤销。 |
| `Recipient is not a club member` | 收件人尚未申请并获批，或已退出。 |
| `ERC20InsufficientAllowance` | 发行由 A 批准 N 花费 100 CPT；购买由 C 批准 N 花费 80 CPT。 |
| `ERC20InsufficientBalance` | 授权不等于拥有积分，检查实际 CPT 余额。 |
| 回收 20 CPT 失败 | 新会员只有 5 CPT；本指南示例回收 2 CPT。 |
| `tokenURI(1)` 失败 | NFT 尚未发行，或者加载了错误合约地址/网络。 |
| 只读脚本 `initial` 失败 | 若已经进行了交易，应改为 `inspect`；或检查是否部署旧版、填错地址。 |
| `after-demo` 余额不为 818 | 检查是否完全按步骤一次执行，或是否有额外增发、分发、销毁、退出。 |
| 完整测试脚本拒绝 Sepolia | 这是预期行为。VM 使用 `remix-test.js`，Sepolia 使用只读 `remix-sepolia-check.js`。 |
| MetaMask 未显示 NFT 图片 | 先以链上 owner、完整 URI、解码 JSON 和可访问的图片 URL 核实；钱包展示可能涉及缓存或格式支持，不能仅据此判断合约失败。 |
