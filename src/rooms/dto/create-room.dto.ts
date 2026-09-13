import { ApiProperty } from '@nestjs/swagger';
import { Matches, MaxLength, MinLength } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({
    description: 'Room name (letters, numbers, and hyphens)',
    example: 'general',
    minLength: 3,
    maxLength: 32,
  })
  @MinLength(3, { message: 'name must be between 3 and 32 characters' })
  @MaxLength(32, { message: 'name must be between 3 and 32 characters' })
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'name may only contain letters, numbers, and hyphens',
  })
  name!: string;
}
