import { PartialType } from '@nestjs/mapped-types';
import { CreateTicketDto } from './create-ticket.dto';
import { IsOptional, IsDate, IsArray, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTicketDto extends PartialType(CreateTicketDto) {
  
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  slaDeadline?: Date;

  @IsOptional()
  @IsArray()
  comments?: any[];

  // Note: We don't need to redeclare status, assignee, etc., 
  // because PartialType(CreateTicketDto) already handles them!
  // If you must redeclare them, you MUST add @IsOptional() to them.
}