import { IsString, IsNotEmpty, IsOptional, IsDate, ValidateIf } from 'class-validator';
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

  // companyId is usually handled by the controller via req.user, 
  // but keeping it here as requested.
  @IsOptional()
  @IsString()
  companyId?: string; 
}