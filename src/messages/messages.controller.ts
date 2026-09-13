import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../common/current-user.decorator';
import { ListMessagesDto } from './dto/list-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('rooms/:id/messages')
export class MessagesController {
  constructor(@Inject(MessagesService) private readonly messages: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'List paginated message history for a room' })
  @ApiParam({ name: 'id', description: 'Room ID', example: 'room_01jh1234567890' })
  @ApiResponse({ status: 200, description: 'Messages retrieved with pagination cursor' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  list(@Param('id') roomId: string, @Query() q: ListMessagesDto) {
    return this.messages.list(roomId, q.limit ?? 50, q.before);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Send a message to a room via HTTP' })
  @ApiParam({ name: 'id', description: 'Room ID', example: 'room_01jh1234567890' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid message payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  send(@Param('id') roomId: string, @Body() dto: SendMessageDto, @CurrentUser() user: AuthUser) {
    return this.messages.send(roomId, user.id, user.username, dto.content);
  }
}
