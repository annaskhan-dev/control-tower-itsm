import { Controller, Post, Body, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto'; 
// Optional: import your JwtAuthGuard or request interface if you implement a logout endpoint here as well
// import { JwtAuthGuard } from './jwt-auth.guard'; 

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
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: { userId: string }) {
    // If you pass userId or extract it from a Bearer token guard req.user:
    return await this.authService.logout(body.userId);
  }
}