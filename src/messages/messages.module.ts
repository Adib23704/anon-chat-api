import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { RoomsModule } from '../rooms/rooms.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [RoomsModule, ChatModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
