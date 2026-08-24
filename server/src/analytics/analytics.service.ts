import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SessionLog, SessionLogDocument } from '../schemas/session-log.schema';
import { Ticket, TicketDocument } from '../tickets/schemas/ticket.schema'; // Adjust path to your ticket schema if needed

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(SessionLog.name) private sessionLogModel: Model<SessionLogDocument>,
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
  ) {}

  // 1. Calculate active time & monthly averages for users/operators
  async getActiveTimeStats() {
    const stats = await this.sessionLogModel.aggregate([
      {
        $group: {
          _id: '$userId',
          totalActiveMs: { $sum: '$durationMs' },
          sessionCount: { $sum: 1 },
          lastLogin: { $max: '$loginAt' },
        },
      },
      {
        $lookup: {
          from: 'users', // name of the user collection in MongoDB
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: '$_id',
          name: { $ifNull: ['$userDetails.name', 'Unknown User'] },
          email: { $ifNull: ['$userDetails.email', 'N/A'] },
          role: { $ifNull: ['$userDetails.role', 'Operator'] },
          totalActiveHours: { $round: [{ $divide: ['$totalActiveMs', 3600000] }, 2] },
          sessionCount: 1,
          lastLogin: 1,
          // Estimated monthly average active hours (Total hours divided by active months or fallback)
          monthlyAverageHours: { 
            $round: [{ $divide: [{ $divide: ['$totalActiveMs', 3600000] }, 1] }, 2] 
          },
        },
      },
    ]);

    return stats;
  }

  // 2. Month-on-Month ticket creation vs resolution report
  async getMonthOnMonthReport() {
    const report = await this.ticketModel.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          ticketsCreated: { $sum: 1 },
          ticketsResolved: {
            $sum: {
              $cond: [
                { 
                  $or: [
                    { $eq: ['$status', 'Resolved'] },
                    { $eq: ['$status', 'closed'] },
                    { $eq: ['$status', 'Resolved/Closed'] }
                  ] 
                }, 
                1, 
                0
              ],
            },
          },
          operators: { $addToSet: '$assignedOperator' },
        },
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          ticketsCreated: 1,
          ticketsResolved: 1,
          operators: 1,
        },
      },
      { $sort: { year: -1, month: -1 } },
    ]);

    return report;
  }
}