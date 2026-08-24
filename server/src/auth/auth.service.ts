import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { SessionLog, SessionLogDocument } from '../schemas/session-log.schema';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(SessionLog.name) private sessionLogModel: Model<SessionLogDocument>, // Added SessionLog Model
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

    const validRoles = [
      'Operator', 
      'Manager', 
      'Super Admin', 
      'Transporter', 
      'Shipper Ops', 
      'Sales Person'
    ];
    
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
      companyId,
      role,
    });

    return await newUser.save();
  }

  async login(email: string, password: string) {
    if (!password) throw new BadRequestException('Password is required');

    const user = (await this.userModel.findOne({ email }).lean()) as any;

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    // Bulletproof name evaluation: checks name, username, or falls back to email prefix
    const extractedName = 
      user.name?.trim() || 
      user.username?.trim() || 
      user.fullName?.trim() || 
      (email ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1) : 'User');

    // Record login session for active time calculations
    await this.sessionLogModel.create({
      userId: user._id,
      loginAt: new Date(),
    });

    const payload = {
      sub: user._id.toString(),
      companyId: user.companyId.toString(),
      role: user.role,
      name: extractedName, // Guaranteed to contain a valid name string
    };

    const { password: userPassword, ...result } = user;

    return {
      user: result,
      access_token: this.jwtService.sign(payload),
    };
  }

  // Added logout method to close the open session and log active duration
  async logout(userId: string) {
    const activeSession = await this.sessionLogModel.findOne({ 
      userId: new Types.ObjectId(userId), 
      logoutAt: { $exists: false } 
    }).sort({ loginAt: -1 });

    if (activeSession) {
      const logoutTime = new Date();
      activeSession.logoutAt = logoutTime;
      activeSession.durationMs = logoutTime.getTime() - new Date(activeSession.loginAt).getTime();
      await activeSession.save();
    }

    return { message: 'Logged out successfully' };
  }
}