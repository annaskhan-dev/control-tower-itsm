import { PartialType } from '@nestjs/mapped-types';
import { CreateTicketDto } from './create-ticket.dto';
import { IsOptional, IsDate, IsArray, IsString, IsObject, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTicketDto extends PartialType(CreateTicketDto) {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  slaDeadline?: Date;

  @IsOptional()
  @IsArray()
  comments?: any[];

  @IsOptional()
  @IsString()
  assignee?: string;

  @IsOptional()
  @IsString()
  category?: string;

  // Allows skipping validation if the field is empty, null, or undefined (useful for clearing values)
  @ValidateIf((o) => o.subAssignment !== undefined && o.subAssignment !== null && o.subAssignment !== '')
  @IsString()
  subAssignment?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  subAssignmentAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  resolvedAt?: Date;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}