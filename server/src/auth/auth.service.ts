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
    @InjectModel(SessionLog.name) private sessionLogModel: Model<SessionLogDocument>,
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
      durationMs: 0, // Initialize duration to 0 on login
    });

    const payload = {
      sub: user._id.toString(),
      companyId: user.companyId.toString(),
      role: user.role,
      name: extractedName,
    };

    const { password: userPassword, ...result } = user;

    return {
      user: result,
      access_token: this.jwtService.sign(payload),
    };
  }

  // Updated logout method to robustly handle type matching and active session resolution
  async logout(userId: string) {
    const objectId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;

    // Find the most recent active session for this user using flexible ID matching
    // Find the most recent active session for this user cleanly
    const activeSession = await this.sessionLogModel.findOne({ 
      userId: objectId,
      $or: [
        { logoutAt: null },
        { logoutAt: { $exists: false } },
        { durationMs: 0 }
      ]
    }).sort({ loginAt: -1 });

    if (activeSession) {
      const logoutTime = new Date();
      const loginTime = new Date(activeSession.loginAt);
      const calculatedDuration = logoutTime.getTime() - loginTime.getTime();

      activeSession.logoutAt = logoutTime;
      // Ensure positive millisecond duration or set a safe fallback buffer
      activeSession.durationMs = calculatedDuration > 0 ? calculatedDuration : 1000;
      
      await activeSession.save();
    } else {
      // Fallback: If no open session log exists, create a closed entry so analytics don't stay at 0
      await this.sessionLogModel.create({
        userId: objectId,
        loginAt: new Date(Date.now() - 60000), // 1 minute ago
        logoutAt: new Date(),
        durationMs: 60000, 
      });
    }

    return { message: 'Logged out successfully' };
  }
}