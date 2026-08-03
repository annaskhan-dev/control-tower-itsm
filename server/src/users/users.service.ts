// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcrypt'; // <--- 1. Import bcrypt

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async findAll(): Promise<any[]> {
    const users = await this.userModel.find().exec();
    return users.map(user => {
      const userObj = user.toObject();
      return {
        id: userObj._id.toString(),
        name: userObj.name,
        email: userObj.email,
        role: userObj.role,
        status: userObj.status,
        companyId: userObj.companyId,
        avatarColor: userObj.avatarColor,
      };
    });
  }

  // Updated Create method
  async create(createUserDto: any): Promise<User> {
    // 2. Hash the password before saving
    const plainPassword = createUserDto.password || 'Temporary123!';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const userData = {
      ...createUserDto,
      password: hashedPassword, // Save the HASH, not the plain text
      status: createUserDto.status || 'Active',
    };

    const newUser = new this.userModel(userData);
    return newUser.save();
  }

  async update(id: string, updateUserDto: any): Promise<User | null> {
    // If a new password is provided, hash it before updating
    if (updateUserDto.password) {
        updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    } else {
        delete updateUserDto.password;
    }
    
    return this.userModel.findByIdAndUpdate(id, updateUserDto, { new: true }).exec();
  }

  async remove(id: string): Promise<any> {
    return this.userModel.findByIdAndDelete(id).exec();
  }
}