import { VerificationInput, VerificationResult } from './verifier.types';

export interface DepositVerifier {
  verify(input: VerificationInput): Promise<VerificationResult>;
}
