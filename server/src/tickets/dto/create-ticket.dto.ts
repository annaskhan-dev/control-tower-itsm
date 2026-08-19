import { IsString, IsNotEmpty, IsOptional, IsDate, IsObject, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  type!: string; // Marked as required for logic processing

  @IsString()
  @IsNotEmpty()
  priority!: string; // Marked as required for logic processing

  @IsString()
  @IsNotEmpty()
  category!: string; // Marked as required for SLA lookup

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  generator?: string; // Validates ticket generator payload

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  assignee?: string;

  // Validation: subAssignment can only be specified if assignee is present and not empty/unassigned
  @ValidateIf((o) => o.assignee && o.assignee.trim() !== '' && o.assignee.toLowerCase() !== 'unassigned')
  @IsString()
  @IsNotEmpty()
  subAssignment?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  subAssignmentAt?: Date;

  // companyId is usually handled by the controller via req.user
  @IsOptional()
  @IsString()
  companyId?: string; 

  // Added to support dynamic telemetry and extra tracking context matching schema
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}