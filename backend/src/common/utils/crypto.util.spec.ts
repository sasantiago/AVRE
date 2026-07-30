import { randomBytes } from 'crypto';
import { decryptSecret, encryptSecret, hashToken, timingSafeEqualHex } from './crypto.util';

describe('crypto.util', () => {
  describe('encryptSecret/decryptSecret (AES-256-GCM)', () => {
    const key = randomBytes(32);

    it('descifra exactamente el mismo valor que se cifró', () => {
      const plain = 'JBSWY3DPEHPK3PXP'; // formato típico de secreto TOTP
      const payload = encryptSecret(plain, key);

      expect(decryptSecret(payload, key)).toBe(plain);
      expect(payload.ciphertext).not.toContain(plain);
    });

    it('falla al descifrar con la clave incorrecta', () => {
      const payload = encryptSecret('secreto', key);
      const wrongKey = randomBytes(32);

      expect(() => decryptSecret(payload, wrongKey)).toThrow();
    });

    it('genera IV distinto en cada cifrado (mismo texto plano)', () => {
      const a = encryptSecret('mismo-texto', key);
      const b = encryptSecret('mismo-texto', key);
      expect(a.iv).not.toBe(b.iv);
      expect(a.ciphertext).not.toBe(b.ciphertext);
    });
  });

  describe('timingSafeEqualHex', () => {
    it('true para hashes iguales', () => {
      const h = hashToken('mismo-valor');
      expect(timingSafeEqualHex(h, hashToken('mismo-valor'))).toBe(true);
    });

    it('false para hashes distintos', () => {
      expect(timingSafeEqualHex(hashToken('a'), hashToken('b'))).toBe(false);
    });

    it('false (no crashea) si las longitudes difieren', () => {
      expect(timingSafeEqualHex('ab', 'abcd')).toBe(false);
    });
  });
});
