// src/users/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop({
    required: true,
    enum: ['Operator', 'Manager', 'Super Admin', 'Transporter', 'Shipper Ops', 'Sales Person'],
    default: 'Operator',
  })
  role!: string;

  @Prop({ required: true })
  companyId!: string;

  @Prop()
  status!: string;

  @Prop()
  avatarColor!: string;

  // Add these fields to track resolved/completed tickets for sub-assignees
  @Prop({ default: 0 })
  resolvedCount!: number;

  @Prop({ default: 0 })
  completedTickets!: number;
}

export const UserSchema = SchemaFactory.createForClass(User);