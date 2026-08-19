import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Delete,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
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
  user: { 
    sub: string; 
    companyId: string; 
    role: string; 
    name?: string; 
    username?: string; 
  };
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

  @Get('stats')
  @Roles('Operator', 'Manager', 'Super Admin', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person')
  async getStats(@Req() req: AuthenticatedRequest) {
    const userRole = req.user.role || '';
    const userName = req.user.name || req.user.username || req.user.sub;
    
    // Pass user details so getStats respects generic roles and user scoping correctly
    return await this.ticketsService.getStats(req.user.companyId, userRole, userName);
  }

  @Get()
  @Roles('Operator', 'Manager', 'Super Admin', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person')
  async findAll(
    @Req() req: AuthenticatedRequest, 
    @Query('search') search: string, 
    @Query('queue') queue: string
  ) {
    const userRole = req.user.role || '';
    const userName = req.user.name || req.user.username || req.user.sub;
    
    // Pass user details to service layer for server-side role-based filtering
    return this.ticketsService.findAll(search, queue, req.user.companyId, userRole, userName);
  }

  @Get(':id')
  @Roles('Operator', 'Manager', 'Super Admin', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person')
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const ticket = await this.ticketsService.findOne(id, req.user.companyId);
    if (!ticket) throw new NotFoundException(`Ticket with ID ${id} not found`);
    return ticket;
  }

  // Handles PATCH requests for updates
  @Patch(':id')
  @Roles('Operator', 'Manager', 'Super Admin', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
  ) {
    return this.processTicketUpdate(req, id, updateTicketDto);
  }

  // Handles PUT requests for updates (matches the frontend axiosInstance.put call)
  @Put(':id')
  @Roles('Operator', 'Manager', 'Super Admin', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person')
  async updatePut(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
  ) {
    return this.processTicketUpdate(req, id, updateTicketDto);
  }

  // Shared validation and update workflow logic
  private async processTicketUpdate(req: AuthenticatedRequest, id: string, updateTicketDto: UpdateTicketDto) {
    // 1. Fetch existing ticket to verify its current state
    const existingTicket = await this.ticketsService.findOne(id, req.user.companyId);
    if (!existingTicket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    const currentStatus = (existingTicket.status || '').toLowerCase();
    const isAlreadyResolved = ['closed', 'resolved', 'completed', 'done'].includes(currentStatus);

    // 2. If the ticket is already resolved/closed, block changes to category or subAssignment
    if (isAlreadyResolved) {
      const isChangingCategory = updateTicketDto.category && updateTicketDto.category !== existingTicket.category;
      const isChangingSubAssignment = 'subAssignment' in updateTicketDto && updateTicketDto.subAssignment !== existingTicket.subAssignment;

      if (isChangingCategory || isChangingSubAssignment) {
        throw new BadRequestException('Cannot modify category or sub-assignment once a ticket is resolved or closed.');
      }
    }

    // 3. Proceed with standard update process (passing current user's name for validation)
    const currentUserName = req.user.name || req.user.username || req.user.sub;
    return this.ticketsService.update(id, updateTicketDto, req.user.companyId, req.user.role, currentUserName);
  }

  @Delete(':id')
  @Roles('Manager', 'Super Admin')
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return await this.ticketsService.remove(id, req.user.companyId, req.user.role);
  }
}