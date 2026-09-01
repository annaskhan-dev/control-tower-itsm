import { PartialType } from '@nestjs/mapped-types';
import { CreateTicketDto } from './create-ticket.dto';
import { IsOptional, IsDate, IsArray, IsString, IsObject, ValidateIf, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, Validate } from 'class-validator';
import { Type } from 'class-transformer';

// Custom validator to restrict Transporters, Sales Persons, and Shipper Ops from being assigned during updates
@ValidatorConstraint({ name: 'isNotRestrictedAssigneeUpdate', async: false })
class IsNotRestrictedAssigneeUpdateConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
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
  @Validate(IsNotRestrictedAssigneeUpdateConstraint)
  assignee?: string;

  @IsOptional()
  @IsString()
  category?: string;

  // Allows skipping validation if the field is empty, null, or undefined (useful for clearing values)
  @ValidateIf((o) => o.subAssignment !== undefined && o.subAssignment !== null && o.subAssignment !== '')
  @IsString()
  @Validate(IsNotRestrictedAssigneeUpdateConstraint)
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