import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoadAlertDocument = RoadAlert & Document;

@Schema({ timestamps: true })
export class RoadAlert {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  location!: string;

  @Prop({ enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' })
  severity!: string;

  @Prop({ default: true })
  active!: boolean;
}

export const RoadAlertSchema = SchemaFactory.createForClass(RoadAlert);