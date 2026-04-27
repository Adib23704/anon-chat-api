import { randomBytes } from 'node:crypto';

function body(): string {
  return randomBytes(9).toString('base64url');
}

export const newUserId = () => `usr_${body()}`;
export const newRoomId = () => `room_${body()}`;
export const newMessageId = () => `msg_${body()}`;
