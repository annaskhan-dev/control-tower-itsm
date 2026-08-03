import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoadAlert, RoadAlertSchema } from './schemas/road-alert.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoadAlert.name, schema: RoadAlertSchema },
    ]),
  ],
  exports: [],
})
export class RoadAlertsModule {}