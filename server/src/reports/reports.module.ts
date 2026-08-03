import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Ticket, TicketSchema } from '../tickets/schemas/ticket.schema';
import { DriverSupport, DriverSupportSchema } from '../driver-support/schemas/driver-support.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: DriverSupport.name, schema: DriverSupportSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}