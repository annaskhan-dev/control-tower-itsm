import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Ticket extends Document {
  @Prop({ required: true })
  ticketId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop()
  description!: string;

  @Prop()
  source!: string;

  @Prop({ required: true, default: 'Direct API / System' })
  generator!: string; // <--- Automatically falls back to this default if left blank

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;

  @Prop()
  type!: string;

  @Prop()
  priority!: string;

  @Prop()
  status!: string;

  @Prop()
  assignee!: string;

  @Prop()
  assignedAt!: Date;

  @Prop()
  subAssignment!: string;

  @Prop()
  subAssignmentAt!: Date;

  @Prop()
  resolvedAt!: Date;

  @Prop({ default: 'fleet-coordination' })
  category!: string;

  @Prop()
  slaDeadline!: Date;

  @Prop()
  companyId!: string;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);

export type TicketDocument = Ticket & Document;