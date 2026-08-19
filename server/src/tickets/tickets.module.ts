import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketsGateway } from './tickets.gateway';
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
  ],
  exports: [
    TicketsService, 
    TicketsGateway,
    MongooseModule, // Exported to allow other modules (like Analytics or Reporting) to query Ticket/SlaConfig models if required
  ],
})
export class TicketsModule {}