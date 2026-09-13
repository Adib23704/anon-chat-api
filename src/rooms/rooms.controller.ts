import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChatPubSub } from '../chat/pubsub.service';
import { type AuthUser, CurrentUser } from '../common/current-user.decorator';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(
    @Inject(RoomsService) private readonly rooms: RoomsService,
    @Inject(ChatPubSub) private readonly pubsub: ChatPubSub,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all chat rooms with active user count' })
  @ApiResponse({ status: 200, description: 'Rooms fetched successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async list() {
    return { rooms: await this.rooms.list() };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new chat room' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid room name payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Room name already in use' })
  create(@Body() dto: CreateRoomDto, @CurrentUser() user: AuthUser) {
    return this.rooms.create(dto.name, user.id, user.username);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific chat room' })
  @ApiParam({ name: 'id', description: 'Room ID', example: 'room_01jh1234567890' })
  @ApiResponse({ status: 200, description: 'Room details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  get(@Param('id') id: string) {
    return this.rooms.get(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a chat room (creator only)' })
  @ApiParam({ name: 'id', description: 'Room ID', example: 'room_01jh1234567890' })
  @ApiResponse({ status: 200, description: 'Room deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: only the room creator can delete this room',
  })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.rooms.requireOwnedBy(id, user.id);
    await this.pubsub.publish({ type: 'room:deleted', roomId: id, payload: { roomId: id } });
    await this.rooms.delete(id);
    return { deleted: true };
  }
}
