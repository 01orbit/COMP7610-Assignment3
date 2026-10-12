# COMP7610 智能合约实验：作业 3 中文说明

**项目：** HKU Drone Club 会员积分 CPT 与纪念 NFT Campus-Memo  
**姓名：** 【填写姓名】  
**UID：** 【填写 UID】  
**部署网络：** Sepolia，Chain ID 为 `11155111`

本文是当前 LaTeX 报告的中文 Markdown 版本，补充了 Remix 金额输入说明，供阅读和验证实现使用。现有 TeX 文件保持不变。尚未填写的地址、交易哈希和截图，应在实际部署后补齐；本文中的示例参数不是部署结果。正式提交报告仍须遵守作业要求的两页限制。

## 1. 系统设计

### 1.1 CPT：俱乐部积分与会员资格

`CPT.sol` 使用 OpenZeppelin 的 ERC-20、ERC20Burnable 和 AccessControl，代币有 18 位小数。部署时一次性发行 1,000 CPT，全部存入 **CPT 合约自身的地址**，作为俱乐部储备，并非存入管理员钱包。

只有拥有 `ADMIN_ROLE` 的账户可以执行以下管理操作：

| 函数 | 用途 | 对 CPT 总供应量的影响 |
|---|---|---|
| `mintPoints(recipient, amount)` | 增发积分给指定账户 | 增加 |
| `distributePoints(recipient, amount)` | 从俱乐部储备分发已有积分 | 不变 |
| `adminBurnPoints(account, amount)` | 从指定用户余额中直接销毁积分 | 减少 |
| `adminRecoverPoints(account, amount)` | 把指定用户积分回收到俱乐部储备 | 不变 |

管理员扣除或回收积分不需要用户提前 `approve`，但不能超过用户余额。回收不会改变会员资格或 NFT 所有权；回收的积分以后可以重新分发。

用户加入俱乐部的流程如下：

1. 用户调用 `applyForMembership()` 提交申请。
2. 管理员调用 `approveMembership(userAddress)` 批准申请。
3. 合约设置会员资格，并从储备中向该用户转入 5 CPT 欢迎积分。

会员调用 `withdrawFromClub()` 时，合约销毁调用者当前持有的全部 CPT，并取消其会员资格。**已经获得的 NFT 继续归原拥有者所有，不会因退出而销毁或回收。** 该函数对应作业中额外自定义功能的要求。

用户仍可以使用标准 ERC-20 的 `transfer`、`approve` 和 `transferFrom`。会员退出会销毁退出时的积分，但不禁止其以后收到转账或 NFT 出售所得的 CPT。

### 1.2 Campus-Memo：管理员发行与用户交易

`CampusMemo.sol` 是一个 ERC-721 合约，名称为 `Campus-Memo`，最多发行 10 枚 NFT，编号从 1 开始。

发行流程为：

1. 管理员准备至少 100 CPT。
2. 管理员在 CPT 合约中批准 CampusMemo 花费自己的 100 CPT。
3. 管理员调用 `mintMemo(memberAddress)`，将新 NFT 直接发行给当前会员。
4. 合约从管理员余额中销毁 100 CPT；接收会员的积分余额不受影响。

发行权限以 CPT 合约中**当前的** `ADMIN_ROLE` 为准。普通会员不能发行 NFT，管理员也不能向非会员发行。该合约没有 NFT 销毁或管理员回收函数。

已经发行的 NFT 可以通过标准 `safeTransferFrom` 转让，也可以用 CPT 买卖：

1. 拥有者调用 `listMemo(tokenId, price)`，NFT 转入 CampusMemo 合约托管。
2. 买家在 CPT 中批准 CampusMemo 花费挂单价格。
3. 买家调用 `buyMemo(tokenId)`，CPT 支付给卖家，NFT 转给买家，挂单清除。
4. 购买前，卖家可以调用 `cancelMemoListing(tokenId)` 撤销挂单，取回 NFT。

挂单、购买和普通转让都不要求当前会员资格，因此退出俱乐部后仍可以持有和交易已经获得的 NFT。

### 1.3 NFT 元数据：链上 JSON 与 GitHub 图片

部署 CampusMemo 时，构造函数接收 CPT 地址和一张图片的完整 URL。图片保存在公开 GitHub 仓库，URL 使用完整 40 位 commit SHA 固定版本：

```text
https://raw.githubusercontent.com/USER/REPO/<40位commitSHA>/images/campus-memo.png
```

`tokenURI(id)` 在链上生成 JSON，然后返回 Base64 编码的 data URI：

```text
data:application/json;base64,<编码后的JSON>
```

JSON 包含 NFT 名称、说明、图片 URL 和 Edition 编号。无需 Gist，也无需创建十个外部 JSON 文件。图片 URL 没有修改入口，转让或退出不会改变已发行 NFT 的元数据。查询尚未发行的 token ID 会失败。

## 2. 本地与 Remix VM 自动验证

在项目根目录执行：

```bash
npm install
npm run compile
npm test
npm run remix:prepare
```

将生成的 `output/remix/` 中两个合约和 `scripts/remix-test.js` 复制到 Remix。编译两个合约，选择 Remix VM，然后右键测试脚本并选择 Run。

脚本部署全新的测试合约，覆盖 22 组场景、333 项断言，包括余额、事件、权限、预期失败、NFT 发行和买卖、退出后保留 NFT、元数据解码及第 11 枚 NFT 发行失败。脚本只允许本地 VM，不能在 Sepolia 上运行。

本地测试同时验证初始储备、欢迎积分、管理员扣除和回收、标准转让，以及失败操作不会错误地改变余额、授权或 NFT 所有权。欢迎积分改为 5 CPT 后，按要求未重新运行测试。

## 3. Sepolia 部署：Hardhat 方式

1. 在 MetaMask 中选择 Sepolia，准备测试 ETH。
2. 将固定版本图片 URL 放入浏览器无痕窗口，确认无需登录即可访问。
3. 在本地终端设置环境变量：

   ```bash
   export SEPOLIA_RPC_URL="<你的Sepolia RPC URL>"
   export DEPLOYER_PRIVATE_KEY="<测试钱包私钥>"
   export NFT_IMAGE_URL="<完整固定版本GitHub Raw图片URL>"
   ```

4. 执行 `npm run compile`、`npm test`，再执行 `npm run deploy:sepolia`。
5. 记录 CPT、CampusMemo 地址及各自部署交易哈希，并在 [Sepolia Etherscan](https://sepolia.etherscan.io/) 检查部署交易。

脚本先部署 CPT，再将其地址传入 CampusMemo 构造函数。环境变量只供本地使用，不应提交钱包私钥。通过 Remix 连接 MetaMask 部署时，不需要把私钥填入项目。

## 4. Remix + MetaMask 逐步部署与功能测试

下列金额使用 Remix 支持的科学计数法。例如 `100e18` 表示 100 CPT 对应的原始整数金额，而非支付 100 ETH。各次调用的顶部 `Value` 保持为 `0`。

1. **编译与连接。** 在 Remix 打开两个合约，使用 OpenZeppelin `5.0.2`、Solidity `0.8.24`，开启 optimizer，runs 为 `200`，EVM 为 `paris`。连接测试钱包，确认网络是 Sepolia。
2. **部署。** CPT 构造参数填管理员地址。CampusMemo 的两个构造参数分别填 CPT 合约地址和完整 GitHub Raw 图片 URL。
3. **申请与欢迎积分。** 学生账户调用 `applyForMembership()`；管理员调用 `approveMembership(student)`。检查 `isMember(student)` 为 `true`，`balanceOf(student)` 为 `5e18` 对应的完整整数。
4. **回收积分。** 管理员调用 `adminRecoverPoints(student, 2e18)`。检查学生余额减少 2 CPT，储备增加 2 CPT，总供应量、会员资格和 NFT 不变。普通账户调用该管理函数应失败。
5. **发行 NFT。** 管理员调用 `distributePoints(admin, 100e18)`，再在 CPT 中调用 `approve(CampusMemo地址, 100e18)`，最后在 CampusMemo 中调用 `mintMemo(student)`。检查管理员支付并销毁 100 CPT，学生收到 token 1。普通会员调用 `mintMemo` 应失败。
6. **查看元数据。** 查询 `ownerOf(1)`、`imageURI()` 和 `tokenURI(1)`。复制完整 data URI，用以下命令解码，确认 `name` 是 `Campus-Memo #1`、Edition 为 `1`、图片 URL 正确：

   ```bash
   npm run metadata:decode -- '完整的tokenURI(1)结果'
   ```

7. **普通转让。** 学生调用 CPT `transfer(otherAddress, 1e18)`，检查双方余额；学生调用 NFT `safeTransferFrom(student, otherAddress, 1)`，检查新拥有者。
8. **CPT 买卖。** 新拥有者调用 `listMemo(1, 80e18)`。买家必须持有至少 80 CPT，并在 CPT 中调用 `approve(CampusMemo地址, 80e18)`，然后调用 NFT `buyMemo(1)`。检查卖家收到 CPT、买家收到 NFT、挂单清除。另一次挂单可以由卖家调用 `cancelMemoListing(1)` 验证取消功能。
9. **退出后保留 NFT。** 先通过拥有者的转让将 token 1 返回给学生会员。学生调用 `withdrawFromClub()`，检查 CPT 余额为 `0`、`isMember=false`、存在 `MemberWithdrawn` 事件，同时 `ownerOf(1)` 仍为该学生，`tokenURI(1)` 与退出前相同。

发行 10 枚的上限检查可在 Remix VM 自动测试中完成，避免在正式演示合约中提前耗尽全部发行名额。更完整的界面操作见 [Remix 部署与验证手册](REMIX_DEPLOYMENT_GUIDE.md)。

## 5. 提交前填写实际结果

| 项目 | 实际结果 |
|---|---|
| 姓名和 UID | 【填写】 |
| CPT 地址 | 【填写 Sepolia 地址】 |
| CampusMemo 地址 | 【填写 Sepolia 地址】 |
| 图片 URL | 【填写完整固定版本 GitHub Raw URL】 |
| NFT URI | 【填写完整 `tokenURI(1)` data URI】 |
| 解码后的 JSON | 【填写实际解码内容】 |
| 部署交易 | 【填写两个部署交易哈希或 Etherscan 链接】 |

NFT URI 必须是实际返回的完整值；`data:application/json;base64,...` 仅用于说明格式，不能作为最终结果。正式报告需要保持在两页以内，并以本人姓名和 UID 命名。

## 6. 截图建议

- Sepolia 网络和两个已部署合约。
- 会员批准及 5 CPT 欢迎积分。
- 管理员 CPT 授权、NFT 发行交易、`ownerOf(1)` 和 `tokenURI(1)`。
- 回收积分或 CPT 买卖的前后余额。
- 退出交易、零 CPT 余额、`isMember=false` 和仍属于原用户的 NFT。
- Remix VM 自动测试的成功结尾。

## 7. Remix 金额如何少输入零

### 7.1 推荐用科学计数法：无需改合约

Remix 的函数参数框支持科学计数法，例如官方示例 `12e18` 可代替 `12000000000000000000`。CPT 有 18 位小数，因此使用以下简写即可：[Remix 官方说明](https://remix-ide.readthedocs.io/en/latest/udapp.html#scientific-notation-in-function-inputs)。

| 实际 CPT 金额 | 参数框填写 | 原始整数金额 |
|---|---|---|
| 10 CPT | `10e18` | `10000000000000000000` |
| 20 CPT | `20e18` | `20000000000000000000` |
| 50 CPT | `50e18` | `50000000000000000000` |
| 80 CPT | `80e18` | `80000000000000000000` |
| 100 CPT | `100e18` | `100000000000000000000` |
| 1,000 CPT | `1000e18` | `1000000000000000000000` |

展开函数参数输入框，在 `amount` 或 `price` 中输入这些值即可。这适用于 CPT 的转让、批准、分发、增发、销毁和回收，以及 NFT 的 CPT 挂单价格。地址照常输入，NFT 编号仍写 `1` 或 `10`，不要给编号加 `e18`。

科学计数法是 Remix 输入界面的便利功能；底层 ERC-20 接口仍接收最小单位整数。`balanceOf` 和 `totalSupply` 等查询也仍返回原始整数，并不会自动变成整枚显示。若你的 Desktop 版本不接受简写，可在已有自动测试脚本中使用 `ethers.parseEther("100")`（ethers v6）或 `ethers.utils.parseEther("100")`（ethers v5）进行精确换算，再把结果传给合约。

### 7.2 顶部 Value 的 ether 单位代表 ETH

Remix 的顶部 `Value` 确实可以选择 `ether`，但它控制的是**随本次交易附带的原生 ETH**，与 `transfer` 的 CPT 数量或挂单价格是不同字段。[Remix 官方说明](https://remix-ide.readthedocs.io/en/latest/run.html)。

本项目的部署和操作都不需要附带 ETH，顶部 `Value` 应保持为 `0`。gas 由钱包另行支付。即使把 `Value` 单位切换为 ether，也不会将函数参数 `100` 自动变成 100 CPT。

Solidity 源码中的 `100 ether` 是整数 `100 × 10^18` 的单位字面量。在当前 CPT 计算中，它表示 100 CPT 对应的整数值；源码使用该写法本身不会转账 ETH。

### 7.3 如果以后希望直接只输入 100

另一种做法是新增便利函数，例如 `transferWholeCPT(to, wholeAmount)`，内部把 `wholeAmount` 乘以 `10^18` 后再执行转账，同时保留标准 ERC-20 接口。这样输入 `100` 就能表示 100 CPT，但这些函数需要额外编写和验证，而且必须明确定义小数如何输入。

当前项目已有自动测试脚本，手动调用也可以使用 `100e18`，因此本次采用科学计数法说明，不新增接口或改变合约的金额含义。
