// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TradingAgent
 * @notice 0G Agentic Trading Arena 智能合约
 * @dev 部署在 0G Chain 上，用于验证和管理交易机器人
 *
 * 功能：
 * - 存储交易策略的哈希（通过 0G Storage）
 * - 验证 TEE 推理结果
 * - 管理机器人注册和权限
 */
contract TradingAgent {
    // 事件
    event AgentRegistered(address indexed agent, string name, uint256 timestamp);
    event StrategyStored(address indexed agent, bytes32 strategyHash, string fileId);
    event InferenceVerified(address indexed agent, bytes32 inputHash, bytes32 outputHash);
    event TradeExecuted(address indexed agent, bytes32 tradeId, uint256 timestamp);

    // 结构体
    struct Agent {
        string name;
        address owner;
        bool active;
        uint256 createdAt;
        uint256 totalTrades;
        int256 totalPnL;
    }

    struct Strategy {
        bytes32 hash;
        string fileId;  // 0G Storage 文件 ID
        uint256 version;
        uint256 updatedAt;
    }

    struct InferenceRecord {
        bytes32 inputHash;
        bytes32 outputHash;
        uint256 timestamp;
        bool verified;
    }

    // 状态变量
    mapping(address => Agent) public agents;
    mapping(address => Strategy[]) public agentStrategies;
    mapping(address => InferenceRecord[]) public inferenceHistory;
    mapping(bytes32 => bool) public executedTrades;

    uint256 public constant MAX_LEVERAGE = 10;  // 最大 10 倍杠杆
    uint256 public constant MAX_POSITION = 10000 * 1e18;  // 最大仓位 10000 USDT

    // 管理员
    address public admin;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyActiveAgent() {
        require(agents[msg.sender].active, "Agent not active");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /**
     * 注册交易机器人
     */
    function registerAgent(string memory name) external {
        require(!agents[msg.sender].active, "Agent already registered");

        agents[msg.sender] = Agent({
            name: name,
            owner: msg.sender,
            active: true,
            createdAt: block.timestamp,
            totalTrades: 0,
            totalPnL: 0
        });

        emit AgentRegistered(msg.sender, name, block.timestamp);
    }

    /**
     * 存储策略哈希到链上
     * @param strategyHash 策略代码的哈希
     * @param fileId 0G Storage 中的文件 ID
     */
    function storeStrategy(bytes32 strategyHash, string calldata fileId) external onlyActiveAgent {
        agentStrategies[msg.sender].push(Strategy({
            hash: strategyHash,
            fileId: fileId,
            version: agentStrategies[msg.sender].length,
            updatedAt: block.timestamp
        }));

        emit StrategyStored(msg.sender, strategyHash, fileId);
    }

    /**
     * 记录已验证的推理结果
     * @param inputHash 输入数据哈希
     * @param outputHash 输出结果哈希
     * @param verified 是否已验证
     */
    function recordInference(
        bytes32 inputHash,
        bytes32 outputHash,
        bool verified
    ) external onlyActiveAgent {
        inferenceHistory[msg.sender].push(InferenceRecord({
            inputHash: inputHash,
            outputHash: outputHash,
            timestamp: block.timestamp,
            verified: verified
        }));

        emit InferenceVerified(msg.sender, inputHash, outputHash);
    }

    /**
     * 记录交易执行
     * @param tradeId 交易 ID
     */
    function recordTrade(bytes32 tradeId) external onlyActiveAgent {
        require(!executedTrades[tradeId], "Trade already executed");

        executedTrades[tradeId] = true;
        agents[msg.sender].totalTrades++;

        emit TradeExecuted(msg.sender, tradeId, block.timestamp);
    }

    /**
     * 更新机器人 PnL
     * @param pnl 盈亏（带符号，正为盈利）
     */
    function updatePnL(int256 pnl) external onlyActiveAgent {
        agents[msg.sender].totalPnL = agents[msg.sender].totalPnL + pnl;
    }

    /**
     * 获取机器人信息
     */
    function getAgentInfo(address agentAddr) external view returns (
        string memory name,
        address owner,
        bool active,
        uint256 totalTrades,
        int256 totalPnL
    ) {
        Agent memory agent = agents[agentAddr];
        return (
            agent.name,
            agent.owner,
            agent.active,
            agent.totalTrades,
            agent.totalPnL
        );
    }

    /**
     * 获取最新策略
     */
    function getLatestStrategy(address agentAddr) external view returns (
        bytes32 hash,
        string memory fileId,
        uint256 version
    ) {
        Strategy[] memory strategies = agentStrategies[agentAddr];
        require(strategies.length > 0, "No strategies");

        Strategy memory latest = strategies[strategies.length - 1];
        return (latest.hash, latest.fileId, latest.version);
    }

    /**
     * 管理员停用机器人
     */
    function deactivateAgent(address agentAddr) external onlyAdmin {
        agents[agentAddr].active = false;
    }

    /**
     * 检查交易是否已执行（防重放）
     */
    function isTradeExecuted(bytes32 tradeId) external view returns (bool) {
        return executedTrades[tradeId];
    }
}
