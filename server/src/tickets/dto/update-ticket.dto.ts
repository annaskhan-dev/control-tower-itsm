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

  // Explicitly add these so the service can read them
  @IsOptional()
  @IsString()
  assignee?: string;

  @IsOptional()
  @IsString()
  category?: string;
}