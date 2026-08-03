import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DriverSupport, DriverSupportDocument } from './schemas/driver-support.schema';

@Injectable()
export class DriverSupportService {
  constructor(
    @InjectModel(DriverSupport.name)
    private driverSupportModel: Model<DriverSupportDocument>,
  ) {}

  async create(dto: any): Promise<DriverSupport> {
    const count = await this.driverSupportModel.countDocuments();
    const supportId = dto.supportId || `SUPP-${1000 + count + 1}`;

    const newLog = new this.driverSupportModel({
      ...dto,
      supportId,
    });

    return newLog.save();
  }

  async findAll(): Promise<DriverSupport[]> {
    return this.driverSupportModel.find().exec();
  }
}