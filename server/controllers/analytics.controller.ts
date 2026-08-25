import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SessionLog, SessionLogDocument } from '../src/schemas/session-log.schema'; 
import { Ticket, TicketDocument } from '../src/tickets/schemas/ticket.schema'; 

@Controller('reports') 
export class AnalyticsController {
  constructor(
    @InjectModel(SessionLog.name) private sessionLogModel: Model<SessionLogDocument>,
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
  ) {}

  @Get('active-time')
  async getActiveTimeStats() {
    return await this.sessionLogModel.aggregate([
      {
        $addFields: {
          // Only use stored durationMs (populated on logout); ignore open ghost sessions
          effectiveDuration: {
            $cond: {
              if: { $gt: ["$durationMs", 0] },
              then: "$durationMs",
              else: 0
            }
          }
        }
      },
      {
        $group: {
          _id: {
            userId: "$userId",
            yearMonth: { $dateToString: { format: "%Y-%m", date: "$loginAt" } }
          },
          totalMonthMs: { $sum: "$effectiveDuration" }
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
                    { $eq: ['$status', 'resolved'] },
                    { $eq: ['$status', 'closed'] },
                    { $eq: ['$status', 'Closed'] },
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
          period: {
            $concat: [
              {
                $switch: {
                  branches: [
                    { case: { $eq: ['$_id.month', 1] }, then: 'January' },
                    { case: { $eq: ['$_id.month', 2] }, then: 'February' },
                    { case: { $eq: ['$_id.month', 3] }, then: 'March' },
                    { case: { $eq: ['$_id.month', 4] }, then: 'April' },
                    { case: { $eq: ['$_id.month', 5] }, then: 'May' },
                    { case: { $eq: ['$_id.month', 6] }, then: 'June' },
                    { case: { $eq: ['$_id.month', 7] }, then: 'July' },
                    { case: { $eq: ['$_id.month', 8] }, then: 'August' },
                    { case: { $eq: ['$_id.month', 9] }, then: 'September' },
                    { case: { $eq: ['$_id.month', 10] }, then: 'October' },
                    { case: { $eq: ['$_id.month', 11] }, then: 'November' },
                    { case: { $eq: ['$_id.month', 12] }, then: 'December' },
                  ],
                  default: 'Unknown',
                },
              },
              ' ',
              { $toString: '$_id.year' },
            ],
          },
          ticketsCreated: 1,
          ticketsResolved: 1,
          operators: 1,
        },
      },
      { $sort: { year: -1, month: -1 } },
    ]);
  }
}