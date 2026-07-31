import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { DepositVerifier } from './deposit-verifier.interface';
import { VerificationInput, VerificationResult } from './verifier.types';

const USDT_DECIMALS = 6; // fijo por spec (§5.2, §6.3 #3) — no se lee del contrato en runtime.

// TronGrid da from/to/contract ya en base58 (no hace falta decodificar direcciones
// hex de Tron a mano) si se consulta el endpoint de transfers TRC20 por cuenta, en
// vez del log crudo de la transacción — evita implementar un codec base58 propio.
interface TronGridTransferEntry {
  transaction_id: string;
  from: string;
  to: string;
  value: string; // unidad mínima del token, string
  token_info?: { address?: string; decimals?: number };
}

interface TronGridTransfersResponse {
  data?: TronGridTransferEntry[];
}

interface TronGridTxInfo {
  blockNumber?: number;
  receipt?: { result?: string };
}

interface TronGridNowBlock {
  block_header?: { raw_data?: { number?: number } };
}

interface TronScanTxInfo {
  contractRet?: string;
  block?: number;
  tokenTransferInfo?: {
    from_address?: string;
    to_address?: string;
    contract_address?: string;
    amount_str?: string;
    decimals?: number;
  };
}

@Injectable()
export class TronVerifier implements DepositVerifier {
  constructor(private readonly config: ConfigService) {}

  async verify(input: VerificationInput): Promise<VerificationResult> {
    const contractAddress = this.config.get<string>('USDT_TRC20_CONTRACT_ADDRESS');

    const [transfer, txInfo, nowBlock, tronScan] = await Promise.all([
      this.findTransferByTxHash(input.txHash, input.toAddress, contractAddress),
      this.fetchTronGrid('/wallet/gettransactioninfobyid', { value: input.txHash }),
      this.fetchTronGrid('/wallet/getnowblock', {}),
      this.fetchTronScan(input.txHash),
    ]);

    const txInfoBody = txInfo as TronGridTxInfo;
    const nowBlockBody = nowBlock as TronGridNowBlock;
    const tronScanBody = tronScan as TronScanTxInfo;

    if (!transfer) {
      return this.fail(
        'No se encontró la transferencia en TronGrid para ese hash y destino',
        {
          transfer,
          txInfo: txInfoBody,
        },
        tronScanBody,
      );
    }
    if (txInfoBody.receipt?.result !== 'SUCCESS') {
      return this.fail(
        'La transacción no figura como exitosa en TronGrid',
        txInfoBody,
        tronScanBody,
      );
    }
    if (tronScanBody.contractRet !== 'SUCCESS') {
      return this.fail(
        'La transacción no figura como exitosa en TronScan',
        txInfoBody,
        tronScanBody,
      );
    }
    if (transfer.token_info?.address !== contractAddress) {
      return this.fail(
        'El contrato del token no coincide con el USDT-TRC20 configurado',
        txInfoBody,
        tronScanBody,
      );
    }
    if (tronScanBody.tokenTransferInfo?.contract_address !== contractAddress) {
      return this.fail(
        'TronScan reporta un contrato distinto al esperado',
        txInfoBody,
        tronScanBody,
      );
    }
    if (transfer.to !== input.toAddress) {
      return this.fail(
        'La wallet de destino no coincide con la de la plataforma',
        txInfoBody,
        tronScanBody,
      );
    }

    const primaryAmount = new Prisma.Decimal(transfer.value).div(10 ** USDT_DECIMALS);
    const secondaryAmountRaw = tronScanBody.tokenTransferInfo?.amount_str;
    const secondaryAmount = secondaryAmountRaw
      ? new Prisma.Decimal(secondaryAmountRaw).div(10 ** USDT_DECIMALS)
      : null;

    if (!secondaryAmount || primaryAmount.sub(secondaryAmount).abs().greaterThan('0.000001')) {
      return this.fail(
        'El monto no coincide entre TronGrid y TronScan (doble fuente)',
        txInfoBody,
        tronScanBody,
      );
    }

    const currentBlock = nowBlockBody.block_header?.raw_data?.number ?? 0;
    const txBlock = txInfoBody.blockNumber ?? currentBlock;
    const confirmations = Math.max(0, currentBlock - txBlock);

    return {
      success: true,
      verifiedAmountToken: primaryAmount,
      sourceAddress: transfer.from,
      confirmations,
      rawPrimary: { transfer, txInfo: txInfoBody, nowBlock: nowBlockBody },
      rawSecondary: tronScanBody,
    };
  }

  private fail(reason: string, rawPrimary: unknown, rawSecondary: unknown): VerificationResult {
    return { success: false, confirmations: 0, failureReason: reason, rawPrimary, rawSecondary };
  }

  private async findTransferByTxHash(
    txHash: string,
    toAddress: string,
    contractAddress: string | undefined,
  ): Promise<TronGridTransferEntry | null> {
    const params = new URLSearchParams({ only_to: 'true', limit: '200' });
    if (contractAddress) params.set('contract_address', contractAddress);
    const body = (await this.fetchTronGrid(
      `/v1/accounts/${toAddress}/transactions/trc20?${params.toString()}`,
      undefined,
      'GET',
    )) as TronGridTransfersResponse;
    return body.data?.find((t) => t.transaction_id === txHash) ?? null;
  }

  private async fetchTronGrid(
    path: string,
    body: Record<string, unknown> | undefined,
    method: 'GET' | 'POST' = 'POST',
  ): Promise<unknown> {
    const baseUrl = this.config.get<string>('TRONGRID_API_URL');
    const apiKey = this.config.get<string>('TRONGRID_API_KEY');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey;

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    });
    return res.json();
  }

  private async fetchTronScan(txHash: string): Promise<unknown> {
    const baseUrl = this.config.get<string>('TRONSCAN_API_URL');
    const apiKey = this.config.get<string>('TRONSCAN_API_KEY');
    const headers: Record<string, string> = {};
    if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey;

    const res = await fetch(`${baseUrl}/transaction-info?hash=${encodeURIComponent(txHash)}`, {
      headers,
    });
    return res.json();
  }
}
