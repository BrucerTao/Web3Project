const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TradingAgent", function () {
  let tradingAgent;
  let owner;
  let agent1;
  let agent2;

  const strategyHash = ethers.keccak256(ethers.toUtf8Bytes("my-strategy-v1"));
  const fileId = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
  const tradeId = ethers.keccak256(ethers.toUtf8Bytes("trade-001"));

  beforeEach(async function () {
    [owner, agent1, agent2] = await ethers.getSigners();
    const TradingAgent = await ethers.getContractFactory("TradingAgent");
    tradingAgent = await TradingAgent.deploy();
    await tradingAgent.waitForDeployment();
  });

  describe("部署", function () {
    it("应该正确设置管理员", async function () {
      expect(await tradingAgent.admin()).to.equal(owner.address);
    });
  });

  describe("注册机器人", function () {
    it("应该成功注册机器人", async function () {
      await tradingAgent.connect(agent1).registerAgent("TestBot-1");
      const agentInfo = await tradingAgent.getAgentInfo(agent1.address);
      expect(agentInfo.name).to.equal("TestBot-1");
      expect(agentInfo.active).to.be.true;
    });

    it("不允许重复注册", async function () {
      await tradingAgent.connect(agent1).registerAgent("TestBot-1");
      await expect(
        tradingAgent.connect(agent1).registerAgent("TestBot-2")
      ).to.be.revertedWith("Agent already registered");
    });
  });

  describe("存储策略", function () {
    beforeEach(async function () {
      await tradingAgent.connect(agent1).registerAgent("TestBot-1");
    });

    it("应该成功存储策略", async function () {
      await tradingAgent.connect(agent1).storeStrategy(strategyHash, fileId);
      const strategy = await tradingAgent.getLatestStrategy(agent1.address);
      expect(strategy.fileId).to.equal(fileId);
      expect(strategy.version).to.equal(0n);
    });

    it("只有活跃的机器人可以存储策略", async function () {
      await tradingAgent.deactivateAgent(agent1.address);
      await expect(
        tradingAgent.connect(agent1).storeStrategy(strategyHash, fileId)
      ).to.be.revertedWith("Agent not active");
    });
  });

  describe("记录推理", function () {
    beforeEach(async function () {
      await tradingAgent.connect(agent1).registerAgent("TestBot-1");
    });

    it("应该成功记录推理", async function () {
      const inputHash = ethers.keccak256(ethers.toUtf8Bytes("input-data"));
      const outputHash = ethers.keccak256(ethers.toUtf8Bytes("output-result"));
      await tradingAgent.connect(agent1).recordInference(inputHash, outputHash, true);
      expect(await tradingAgent.inferenceHistory(agent1.address, 0)).to.not.be.null;
    });
  });

  describe("记录交易", function () {
    beforeEach(async function () {
      await tradingAgent.connect(agent1).registerAgent("TestBot-1");
    });

    it("应该成功记录交易", async function () {
      await tradingAgent.connect(agent1).recordTrade(tradeId);
      expect(await tradingAgent.isTradeExecuted(tradeId)).to.be.true;
    });

    it("不允许重复执行同一交易", async function () {
      await tradingAgent.connect(agent1).recordTrade(tradeId);
      await expect(tradingAgent.connect(agent1).recordTrade(tradeId)).to.be.reverted;
    });

    it("应该增加交易计数", async function () {
      await tradingAgent.connect(agent1).recordTrade(tradeId);
      const agentInfo = await tradingAgent.getAgentInfo(agent1.address);
      expect(agentInfo.totalTrades).to.equal(1n);
    });
  });

  describe("更新 PnL", function () {
    beforeEach(async function () {
      await tradingAgent.connect(agent1).registerAgent("TestBot-1");
    });

    it("应该正确更新盈利", async function () {
      await tradingAgent.connect(agent1).updatePnL(1000);
      const agentInfo = await tradingAgent.getAgentInfo(agent1.address);
      expect(agentInfo.totalPnL).to.equal(1000n);
    });

    it("应该正确更新亏损", async function () {
      await tradingAgent.connect(agent1).updatePnL(-500);
      const agentInfo = await tradingAgent.getAgentInfo(agent1.address);
      expect(agentInfo.totalPnL).to.equal(-500n);
    });
  });

  describe("管理员功能", function () {
    beforeEach(async function () {
      await tradingAgent.connect(agent1).registerAgent("TestBot-1");
    });

    it("管理员可以停用机器人", async function () {
      await tradingAgent.deactivateAgent(agent1.address);
      const agentInfo = await tradingAgent.getAgentInfo(agent1.address);
      expect(agentInfo.active).to.be.false;
    });

    it("非管理员不能停用机器人", async function () {
      await expect(
        tradingAgent.connect(agent1).deactivateAgent(agent1.address)
      ).to.be.revertedWith("Not admin");
    });
  });
});
