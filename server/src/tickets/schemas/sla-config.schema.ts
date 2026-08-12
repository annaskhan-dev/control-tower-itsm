import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SlaConfigDocument = SlaConfig & Document;

// Add a compound index to prevent duplicate category/priority entries per company
@Schema({ timestamps: true, collection: 'slaconfigs' })
export class SlaConfig {
  @Prop({ required: true })
  companyId!: string; // Mandatory for multi-tenancy

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true })
  priority!: string;

  @Prop({ required: true })
  hours!: number;

  @Prop({ default: 'category' }) 
  type!: string;
}

export const SlaConfigSchema = SchemaFactory.createForClass(SlaConfig);

// Enforce unique combinations of company, category, and priority at the database level
SlaConfigSchema.index({ companyId: 1, category: 1, priority: 1 }, { unique: true });