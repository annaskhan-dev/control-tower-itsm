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
  Logger,
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
    email?: string;
  };
}

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  private readonly logger = new Logger(TicketsController.name);

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
    const userRole = req.user.role;
    const userName = req.user.name || req.user.username || (req.user.email ? req.user.email.split('@')[0] : 'Operator');
    const userId = req.user.sub;

    const enrichedTicketDto = {
      ...createTicketDto,
      generator: createTicketDto['generator'] || userRole || 'System',
    };

    this.logger.debug(`[POST /tickets] Creating ticket by user: ${userName}, role: ${userRole}, generator: ${enrichedTicketDto.generator}`);

    return await this.ticketsService.create(
      enrichedTicketDto, 
      req.user.companyId, 
      userRole, 
      userName, 
      userId
    );
  }

  @Get('stats')
  @Roles('Operator', 'Manager', 'Super Admin', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person')
  async getStats(@Req() req: AuthenticatedRequest) {
    const userRole = req.user.role || '';
    const userName = req.user.name || req.user.username || (req.user.email ? req.user.email.split('@')[0] : 'Operator');
    
    this.logger.debug(`[GET /tickets/stats] Fetching operational statistics for company: ${req.user.companyId}`);

    const statsResult = await this.ticketsService.getStats(req.user.companyId, userRole, userName);
    return statsResult;
  }

  @Get()
  @Roles('Operator', 'Manager', 'Super Admin', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person')
  async findAll(
    @Req() req: AuthenticatedRequest, 
    @Query('search') search: string, 
    @Query('queue') queue: string
  ) {
    const userRole = req.user.role || '';
    const userName = req.user.name || req.user.username || (req.user.email ? req.user.email.split('@')[0] : 'Operator');
    
    this.logger.debug(`[GET /tickets] Request received from user: ${userName}, role: ${userRole}, queue: ${queue}`);

    return this.ticketsService.findAll(search, queue, req.user.companyId, userRole, userName);
  }

  @Get(':id')
  @Roles('Operator', 'Manager', 'Super Admin', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person')
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const ticket = await this.ticketsService.findOne(id, req.user.companyId);
    if (!ticket) throw new NotFoundException(`Ticket with ID ${id} not found`);
    return ticket;
  }

  @Patch(':id')
  @Roles('Operator', 'Manager', 'Super Admin', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
  ) {
    return this.processTicketUpdate(req, id, updateTicketDto);
  }

  @Put(':id')
  @Roles('Operator', 'Manager', 'Super Admin', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person')
  async updatePut(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
  ) {
    return this.processTicketUpdate(req, id, updateTicketDto);
  }

  private async processTicketUpdate(req: AuthenticatedRequest, id: string, updateTicketDto: UpdateTicketDto) {
    const existingTicket = await this.ticketsService.findOne(id, req.user.companyId);
    if (!existingTicket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    const currentStatus = (existingTicket.status || '').toLowerCase();
    const isAlreadyResolved = ['closed', 'resolved', 'completed', 'done'].includes(currentStatus);

    if (isAlreadyResolved) {
      const isChangingCategory = updateTicketDto.category !== undefined && updateTicketDto.category !== existingTicket.category;
      const isChangingSubAssignment = 'subAssignment' in updateTicketDto && updateTicketDto.subAssignment !== existingTicket.subAssignment;

      if (isChangingCategory || isChangingSubAssignment) {
        throw new BadRequestException('Cannot modify category or sub-assignment once a ticket is resolved or closed.');
      }
    }

    // Resolve name cleanly, avoiding MongoDB ID hex strings entirely
    const currentUserName = req.user.name || req.user.username || (req.user.email ? req.user.email.split('@')[0] : 'Ali');
    const userRole = req.user.role;

    // Automatically enforce and lock assignee to current user's name for Operators
    if (userRole === 'Operator' && updateTicketDto.assignee !== undefined) {
      updateTicketDto.assignee = currentUserName;
    }
    
    this.logger.debug(`[PATCH/PUT /tickets/${id}] Updating ticket state by: ${currentUserName}`);

    return this.ticketsService.update(id, updateTicketDto, req.user.companyId, userRole, currentUserName);
  }

  @Delete(':id')
  @Roles('Manager', 'Super Admin')
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    this.logger.warn(`[DELETE /tickets/${id}] Ticket removal requested by role: ${req.user.role}`);
    return await this.ticketsService.remove(id, req.user.companyId, req.user.role);
  }
}