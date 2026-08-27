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
      // Step 1: Group by User and Month to calculate active duration per month
      {
        $group: {
          _id: {
            userId: '$userId',
            month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }
          },
          monthlyActiveMs: { $sum: '$durationMs' }
        }
      },
      // Step 2: Group by User to accumulate total overall time and calculate monthly average
      {
        $group: {
          _id: '$_id.userId',
          totalOverallMs: { $sum: '$monthlyActiveMs' },
          avgMonthlyActiveMs: { $avg: '$monthlyActiveMs' },
          sessionCount: { $sum: 1 }
        }
      },
      // Step 3: Lookup user details securely handling both ObjectIds and string identifiers
      {
        $lookup: {
          from: 'users',
          let: { searchId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$_id', '$$searchId'] },
                    { $eq: [{ $toString: '$_id' }, { $toString: '$$searchId' }] },
                    { $eq: ['$name', '$$searchId'] },
                    { $eq: ['$username', '$$searchId'] }
                  ]
                }
              }
            }
          ],
          as: 'user'
        }
      },
      // Safe unwind: preserves records even if user details are temporarily missing during initial login sync
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      },
      // Step 4: Project clean fields for your frontend UI table with safe fallbacks
      {
        $project: {
          name: { $ifNull: ['$user.name', 'Unknown User'] },
          email: { $ifNull: ['$user.email', 'N/A'] },
          role: { $ifNull: ['$user.role', { $ifNull: ['$user.userType', 'Operator'] }] },
          totalActiveHours: { $divide: ['$totalOverallMs', 3600000] },
          monthlyAverageActiveHours: { $divide: ['$avgMonthlyActiveMs', 3600000] },
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