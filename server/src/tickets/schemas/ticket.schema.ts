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

  // Set default to null so email and manual tickets can start unassigned
  @Prop({ type: String, default: null, index: true })
  category!: string;

  @Prop({ type: Date, default: null })
  slaDeadline!: Date | null;

  @Prop({ required: true, index: true })
  companyId!: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  @Prop({ unique: true, sparse: true })
  outlookMessageId!: string;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);

// Compound indexes to accelerate dashboard queries, telemetry rollups, and queue filtering
TicketSchema.index({ companyId: 1, status: 1 });
TicketSchema.index({ companyId: 1, createdAt: -1 });
TicketSchema.index({ companyId: 1, generator: 1 });

// Mongoose pre-save hook to calculate SLA deadline automatically when category is present/modified
TicketSchema.pre('save', async function () {
  if (this.category && (this.isNew || this.isModified('category'))) {
    try {
      const slaConfigModel = this.model('SlaConfig');
      const rule = (await slaConfigModel.findOne({ category: this.category })) as any;

      const hours = rule ? rule.hours : 24; // Fallback to 24h if config is missing
      this.slaDeadline = new Date(Date.now() + hours * 60 * 60 * 1000);

      if (rule && rule.priority) {
        this.priority = rule.priority;
      }
    } catch (err) {
      this.slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  } else if (!this.category) {
    this.slaDeadline = null; // Clear deadline if category is empty
  }
});

export type TicketDocument = Ticket & Document;