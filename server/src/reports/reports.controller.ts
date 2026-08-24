import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily-summary')
  async getDailySummary() {
    return await this.reportsService.getDailySummary();
  }

  // New endpoint for Active Time & Monthly Average Active Time
  @Get('active-time')
  async getActiveTime() {
    return await this.reportsService.getActiveTimeAnalytics();
  }

  // New endpoint for Month-on-Month Tickets Breakdown
  @Get('month-on-month')
  async getMonthOnMonth() {
    return await this.reportsService.getMonthOnMonthAnalytics();
  }
}