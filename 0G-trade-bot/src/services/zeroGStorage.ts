import { ZeroGStorageClient, ZeroGStorageKernel } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 0G Storage 服务封装
 * 用于持久化存储交易策略、配置和历史记录
 */
export class StorageService {
  private client: ZeroGStorageClient;
  private kernel: ZeroGStorageKernel;
  private provider: ethers.Provider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.ZERO_G_RPC_URL);
    // 0G Storage 客户端初始化
    this.client = new ZeroGStorageClient({
      network: 'testnet',
      providerUrl: process.env.ZERO_G_RPC_URL,
    });
  }

  /**
   * 上传交易策略到 0G Storage
   * @param strategyId 策略 ID
   * @param strategyData 策略数据（JSON）
   */
  async uploadStrategy(strategyId: string, strategyData: any): Promise<string> {
    const content = JSON.stringify(strategyData, null, 2);
    const buffer = Buffer.from(content);

    try {
      const uploadResult = await this.client.upload(buffer, {
        metadata: {
          strategyId,
          timestamp: Date.now().toString(),
          type: 'trading-strategy'
        }
      });

      console.log(`策略 ${strategyId} 已上传到 0G Storage`);
      console.log(`File ID: ${uploadResult.fileId}`);
      console.log(`Tx Hash: ${uploadResult.txHash}`);

      return uploadResult.fileId;
    } catch (error) {
      console.error('上传策略失败:', error);
      throw error;
    }
  }

  /**
   * 从 0G Storage 下载交易策略
   * @param fileId 文件 ID
   */
  async downloadStrategy(fileId: string): Promise<any> {
    try {
      const content = await this.client.download(fileId);
      const text = new TextDecoder().decode(content);
      return JSON.parse(text);
    } catch (error) {
      console.error('下载策略失败:', error);
      throw error;
    }
  }

  /**
   * 存储交易记录
   * @param tradeData 交易数据
   */
  async storeTradeRecord(tradeData: TradeRecord): Promise<string> {
    const content = JSON.stringify(tradeData);
    const buffer = Buffer.from(content);

    const result = await this.client.upload(buffer, {
      metadata: {
        type: 'trade-record',
        timestamp: Date.now().toString()
      }
    });

    return result.fileId;
  }

  /**
   * 存储风险管理配置
   * @param config 风险管理配置
   */
  async storeRiskConfig(config: RiskConfig): Promise<string> {
    const content = JSON.stringify(config);
    const buffer = Buffer.from(content);

    const result = await this.client.upload(buffer, {
      metadata: {
        type: 'risk-config',
        version: '1.0.0'
      }
    });

    return result.fileId;
  }
}

export interface TradeRecord {
  timestamp: number;
  strategyId: string;
  action: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  symbol: string;
  amount: number;
  price: number;
  pnl?: number;
  txHash?: string;
}

export interface RiskConfig {
  maxPositionSize: number;      // 最大仓位
  stopLossPercent: number;      // 止损百分比
  takeProfitPercent: number;    // 止盈百分比
  maxDailyLoss: number;         // 最大日亏损
  leverageLimit: number;        // 杠杆限制
}
