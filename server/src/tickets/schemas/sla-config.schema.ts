import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SlaConfigDocument = SlaConfig & Document;

@Schema({ timestamps: true }) // Added timestamps for better debugging
export class SlaConfig extends Document {
  @Prop({ required: true })
  companyId!: string; // Mandatory for multi-tenancy

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true })
  hours!: number;

  @Prop({ default: 'category' }) // Allows us to distinguish if needed later
  type!: string;
  // Add this line inside your SlaConfig class
  @Prop({ required: true })
  priority!: string;
}

export const SlaConfigSchema = SchemaFactory.createForClass(SlaConfig);
