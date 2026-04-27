import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { type AuthUser, CurrentUser } from '../common/current-user.decorator';
import { ListMessagesDto } from './dto/list-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

@Controller('rooms/:id/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(@Param('id') roomId: string, @Query() q: ListMessagesDto) {
    return this.messages.list(roomId, q.limit ?? 50, q.before);
  }

  @Post()
  @HttpCode(201)
  send(@Param('id') roomId: string, @Body() dto: SendMessageDto, @CurrentUser() user: AuthUser) {
    return this.messages.send(roomId, user.id, user.username, dto.content);
  }
}
