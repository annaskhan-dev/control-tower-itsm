import { IsString, IsNumber, IsNotEmpty, IsPositive } from 'class-validator';

export class CreateSlaCategoryDto {
  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  priority!: string;

  @IsNumber()
  @IsPositive() // Ensures hours cannot be 0 or negative
  hours!: number;
}