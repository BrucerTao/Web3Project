import { ComputeService, MarketData, TradingSignal } from '../services/zeroGCompute.js';
import { StorageService, TradeRecord, RiskConfig } from '../services/zeroGStorage.js';

/**
 * 永续合约策略代理
 * 使用 AI 驱动的交易策略，通过 0G Compute 进行 TEE 密封推理
 */
export class PerpetualStrategyAgent {
  private computeService: ComputeService;
  private storageService: StorageService;
  private riskConfig: RiskConfig;
  private isActive: boolean = false;

  constructor() {
    this.computeService = new ComputeService();
    this.storageService = new StorageService();
    this.riskConfig = {
      maxPositionSize: 10000,     // 最大仓位 10000 USDT
      stopLossPercent: 0.02,      // 2% 止损
      takeProfitPercent: 0.05,    // 5% 止盈
      maxDailyLoss: 5000,         // 最大日亏损 5000 USDT
      leverageLimit: 10           // 最大 10 倍杠杆
    };
  }

  /**
   * 启动策略代理
   */
  async start(): Promise<void> {
    this.isActive = true;
    console.log('🚀 永续策略代理已启动');

    // 从 0G Storage 加载配置
    await this.loadRiskConfig();

    // 开始监控市场
    this.runMarketMonitor();
  }

  /**
   * 停止策略代理
   */
  stop(): void {
    this.isActive = false;
    console.log('⏹️ 永续策略代理已停止');
  }

  /**
   * 执行一次交易决策
   * @param marketData 市场数据
   * @param symbol 交易对
   */
  async executeTradingDecision(
    marketData: MarketData,
    symbol: string
  ): Promise<TradeRecord | null> {
    if (!this.isActive) {
      console.log('策略代理未激活，跳过交易');
      return null;
    }

    console.log(`\n📊 分析市场数据：${symbol}`);
    console.log(`当前价格：${marketData.prices[marketData.prices.length - 1]}`);

    // 1. 通过 0G Compute 进行 TEE 密封推理
    const inferenceResult = await this.computeService.requestInference(
      'perpetual-strategy-v1',
      marketData,
      'aggressive trading strategy for perpetual futures'
    );

    console.log(`🤖 AI 推理结果：${inferenceResult.output}`);
    console.log(`置信度：${(inferenceResult.confidence * 100).toFixed(2)}%`);

    // 2. 风险管理检查
    if (!this.passRiskCheck(inferenceResult)) {
      console.log('❌ 未通过风险管理检查');
      return null;
    }

    // 3. 生成交易记录
    const tradeRecord: TradeRecord = {
      timestamp: Date.now(),
      strategyId: 'perpetual-strategy-v1',
      action: this.signalToAction(inferenceResult.output),
      symbol,
      amount: this.calculatePositionSize(inferenceResult),
      price: marketData.prices[marketData.prices.length - 1],
      pnl: undefined
    };

    // 4. 存储交易记录到 0G Storage
    await this.storageService.storeTradeRecord(tradeRecord);
    console.log(`✅ 交易记录已存储，File ID 待返回`);

    return tradeRecord;
  }

  /**
   * 风险管理检查
   */
  private passRiskCheck(inference: any): boolean {
    // 置信度低于 70% 不交易
    if (inference.confidence < 0.7) {
      console.log('置信度过低');
      return false;
    }

    // HOLD 信号不交易
    if (inference.output === 'HOLD') {
      return false;
    }

    return true;
  }

  /**
   * 计算仓位大小
   */
  private calculatePositionSize(inference: any): number {
    const baseSize = 1000; // 基础仓位 1000 USDT

    // 根据置信度调整仓位
    const confidenceMultiplier = inference.confidence / 0.7;
    const adjustedSize = baseSize * confidenceMultiplier;

    // 不超过最大仓位限制
    return Math.min(adjustedSize, this.riskConfig.maxPositionSize);
  }

  /**
   * 将交易信号转换为操作
   */
  private signalToAction(signal: TradingSignal): 'BUY' | 'SELL' | 'LONG' | 'SHORT' {
    switch (signal) {
      case 'STRONG_BUY':
      case 'BUY':
        return 'LONG';
      case 'STRONG_SELL':
      case 'SELL':
        return 'SHORT';
      default:
        return 'BUY'; // 默认持有
    }
  }

  /**
   * 从 0G Storage 加载风险管理配置
   */
  private async loadRiskConfig(): Promise<void> {
    try {
      // 尝试从存储中加载配置
      // 如果不存在则使用默认配置
      console.log('📥 从 0G Storage 加载风险管理配置...');
    } catch (error) {
      console.log('使用默认风险管理配置');
    }
  }

  /**
   * 运行市场监控循环
   */
  private async runMarketMonitor(): Promise<void> {
    while (this.isActive) {
      // 模拟获取市场数据
      const marketData: MarketData = {
        prices: [65000, 65200, 65100, 65300, 65500],
        volumes: [1000000, 1200000, 900000, 1100000, 1300000],
        high: [65500, 65600, 65400, 65700, 65800],
        low: [64800, 65000, 64900, 65100, 65300]
      };

      await this.executeTradingDecision(marketData, 'BTC/USDT');

      // 每 5 分钟执行一次
      await new Promise(resolve => setTimeout(resolve, 300000));
    }
  }
}
