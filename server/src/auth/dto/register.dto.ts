import { IsString, IsEmail, IsNotEmpty, IsIn } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsIn(['Super Admin', 'Manager', 'Operator', 'Transporter', 'Shipper Ops', 'Sales Person'], {
    message: 'Invalid role selected',
  })
  @IsNotEmpty()
  role!: string;
}