import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DriverSupportDocument = DriverSupport & Document;

@Schema({ timestamps: true })
export class DriverSupport {
  @Prop({ required: true, unique: true })
  supportId!: string;

  @Prop({ required: true })
  driverName!: string;

  @Prop({ required: true })
  orderId!: string;

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true })
  reasonCode!: string;

  @Prop({ required: true })
  actionTaken!: string;

  @Prop({ default: 'Pending' })
  status!: string;

  @Prop({ default: 'On Track' })
  slaStatus!: string;

  @Prop({
    default: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hour from creation
  })
  slaDeadline!: Date;
}

export const DriverSupportSchema = SchemaFactory.createForClass(DriverSupport);