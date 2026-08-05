import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  NotFoundException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateSlaCategoryDto } from './dto/create-sla-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { sub: string; companyId: string; role: string };
}

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post('sla-configs/categories')
  @Roles('Manager', 'Super Admin')
  async createSlaCategory(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSlaCategoryDto,
  ) {
    return await this.ticketsService.createSlaCategory(
      req.user.companyId,
      dto.category, 
      dto.priority,
      dto.hours
    );
  }

  @Get('sla-configs')
  @Roles('Manager', 'Super Admin', 'Operator', 'Transporter', 'Shipper Ops', 'Sales Person')
  async findAllSla(@Req() req: AuthenticatedRequest) {
    return await this.ticketsService.findAllSla(req.user.companyId);
  }

  @Patch('sla-configs/:id')
  @Roles('Manager', 'Super Admin')
  async updateSla(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('hours') hours: number,
  ) {
    return await this.ticketsService.updateSla(id, hours, req.user.companyId, req.user.role);
  }

  @Delete('sla-configs/:id')
  @Roles('Manager', 'Super Admin')
  async removeSla(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return await this.ticketsService.removeSlaConfig(id, req.user.companyId);
  }

  @Post()
  @Roles('Operator', 'Manager', 'Super Admin', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person')
  async create(@Req() req: AuthenticatedRequest, @Body() createTicketDto: CreateTicketDto) {
    return await this.ticketsService.create(createTicketDto, req.user.companyId, req.user.role);
  }

  @Get()
  @Roles('Operator', 'Manager', 'Super Admin', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person')
  async findAll(@Req() req: AuthenticatedRequest, @Query('search') search: string, @Query('queue') queue: string) {
    return this.ticketsService.findAll(search, queue, req.user.companyId);
  }

  @Get('stats')
  @Roles('Operator', 'Manager', 'Super Admin', 'Agent')
  async getStats(@Req() req: AuthenticatedRequest) {
    return await this.ticketsService.getStats(req.user.companyId);
  }

  @Get(':id')
  @Roles('Operator', 'Manager', 'Super Admin', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person')
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const ticket = await this.ticketsService.findOne(id, req.user.companyId);
    if (!ticket) throw new NotFoundException(`Ticket with ID ${id} not found`);
    return ticket;
  }

  @Patch(':id')
  @Roles('Manager', 'Super Admin')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
  ) {
    return this.ticketsService.update(id, updateTicketDto, req.user.companyId, req.user.role);
  }

  @Delete(':id')
  @Roles('Manager', 'Super Admin')
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return await this.ticketsService.remove(id, req.user.companyId, req.user.role);
  }
}