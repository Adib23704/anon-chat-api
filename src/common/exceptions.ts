import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
  ) {
    super({ code, message }, status);
  }
}

export class ValidationException extends AppException {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, HttpStatus.BAD_REQUEST);
  }
}

export class UnauthorizedException extends AppException {
  constructor(message = 'Missing or expired session token') {
    super('UNAUTHORIZED', message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenException extends AppException {
  constructor(message: string) {
    super('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }
}

export class RoomNotFoundException extends AppException {
  constructor(roomId: string) {
    super('ROOM_NOT_FOUND', `Room with id ${roomId} does not exist`, HttpStatus.NOT_FOUND);
  }
}

export class RoomNameTakenException extends AppException {
  constructor() {
    super('ROOM_NAME_TAKEN', 'A room with this name already exists', HttpStatus.CONFLICT);
  }
}

export class MessageTooLongException extends AppException {
  constructor() {
    super(
      'MESSAGE_TOO_LONG',
      'Message content must not exceed 1000 characters',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class MessageEmptyException extends AppException {
  constructor() {
    super('MESSAGE_EMPTY', 'Message content must not be empty', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
