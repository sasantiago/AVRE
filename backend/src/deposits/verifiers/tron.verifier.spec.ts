import { Prisma } from '@prisma/client';
import { TronVerifier } from './tron.verifier';

describe('TronVerifier', () => {
  const txHash = 'a'.repeat(64);
  const toAddress = 'Tplatform';
  const contractAddress = 'TUSDTContract';

  const envMap: Record<string, string> = {
    TRONGRID_API_URL: 'https://trongrid.test',
    TRONGRID_API_KEY: 'tg-key',
    TRONSCAN_API_URL: 'https://tronscan.test',
    TRONSCAN_API_KEY: 'ts-key',
    USDT_TRC20_CONTRACT_ADDRESS: contractAddress,
  };

  let config: any;
  let verifier: TronVerifier;
  let responses: Record<string, unknown>;

  const defaultResponses = () => ({
    transfers: {
      data: [
        {
          transaction_id: txHash,
          from: 'Tsource',
          to: toAddress,
          value: '100000000', // 100 USDT (6 decimales)
          token_info: { address: contractAddress },
        },
      ],
    },
    txInfo: { blockNumber: 1000, receipt: { result: 'SUCCESS' } },
    nowBlock: { block_header: { raw_data: { number: 1025 } } },
    tronScan: {
      contractRet: 'SUCCESS',
      tokenTransferInfo: { contract_address: contractAddress, amount_str: '100000000' },
    },
  });

  beforeEach(() => {
    config = { get: jest.fn((k: string) => envMap[k]) };
    verifier = new TronVerifier(config);
    responses = defaultResponses();

    global.fetch = jest.fn((url: string) => {
      const body = url.includes('/transactions/trc20')
        ? responses.transfers
        : url.includes('gettransactioninfobyid')
          ? responses.txInfo
          : url.includes('getnowblock')
            ? responses.nowBlock
            : url.includes('transaction-info')
              ? responses.tronScan
              : {};
      return Promise.resolve({ json: () => Promise.resolve(body) }) as any;
    }) as any;
  });

  const input = () => ({ txHash, toAddress, declaredAmountToken: new Prisma.Decimal('100') });

  it('éxito: doble fuente consistente, contrato y destino correctos', async () => {
    const result = await verifier.verify(input());
    expect(result.success).toBe(true);
    expect(result.verifiedAmountToken?.toString()).toBe('100');
    expect(result.sourceAddress).toBe('Tsource');
    expect(result.confirmations).toBe(25); // 1025 - 1000
  });

  it('falla si no se encuentra la transferencia', async () => {
    responses.transfers = { data: [] };
    const result = await verifier.verify(input());
    expect(result.success).toBe(false);
    expect(result.failureReason).toMatch(/no se encontró/i);
  });

  it('falla si TronGrid no reporta éxito', async () => {
    responses.txInfo = { blockNumber: 1000, receipt: { result: 'FAILED' } };
    const result = await verifier.verify(input());
    expect(result.success).toBe(false);
  });

  it('falla si TronScan no reporta éxito', async () => {
    responses.tronScan = { ...(responses.tronScan as any), contractRet: 'FAILED' };
    const result = await verifier.verify(input());
    expect(result.success).toBe(false);
  });

  it('falla si el contrato no coincide con el configurado', async () => {
    responses.transfers = {
      data: [{ ...(responses.transfers as any).data[0], token_info: { address: 'TOtroContrato' } }],
    };
    const result = await verifier.verify(input());
    expect(result.success).toBe(false);
    expect(result.failureReason).toMatch(/contrato/i);
  });

  it('falla si la wallet de destino no coincide', async () => {
    responses.transfers = {
      data: [{ ...(responses.transfers as any).data[0], to: 'Totradireccion' }],
    };
    const result = await verifier.verify(input());
    expect(result.success).toBe(false);
    expect(result.failureReason).toMatch(/destino/i);
  });

  it('falla si el monto no coincide entre las dos fuentes', async () => {
    responses.tronScan = {
      ...(responses.tronScan as any),
      tokenTransferInfo: {
        ...(responses.tronScan as any).tokenTransferInfo,
        amount_str: '50000000',
      },
    };
    const result = await verifier.verify(input());
    expect(result.success).toBe(false);
    expect(result.failureReason).toMatch(/doble fuente/i);
  });
});
