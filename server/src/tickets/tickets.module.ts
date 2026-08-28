import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketsGateway } from './tickets.gateway';
import { EmailService } from '../services/emailService'; // <-- Adjust path if your EmailService is located elsewhere
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
    EmailService, // <-- Added EmailService here so it can inject the Ticket model properly
  ],
  exports: [
    TicketsService, 
    TicketsGateway,
    EmailService, // <-- Exported just in case
    MongooseModule, // Exported to allow other modules to query Ticket/SlaConfig models
  ],
})
export class TicketsModule {}