import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class CreateSlaCategoryDto {
  @IsString()
  @IsNotEmpty()
  category!: string; // Updated from 'name'

  @IsString()
  @IsNotEmpty()
  priority!: string; // Added priority

  @IsNumber()
  hours!: number;
}