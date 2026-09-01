import { IsString, IsNotEmpty, IsOptional, IsDate, IsObject, ValidateIf, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, Validate } from 'class-validator';
import { Type } from 'class-transformer';

// Custom validator to restrict Transporters and Sales Persons from being assigned
@ValidatorConstraint({ name: 'isNotRestrictedAssignee', async: false })
class IsNotRestrictedAssigneeConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    if (!value || typeof value !== 'string') return true;
    const lowerValue = value.toLowerCase();
    // Block if it contains transporter or sales keywords
    return !lowerValue.includes('transporter') && !lowerValue.includes('sales');
  }

  defaultMessage(args: ValidationArguments) {
    return `Action forbidden: Transporters and Sales Persons cannot be assigned tickets or given sub-assignments.`;
  }
}

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional() 
  type?: string;

  @IsString()
  @IsOptional() 
  issueType?: string; 

  @IsString()
  @IsOptional() 
  priority?: string;

  @IsString()
  @IsOptional() 
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
  @Validate(IsNotRestrictedAssigneeConstraint)
  assignee?: string;

  @ValidateIf((o) => o.assignee && o.assignee.trim() !== '' && o.assignee.toLowerCase() !== 'unassigned')
  @IsString()
  @IsNotEmpty()
  @Validate(IsNotRestrictedAssigneeConstraint)
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