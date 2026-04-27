import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { type AuthUser, CurrentUser } from '../common/current-user.decorator';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  async list() {
    return { rooms: await this.rooms.list() };
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateRoomDto, @CurrentUser() user: AuthUser) {
    return this.rooms.create(dto.name, user.id, user.username);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.rooms.get(id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.rooms.requireOwnedBy(id, user.id);
    await this.rooms.delete(id);
    return { deleted: true };
  }
}
