import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketsGateway } from './tickets.gateway';
import { EmailService } from '../services/emailService';
import { Ticket, TicketSchema } from './schemas/ticket.schema';
import { SlaConfig, SlaConfigSchema } from './schemas/sla-config.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: SlaConfig.name, schema: SlaConfigSchema },
    ]),
    AuthModule,
  ],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TicketsGateway,
    EmailService,
  ],
  exports: [
    TicketsService, 
    TicketsGateway,
    EmailService, 
    MongooseModule, 
  ],
})
export class TicketsModule {}