import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, strict: true })
export class Ticket extends Document {
  @Prop({ required: true, unique: true, index: true })
  ticketId!: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ trim: true })
  description!: string;

  @Prop({ trim: true })
  source!: string;

  // Added issueType to the schema so it is saved in the database
  @Prop({ index: true })
  issueType!: string;

  @Prop({ required: true, default: 'Direct API / System', index: true })
  generator!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  createdBy?: Types.ObjectId;

  @Prop({ index: true })
  type!: string;

  @Prop({ index: true })
  priority!: string;

  @Prop({ required: true, default: 'Open', index: true })
  status!: string;

  @Prop({ index: true })
  assignee!: string;

  @Prop()
  assignedAt!: Date;

  @Prop({ index: true })
  subAssignment!: string;

  @Prop()
  subAssignmentAt!: Date;

  @Prop()
  resolvedAt!: Date;

  @Prop({ default: 'fleet-coordination', index: true })
  category!: string;

  @Prop()
  slaDeadline!: Date;

  @Prop({ required: true, index: true })
  companyId!: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);

// Compound indexes to accelerate dashboard queries, telemetry rollups, and queue filtering
TicketSchema.index({ companyId: 1, status: 1 });
TicketSchema.index({ companyId: 1, createdAt: -1 });
TicketSchema.index({ companyId: 1, generator: 1 });

export type TicketDocument = Ticket & Document;