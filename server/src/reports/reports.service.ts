import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ticket, TicketDocument } from '../tickets/schemas/ticket.schema';
import { DriverSupport, DriverSupportDocument } from '../driver-support/schemas/driver-support.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(DriverSupport.name) private driverModel: Model<DriverSupportDocument>,
  ) {}

  async getDailySummary() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const totalTicketsHandled = await this.ticketModel.countDocuments({
      createdAt: { $gte: startOfDay },
    });

    const totalDriversAssisted = await this.driverModel.countDocuments({
      createdAt: { $gte: startOfDay },
    });

    const reasonCodeBreakdown = await this.driverModel.aggregate([
      { $match: { createdAt: { $gte: startOfDay } } },
      { $group: { _id: '$reasonCode', count: { $sum: 1 } } },
    ]);

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalTicketsHandled,
      totalDriversAssisted,
      reasonCodeBreakdown,
    };
  }
}