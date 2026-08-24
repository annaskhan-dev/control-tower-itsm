import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ticket, TicketDocument } from '../tickets/schemas/ticket.schema';
import { DriverSupport, DriverSupportDocument } from '../driver-support/schemas/driver-support.schema';
import { SessionLog, SessionLogDocument } from '../schemas/session-log.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(DriverSupport.name) private driverModel: Model<DriverSupportDocument>,
    @InjectModel(SessionLog.name) private sessionLogModel: Model<SessionLogDocument>,
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

  // Active Time & Monthly Average Active Time for users/operators
  async getActiveTimeAnalytics() {
    return await this.sessionLogModel.aggregate([
      {
        $match: { durationMs: { $exists: true, $ne: null } }
      },
      {
        $group: {
          _id: '$userId',
          totalActiveMs: { $sum: '$durationMs' },
          averageSessionMs: { $avg: '$durationMs' },
          sessionCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          name: '$user.name',
          email: '$user.email',
          role: '$user.role',
          totalActiveHours: { $divide: ['$totalActiveMs', 3600000] },
          averageActiveHoursPerSession: { $divide: ['$averageSessionMs', 3600000] },
          sessionCount: 1
        }
      }
    ]);
  }

  // Month-on-Month Tickets Breakdown (Created/Resolved with respective users/operators)
  async getMonthOnMonthAnalytics() {
    return await this.ticketModel.aggregate([
      {
        $project: {
          month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          creator: '$createdBy',
          resolver: '$resolvedBy',
          status: 1
        }
      },
      {
        $group: {
          _id: '$month',
          totalCreated: { $sum: 1 },
          totalResolved: {
            $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] }
          },
          creators: { $push: '$creator' },
          resolvers: { $push: '$resolver' }
        }
      },
      { $sort: { _id: -1 } }
    ]);
  }
}