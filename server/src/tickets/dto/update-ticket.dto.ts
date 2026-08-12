import { PartialType } from '@nestjs/mapped-types';
import { CreateTicketDto } from './create-ticket.dto';
import { IsOptional, IsDate, IsArray, IsString, ValidateIf } from 'class-validator';
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

  // Validate subAssignment if it's being provided and either:
  // 1. An assignee is explicitly being updated in this request, OR
  // 2. We want to ensure it has value. (The database schema also guards this).
  @ValidateIf((o) => o.subAssignment !== undefined && o.subAssignment !== null && o.subAssignment !== '')
  @IsString()
  @IsOptional()
  subAssignment?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  subAssignmentAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  resolvedAt?: Date;
}