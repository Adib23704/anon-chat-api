import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListMessagesDto {
  @ApiPropertyOptional({
    description: 'Maximum number of messages to return',
    minimum: 1,
    maximum: 100,
    default: 50,
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Message ID cursor to fetch messages before',
    example: 'msg_01jh1234567890abcdefghjk',
  })
  @IsOptional()
  @IsString()
  before?: string;
}
