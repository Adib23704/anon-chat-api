import { Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @MinLength(2, { message: 'username must be between 2 and 24 characters' })
  @MaxLength(24, { message: 'username must be between 2 and 24 characters' })
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'username may only contain letters, numbers, and underscores',
  })
  username!: string;
}
