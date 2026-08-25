import { Controller, Post, Body, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto'; 
import { JwtAuthGuard } from './jwt-auth.guard'; // Ensure this path matches your project structure

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return await this.authService.register(
      registerDto.name,
      registerDto.email,
      registerDto.password,
      registerDto.companyId,
      registerDto.role,
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    // This logs the user in and triggers active session logging inside authService.login
    return await this.authService.login(loginDto.email, loginDto.password);
  }

  // Logout Route to handle ending the session for active time calculation
  @Post('logout')
  @UseGuards(JwtAuthGuard) // Protects the route and populates req.user from the JWT
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req) {
    // Safely extract the userId from the authenticated token payload
    const userId = req.user.userId || req.user._id;
    return await this.authService.logout(userId);
  }
}