import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SessionLogDocument = SessionLog & Document;

@Schema({ timestamps: true })
export class SessionLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  loginAt!: Date;

  @Prop()
  logoutAt!: Date;

  @Prop({ default: 0 })
  durationMs!: number;
}

export const SessionLogSchema = SchemaFactory.createForClass(SessionLog);

// Automatically compute durationMs before saving
SessionLogSchema.pre('save', function () {
  if (this.logoutAt && this.loginAt) {
    const logoutTime = new Date(this.logoutAt).getTime();
    const loginTime = new Date(this.loginAt).getTime();
    if (logoutTime > loginTime) {
      this.durationMs = logoutTime - loginTime;
    } else {
      this.durationMs = 0;
    }
  }
});