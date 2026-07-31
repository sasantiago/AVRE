import { BadRequestException } from '@nestjs/common';

// ~50KB de imagen crece a ~70KB de longitud de string en base64 (overhead ~37%
// del data URI). Sin bucket de object storage todavía (§12 del doc Fase 3), el
// avatar se guarda inline — este es el único límite de tamaño que existe hoy.
const MAX_AVATAR_DATA_URI_LENGTH = 70_000;

export function assertAvatarSize(avatarUrl: string): void {
  if (avatarUrl.length > MAX_AVATAR_DATA_URI_LENGTH) {
    throw new BadRequestException('La foto de perfil supera el tamaño máximo permitido (~50KB)');
  }
}

// La wallet de retiro es dirección + red (§2.1) — no tiene sentido aceptar una
// sin la otra, así que ambas viajan juntas o ninguna.
export function assertWalletFieldsPaired(input: {
  withdrawalWalletAddress?: string;
  withdrawalWalletNetwork?: string;
}): void {
  const hasAddress = input.withdrawalWalletAddress !== undefined;
  const hasNetwork = input.withdrawalWalletNetwork !== undefined;
  if (hasAddress !== hasNetwork) {
    throw new BadRequestException(
      'withdrawalWalletAddress y withdrawalWalletNetwork deben enviarse juntos',
    );
  }
}
