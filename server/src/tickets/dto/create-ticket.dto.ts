import { IsString, IsNotEmpty, IsOptional, IsDate, IsObject, ValidateIf, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, Validate } from 'class-validator';
import { Type } from 'class-transformer';

// Custom validator to restrict Transporters, Sales Persons, and Shipper Ops from being assigned
@ValidatorConstraint({ name: 'isNotRestrictedAssignee', async: false })
class IsNotRestrictedAssigneeConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    if (!value || typeof value !== 'string') return true;
    const lowerValue = value.toLowerCase();
    
    // Block if it contains transporter, sales, or shipper/ops keywords
    const isTransporter = lowerValue.includes('transporter');
    const isSales = lowerValue.includes('sales');
    const isShipperOps = lowerValue.includes('shipper') || lowerValue.includes('ops');

    return !isTransporter && !isSales && !isShipperOps;
  }

  defaultMessage(args: ValidationArguments) {
    return `Action forbidden: Transporters, Sales Persons, and Shipper Ops cannot be assigned tickets or given sub-assignments.`;
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