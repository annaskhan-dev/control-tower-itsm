import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketsGateway } from './tickets.gateway';
import { EmailSyncService } from '../services/email-sync.service';
import { EmailNotificationService } from '../utils/email-notification.service';
import { Ticket, TicketSchema } from './schemas/ticket.schema';
import { SlaConfig, SlaConfigSchema } from './schemas/sla-config.schema';
import { User, UserSchema } from '../users/schemas/user.schema'; // 👈 Make sure this path points to your actual user schema
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: SlaConfig.name, schema: SlaConfigSchema },
      { name: 'User', schema: UserSchema }, // 👈 Added this so userModel can be injected in TicketsService
    ]),
    AuthModule,
  ],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TicketsGateway,
    EmailSyncService,
    EmailNotificationService,
  ],
  exports: [
    TicketsService, 
    TicketsGateway,
    EmailSyncService,
    EmailNotificationService,
    MongooseModule, 
  ],
})
export class TicketsModule {}