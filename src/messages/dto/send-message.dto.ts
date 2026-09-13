import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'Text content of the message',
    example: 'Hello everyone!',
  })
  @IsString()
  content!: string;
}
