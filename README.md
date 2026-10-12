# COMP7610 Assignment 3：HKU Drone Club CPT 与 Campus-Memo

本项目包含一份会员积分 ERC-20（CPT）和一份会员纪念 NFT（Campus-Memo）。CPT 负责会员申请、欢迎积分、积分发行、管理员扣除或回收以及退出销毁；Campus-Memo 只允许管理员向当前会员发行，会员可以用 CPT 买卖已经发行的 NFT。

## 当前目录

- `contracts/CPT.sol`：CPT、会员流程、欢迎积分、管理员 `adminBurnPoints` 与 `adminRecoverPoints`。
- `contracts/CampusMemo.sol`：管理员发行 NFT、拥有者转让、CPT 挂单交易，以及链上动态 NFT JSON。
- `scripts/deploy.js`：Sepolia 部署脚本，只需要一个固定版本 GitHub 图片 URL。
- `scripts/remix-test.js`：可直接在 Remix VM 运行的自动测试脚本，覆盖 22 组场景。
- `scripts/remix-sepolia-check.js`：填写已部署地址后，在 MetaMask 连接的 Sepolia 上运行，只读检查初始或演示后的状态并解码已有 NFT，不发交易。
- `scripts/prepare-remix.js`：把合约和测试复制到 `output/remix/`，并补上 Remix 可识别的 OpenZeppelin 版本路径。
- `scripts/decode-token-uri.js`：把 `tokenURI()` 返回的 data URI 解码为可读 JSON。
- `test/assignment3.js`：Hardhat 单元测试。
- `REMIX_DEPLOYMENT_GUIDE.md`：从准备图片、编译、部署到逐步验证的完整操作手册。
- `FullName_UID_Assignment3_Report.tex`：保留的 LaTeX 作业报告源文件。

## 元数据方案

项目只在 GitHub 仓库保存一张公开图片，例如：

```text
https://raw.githubusercontent.com/USER/REPO/<40位commitSHA>/images/campus-memo.png
```

`CampusMemo.tokenURI(id)` 在链上动态构造 JSON，并返回：

```text
data:application/json;base64,<base64编码的JSON>
```

JSON 中的 `name`、`description`、`image` 和 `Edition` 属性由合约生成，因此不需要创建 Gist，也不需要维护十个外部 JSON 文件。图片 URL 在部署时写入合约后不可修改；NFT 转让或会员退出不会改变其元数据。

## 本地编译和测试

```bash
npm install
npm test
npm run remix:prepare
```

Hardhat 测试使用本地 EVM，不访问 GitHub。Remix 测试也使用 Remix VM，脚本会在开始时拒绝 Sepolia 和钱包连接网络，避免误操作真实资产。运行测试后，脚本应报告 22 个测试组、超过 200 项断言和 4 次隔离部署。

网页版 Remix + MetaMask 的完整流程见 [部署与验证手册](REMIX_DEPLOYMENT_GUIDE.md)，从上传 GitHub 图片开始。Sepolia 检查使用单独的 `remix-sepolia-check.js`，在运行前填写顶部 CONFIG；该脚本与完整 VM 功能测试的用途不同。

可以用下面的命令解码任意一条 `tokenURI()` 结果：

```bash
npm run metadata:decode -- 'data:application/json;base64,...'
```

## Sepolia 部署

先准备一个 GitHub 仓库图片的完整 commit SHA，然后设置：

```bash
export SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/你的KEY"
export DEPLOYER_PRIVATE_KEY="0x你的测试钱包私钥"
export NFT_IMAGE_URL="https://raw.githubusercontent.com/USER/REPO/<40位commitSHA>/images/campus-memo.png"
npm run deploy:sepolia
```

部署脚本会先严格检查 URL，再发送交易，并打印 CPT 地址、CampusMemo 地址和交易哈希。完整的 Remix 操作、构造参数、批准 CPT、发行 NFT、交易 NFT、退出会员和截图清单见 [REMIX_DEPLOYMENT_GUIDE.md](REMIX_DEPLOYMENT_GUIDE.md)。

私钥、RPC key 和未加密的钱包文件不要提交到 Git；`.gitignore` 已覆盖 `.env`、`node_modules` 和 Hardhat 生成目录。
