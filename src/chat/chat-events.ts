export const ServerEvents = {
  RoomJoined: 'room:joined',
  RoomUserJoined: 'room:user_joined',
  RoomUserLeft: 'room:user_left',
  MessageNew: 'message:new',
  RoomDeleted: 'room:deleted',
} as const;

export const ClientEvents = {
  RoomLeave: 'room:leave',
} as const;

export type MessageNewPayload = {
  id: string;
  username: string;
  content: string;
  createdAt: string;
};

export type RoomDeletedPayload = { roomId: string };

export type ChatEventEnvelope =
  | { type: 'message:new'; roomId: string; payload: MessageNewPayload }
  | { type: 'room:deleted'; roomId: string; payload: RoomDeletedPayload };

export const PUBSUB_CHANNEL = 'chat:events';
