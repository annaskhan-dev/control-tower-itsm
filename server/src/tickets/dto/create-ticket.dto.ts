import { IsString, IsNotEmpty, IsOptional, IsDate, IsObject, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional() // Changed to optional in case the frontend form doesn't send it immediately
  type?: string;

  @IsString()
  @IsOptional() // Made optional to prevent 500 errors if the modal dropdown isn't selected
  issueType?: string; 

  @IsString()
  @IsOptional() // Made optional (defaults can be handled in your service if missing)
  priority?: string;

  @IsString()
  @IsOptional() // Made optional to prevent strict payload rejections
  category?: string;

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