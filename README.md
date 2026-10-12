# COMP7610 Assignment 3 · HKU Drone Club

基于 Solidity 0.8.24、OpenZeppelin 5.0.2 和 Hardhat 的会员积分与纪念 NFT 项目。支持会员申请、5 CPT 欢迎积分、退出销毁积分、管理员分发/增发/扣除/回收积分，以及 NFT 转让和 CPT 定价交易。NFT 仅由管理员向会员发行，退出后仍归持有人所有。

## 目录与文件

| 路径 | 作用 |
|---|---|
| `contracts/CPT.sol` | ERC-20 积分、会员资格、欢迎积分与管理员积分管理。 |
| `contracts/CampusMemo.sol` | ERC-721 NFT、管理员发行、挂单/取消/购买及链上 Base64 JSON 元数据。 |
| `scripts/deploy.js` | 部署一套新的 CPT 和 CampusMemo 到 Sepolia；默认使用本项目的固定 commit 图片链接。 |
| `scripts/prepare-remix.js` | 生成 Remix 上传文件，并固定 OpenZeppelin 导入版本。 |
| `scripts/remix-test.js` | 在 Remix VM 中自动部署并测试功能；拒绝在 Sepolia 运行。 |
| `scripts/remix-sepolia-check.js` | 只读检查已部署的 Sepolia 合约；实际地址已填好，默认 `inspect` 模式，不发送交易。 |
| `scripts/decode-token-uri.js` | 将 NFT 的 Base64 data URI 解码为 JSON。 |
| `test/assignment3.js` | Hardhat 合约测试。 |
| `test/remix-runner.js` | 在本地 EVM 执行 Remix 测试脚本，并检查其网络限制。 |
| [docs/Assignment3_Report.tex](docs/Assignment3_Report.tex) | 匿名化英文报告源文件，使用 XeLaTeX 编译。 |
| [docs/Assignment3_Report.pdf](docs/Assignment3_Report.pdf) | 两页报告，包含功能、部署信息和核验步骤。 |
| `hardhat.config.js` | 编译器、优化器及 Sepolia 网络配置。 |
| `package.json` / `package-lock.json` | npm 命令、依赖及锁定版本。 |
| `.gitignore` | 排除依赖、构建产物、环境文件和 LaTeX 临时文件。 |

运行命令后生成的目录：`node_modules/` 保存依赖，`artifacts/` 和 `cache/` 保存 Hardhat 编译产物，`output/remix/` 保存 Remix 上传文件；这些目录不提交到 Git。

## 本地命令

在项目根目录运行，需要 Node.js 和 npm。

| 命令 | 说明 |
|---|---|
| `npm ci` | 按锁定版本安装依赖。 |
| `npm run compile` | 编译 Solidity 合约。 |
| `npm test` | 在本地 Hardhat 网络运行全部测试。 |
| `npm run remix:prepare` | 生成 `output/remix/` 中的合约和两份 Remix 脚本。 |
| `npm run metadata:decode -- '完整 tokenURI'` | 解码 `tokenURI()` 返回的 `data:application/json;base64,...`。 |
| `npm run deploy:sepolia` | 使用环境变量配置部署新合约，发送交易并消耗测试 ETH。 |

Hardhat 部署前设置 `SEPOLIA_RPC_URL` 和 `DEPLOYER_PRIVATE_KEY`。可选的 `NFT_IMAGE_URL` 用于覆盖默认图片，必须是固定 40 位 commit SHA 的 GitHub Raw HTTPS 链接。配置通过进程环境变量读取，项目不会自动加载 `.env`。

## Remix 操作

1. 执行 `npm run remix:prepare`，将 `output/remix/` 下的 `contracts/` 和 `scripts/` 上传到 Remix，保持目录结构。
2. 使用 Solidity **0.8.24**、优化器 **200 runs**、EVM **paris** 编译两份合约。
3. 完整功能测试：选择 **Remix VM**，右键 `scripts/remix-test.js` → **Run**。
4. 检查现有部署：选择 **Browser Extension**，通过 MetaMask 连接 **Sepolia**，右键 `scripts/remix-sepolia-check.js` → **Run**。默认读取当前状态；`initial` 仅适用于刚部署时，`after-demo` 核对报告中完整演示后的预期状态。

现有合约可用 **At Address / Add Contract** 加载，无需重新部署：

| 合约 | Sepolia 地址 |
|---|---|
| CPT | `0x2cfc2b3Ed989ef5bA52E586dbcB5A0D8556d96C9` |
| CampusMemo | `0x85C5E2da4e940420f3a429D482C22763345e16b9` |

## 编译报告

安装含 XeLaTeX、latexmk 和所用字体的 TeX 环境后运行：

```bash
latexmk -xelatex -outdir=docs/.build docs/Assignment3_Report.tex
cp docs/.build/Assignment3_Report.pdf docs/Assignment3_Report.pdf
```

构建临时文件保存在被 Git 忽略的 `docs/.build/`，`docs/` 中保留报告源文件与最终 PDF。
