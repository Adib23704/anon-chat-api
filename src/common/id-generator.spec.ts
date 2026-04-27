import { newMessageId, newRoomId, newUserId } from './id-generator';

describe('id-generator', () => {
  it('mints user ids with the usr_ prefix and 12-char body', () => {
    const id = newUserId();
    expect(id).toMatch(/^usr_[A-Za-z0-9_-]{12}$/);
  });

  it('mints room ids with the room_ prefix and 12-char body', () => {
    expect(newRoomId()).toMatch(/^room_[A-Za-z0-9_-]{12}$/);
  });

  it('mints message ids with the msg_ prefix and 12-char body', () => {
    expect(newMessageId()).toMatch(/^msg_[A-Za-z0-9_-]{12}$/);
  });

  it('produces unique values across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, newUserId));
    expect(ids.size).toBe(1000);
  });
});
