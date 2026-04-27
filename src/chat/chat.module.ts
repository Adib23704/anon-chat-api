import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatGateway } from './chat.gateway';
import { PubSubBridge } from './pubsub.bridge';
import { ChatPubSub } from './pubsub.service';

@Module({
  imports: [AuthModule],
  providers: [ChatGateway, ChatPubSub, PubSubBridge],
  exports: [ChatPubSub],
})
export class ChatModule {}
