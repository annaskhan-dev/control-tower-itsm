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
    fullName?: string;
  };
}

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  private readonly logger = new Logger(TicketsController.name);

  constructor(private readonly ticketsService: TicketsService) {}

  private extractUserName(user: AuthenticatedRequest['user']): string {
    if (user?.name) return user.name;
    if (user?.fullName) return user.fullName;
    if (user?.username) return user.username;
    if (user?.email) {
      const prefix = user.email.split('@')[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return 'User';
  }

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
    const userRole = req.user.role || 'User';
    const userName = this.extractUserName(req.user);
    const userId = req.user.sub;

    const formattedSource = `${userName} (${userRole})`;

    const enrichedTicketDto = {
      ...createTicketDto,
      generator: formattedSource,
      source: formattedSource,
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
    const userName = this.extractUserName(req.user);
    
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
    const userName = this.extractUserName(req.user);
    
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
    const isAlreadyResolved = ['resolved', 'completed', 'done'].includes(currentStatus);

    // Rule: Once a ticket is resolved, it cannot be modified or opened again
    if (isAlreadyResolved) {
      const isTryingToChangeStatus = updateTicketDto.status !== undefined && 
        !['resolved', 'completed', 'done'].includes(updateTicketDto.status.toLowerCase());

      const isChangingCategory = updateTicketDto.category !== undefined && updateTicketDto.category !== existingTicket.category;
      const isChangingSubAssignment = 'subAssignment' in updateTicketDto && updateTicketDto.subAssignment !== existingTicket.subAssignment;

      if (isTryingToChangeStatus || isChangingCategory || isChangingSubAssignment) {
        throw new BadRequestException('Once a ticket has been resolved, it cannot be reopened or modified.');
      }
    }

    const currentUserName = this.extractUserName(req.user);
    const userRole = req.user.role;

    // 🛑 VALIDATION: Restrict assigning Transporters or Sales Persons only (Shipper Ops are allowed)
    const restrictedAssignmentKeywords = ['transporter', 'sales'];
    
    const targetAssignee = updateTicketDto.assignee;
    if (targetAssignee && targetAssignee !== 'Unassigned') {
      const lowerAssignee = targetAssignee.toLowerCase();
      const isRestricted = restrictedAssignmentKeywords.some(keyword => lowerAssignee.includes(keyword));
      if (isRestricted) {
        throw new BadRequestException('Action forbidden: Transporters and Sales Persons cannot be assigned tickets.');
      }
    }

    const targetSubAssignment = updateTicketDto.subAssignment;
    if (targetSubAssignment && targetSubAssignment !== '' && targetSubAssignment !== 'Unassigned') {
      const lowerSub = targetSubAssignment.toLowerCase();
      const isRestrictedSub = restrictedAssignmentKeywords.some(keyword => lowerSub.includes(keyword));
      if (isRestrictedSub) {
        throw new BadRequestException('Action forbidden: Transporters and Sales Persons cannot be given sub-assignments.');
      }
    }

    const hasSubAssignment = Boolean(existingTicket.subAssignment);
    const isTryingToChangeStatus = updateTicketDto.status !== undefined && updateTicketDto.status !== existingTicket.status;
    const isManagerOrAdmin = ['Manager', 'Super Admin'].includes(userRole);

    const isSubAssignee = existingTicket.subAssignment && 
      existingTicket.subAssignment.trim().toLowerCase() === currentUserName.trim().toLowerCase();

    if (hasSubAssignment && isTryingToChangeStatus && !isManagerOrAdmin && !isSubAssignee) {
      throw new BadRequestException('Primary assignees are no longer able to change the ticket status once a ticket is sub-assigned.');
    }

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