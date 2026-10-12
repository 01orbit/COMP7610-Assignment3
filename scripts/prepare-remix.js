const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const output = path.join(root, "output", "remix");
const files = ["contracts/CPT.sol", "contracts/CampusMemo.sol", "scripts/remix-test.js"];
for (const file of files) {
  let content = fs.readFileSync(path.join(root, file), "utf8");
  if (file.endsWith(".sol")) {
    content = content.replaceAll('"@openzeppelin/contracts/', '"@openzeppelin/contracts@5.0.2/');
  }
  const target = path.join(output, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
console.log(`Prepared ${output}: version-pinned contracts and the Remix test script.`);
console.log("Copy/open these files in Remix, compile both contracts, select Remix VM, then run scripts/remix-test.js.");
