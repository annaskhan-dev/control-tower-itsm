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
    enum: ['Operator', 'Manager', 'Super Admin'],
    default: 'Operator',
  })
  role!: string;

  @Prop({ required: true })
  companyId!: string;

  @Prop()
  status!: string;

  @Prop()
  avatarColor!: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
