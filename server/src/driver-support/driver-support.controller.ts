import { Controller, Post, Body, Get, BadRequestException } from '@nestjs/common';
import { DriverSupportService } from './driver-support.service';

@Controller('driver-support')
export class DriverSupportController {
  constructor(private readonly driverService: DriverSupportService) {}

  @Post()
  async create(@Body() body: any) {
    try {
      return await this.driverService.create(body);
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  async findAll() {
    return this.driverService.findAll();
  }
}