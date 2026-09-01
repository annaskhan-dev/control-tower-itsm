import { PartialType } from '@nestjs/mapped-types';
import { CreateTicketDto } from './create-ticket.dto';
import { IsOptional, IsDate, IsArray, IsString, IsObject, ValidateIf, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, Validate } from 'class-validator';
import { Type } from 'class-transformer';

// Custom validator to restrict Transporters and Sales Persons from being assigned during updates
@ValidatorConstraint({ name: 'isNotRestrictedAssigneeUpdate', async: false })
class IsNotRestrictedAssigneeUpdateConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!value || typeof value !== 'string') return true;
    const lowerValue = value.toLowerCase();
    return !lowerValue.includes('transporter') && !lowerValue.includes('sales');
  }

  defaultMessage(args: ValidationArguments) {
    return `Action forbidden: Transporters and Sales Persons cannot be assigned tickets or given sub-assignments.`;
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