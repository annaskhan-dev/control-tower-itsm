import { IsString, IsNotEmpty, IsOptional, IsDate, IsObject, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  // Added issueType to accept the selection from your frontend modal
  @IsString()
  @IsNotEmpty()
  issueType!: string; 

  @IsString()
  @IsNotEmpty()
  priority!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  generator?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  assignee?: string;

  @ValidateIf((o) => o.assignee && o.assignee.trim() !== '' && o.assignee.toLowerCase() !== 'unassigned')
  @IsString()
  @IsNotEmpty()
  subAssignment?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  subAssignmentAt?: Date;

  @IsOptional()
  @IsString()
  companyId?: string; 

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}