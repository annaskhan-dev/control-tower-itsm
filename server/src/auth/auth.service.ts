import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(
    name: string,
    email: string,
    pass: string,
    companyId: string,
    role: string,
  ) {
    if (!pass) throw new BadRequestException('Password is required');

    // SECURITY WARNING: In a production app, do not allow public
    // registration of 'Super Admin' roles.
    const validRoles = ['Operator', 'Manager', 'Super Admin'];
    if (!validRoles.includes(role)) {
      throw new BadRequestException('Invalid role selected');
    }

    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) throw new ConflictException('User already exists');

    const hashedPassword = await bcrypt.hash(pass, 10);

    const newUser = new this.userModel({
      name,
      email,
      password: hashedPassword,
      companyId, // Crucial: Associates this user with a specific tenant
      role,
    });

    return await newUser.save();
  }

  // Updated the parameter name from 'pass' to 'password'
  async login(email: string, password: string) {
    if (!password) throw new BadRequestException('Password is required');

    const user = (await this.userModel.findOne({ email }).lean()) as any;

    if (!user) throw new UnauthorizedException('Invalid credentials');

    // Updated the usage here as well
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const payload = {
      sub: user._id.toString(),
      companyId: user.companyId.toString(),
      role: user.role,
    };

    const { password: userPassword, ...result } = user;

    return {
      user: result,
      access_token: this.jwtService.sign(payload),
    };
  }
}
