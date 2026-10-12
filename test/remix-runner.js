const { expect } = require("chai");
const { ethers, artifacts, network } = require("hardhat");
const { runAssignmentTests } = require("../scripts/remix-test.js");

describe("Remix JavaScript test runner", function () {
  it("rejects Sepolia before loading accounts, artifacts or sending transactions", async function () {
    let error;
    try {
      await runAssignmentTests({
        ethers,
        provider: {
          getNetwork: async () => ({ chainId: 11155111n }),
          listAccounts: async () => { throw new Error("must not request accounts"); }
        },
        readArtifact: async () => { throw new Error("must not load artifacts"); },
        log: () => {}
      });
    } catch (caught) { error = caught; }
    expect(error.message).to.include("only runs on a local VM");
  });

  it("runs the actual Remix script against the local EVM", async function () {
    this.timeout(60000);
    const result = await runAssignmentTests({
      ethers,
      provider: new ethers.BrowserProvider(network.provider),
      readArtifact: name => artifacts.readArtifact(name),
      log: () => {}
    });
    expect(result.checks).to.equal(22);
    expect(result.assertions).to.be.greaterThan(200);
    expect(result.deployments).to.have.lengthOf(4);
  });
});
