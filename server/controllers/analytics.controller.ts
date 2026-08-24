import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SessionLog, SessionLogDocument } from '../src/schemas/session-log.schema'; 
import { Ticket, TicketDocument } from '../src/tickets/schemas/ticket.schema'; 

@Controller('reports') // <-- Changed from 'analytics' to 'reports'
export class AnalyticsController {
  constructor(
    @InjectModel(SessionLog.name) private sessionLogModel: Model<SessionLogDocument>,
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
  ) {}

  @Get('active-time')
  async getActiveTimeStats() {
    return await this.sessionLogModel.aggregate([
      {
        $group: {
          _id: {
            userId: "$userId",
            yearMonth: { $dateToString: { format: "%Y-%m", date: "$loginAt" } }
          },
          totalMonthMs: { $sum: "$durationMs" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id.userId",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      { $unwind: "$userInfo" },
      {
        $group: {
          _id: "$_id.userId",
          name: { $first: "$userInfo.name" },
          role: { $first: "$userInfo.role" },
          avgMonthlyActiveMs: { $avg: "$totalMonthMs" },
          totalOverallMs: { $sum: "$totalMonthMs" }
        }
      }
    ]);
  }

  @Get('month-on-month')
  async getMonthOnMonthReport() {
    return await this.ticketModel.aggregate([
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
  }
}