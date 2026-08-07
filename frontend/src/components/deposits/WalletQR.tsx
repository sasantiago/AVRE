import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface WalletQRProps {
  address: string;
  size?: number;
}

// QR generado en el momento a partir de la wallet real de la plataforma —
// nunca una imagen estática, así no hay riesgo de que quede desactualizado o
// no coincida con la dirección real.
export function WalletQR({ address, size = 220 }: WalletQRProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(address, {
      width: size * 2, // 2x para pantallas de alta densidad
      margin: 1,
      color: { dark: '#0F172A', light: '#F8FAFC' },
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [address, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="animate-pulse rounded-xl bg-slate-800/60"
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`Código QR de la wallet ${address}`}
      width={size}
      height={size}
      className="rounded-xl bg-slate-50 p-3"
    />
  );
}
