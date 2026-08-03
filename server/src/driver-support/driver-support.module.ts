import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DriverSupportController } from './driver-support.controller';
import { DriverSupportService } from './driver-support.service';
import { DriverSupport, DriverSupportSchema } from './schemas/driver-support.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DriverSupport.name, schema: DriverSupportSchema },
    ]),
  ],
  controllers: [DriverSupportController],
  providers: [DriverSupportService],
  exports: [DriverSupportService],
})
export class DriverSupportModule {}