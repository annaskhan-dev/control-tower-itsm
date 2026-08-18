import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ticket, TicketDocument } from './schemas/ticket.schema';
import { SlaConfig, SlaConfigDocument } from './schemas/sla-config.schema';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsGateway } from './tickets.gateway';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(SlaConfig.name) private slaConfigModel: Model<SlaConfigDocument>,
    private readonly ticketsGateway: TicketsGateway,
  ) {}

  private authorize(userRole: string, allowedRoles: string[]) {
    if (userRole === 'Super Admin') return;
    
    const normalizedUserRole = userRole.replace(/\s+/g, '_').toLowerCase();
    const isAllowed = allowedRoles.some(
      role => role.replace(/\s+/g, '_').toLowerCase() === normalizedUserRole
    );

    if (!isAllowed) {
      throw new ForbiddenException(`You do not have permission to perform this action.`);
    }
  }

  async create(createTicketDto: CreateTicketDto, companyId: string, userRole: string): Promise<Ticket> {
    try {
      const category = createTicketDto.category || 'fleet-coordination';
      const slaConfig = await this.slaConfigModel.findOne({ category, companyId }).exec();
      const hoursAllowed = slaConfig ? slaConfig.hours : 24;
      const deadline = new Date(Date.now() + hoursAllowed * 60 * 60 * 1000);
      const isAssigned = createTicketDto.assignee && createTicketDto.assignee !== 'Unassigned';
      const isSubAssigned = createTicketDto.subAssignment && createTicketDto.subAssignment !== 'Unassigned' && createTicketDto.subAssignment !== '';

      const ticketData = {
        ...createTicketDto,
        category,
        status: 'Open',
        assignee: isAssigned ? createTicketDto.assignee : 'Unassigned',
        subAssignment: isSubAssigned ? createTicketDto.subAssignment : null,
        ticketId: `INC-${Math.floor(10000 + Math.random() * 90000)}`,
        slaDeadline: deadline,
        assignedAt: isAssigned ? new Date() : null,
        subAssignmentAt: isSubAssigned ? new Date() : null,
        resolvedAt: null,
        companyId: companyId,
      };

      const createdTicket = new this.ticketModel(ticketData);
      const savedTicket = await createdTicket.save();

      this.ticketsGateway.emitTicketCreated(savedTicket);
      return savedTicket;
    } catch (error: any) {
      this.logger.error(`Failed to create ticket: ${error.message}`);
      throw new InternalServerErrorException('Could not create ticket');
    }
  }

  async createSlaCategory(
    companyId: string, 
    category: string, 
    priority: string, 
    hours: number
  ): Promise<SlaConfig> {
    const newSla = new this.slaConfigModel({
      companyId,
      category, 
      priority,
      hours,
    });
    return await newSla.save();
  }

  async update(id: string, updateTicketDto: UpdateTicketDto, companyId: string, userRole: string): Promise<Ticket> {
    const normalizedRole = userRole.replace(/\s+/g, '_').toLowerCase();
    const restrictedUpdateRoles = ['operator', 'transporter', 'shipper_ops', 'sales_person'];

    if (restrictedUpdateRoles.includes(normalizedRole)) {
      if (updateTicketDto.assignee !== undefined || updateTicketDto.category !== undefined) {
        throw new ForbiddenException('You are not allowed to update Assignee or Category.');
      }
    }

    const baseQuery = id.startsWith('INC-') ? { ticketId: id } : { _id: id };
    const existingTicket = await this.ticketModel.findOne({ ...baseQuery, companyId });
    if (!existingTicket) throw new NotFoundException(`Ticket with ID ${id} not found`);

    // Check if the existing ticket is already resolved or closed
    const currentStatus = (existingTicket.status || '').toLowerCase();
    const isAlreadyResolved = ['closed', 'resolved', 'completed', 'done'].includes(currentStatus);

    if (isAlreadyResolved) {
      const isChangingCategory = updateTicketDto.category !== undefined && updateTicketDto.category !== existingTicket.category;
      const isChangingSubAssignment = updateTicketDto.subAssignment !== undefined && updateTicketDto.subAssignment !== existingTicket.subAssignment;

      if (isChangingCategory || isChangingSubAssignment) {
        throw new BadRequestException('Cannot modify category or sub-assignment once a ticket is resolved or closed.');
      }
    }

    const updateData: any = { ...updateTicketDto };

    // Prevent SLA Deadline from ever being altered or recalculated during regular updates/sub-assignments
    delete updateData.slaDeadline;

    // Handle Assignee and assignedAt logic safely
    if (updateData.assignee !== undefined) {
      const isActuallyAssigned = updateData.assignee !== 'Unassigned' && updateData.assignee !== '';
      if (isActuallyAssigned) {
        updateData.assignedAt = existingTicket.assignedAt || new Date();
      } else {
        updateData.assignedAt = null;
      }
    }

    // Handle Sub-Assignment and subAssignmentAt logic robustly (fixes legacy records missing timestamps)
    if (updateData.subAssignment !== undefined) {
      const isActuallySubAssigned = updateData.subAssignment !== 'Unassigned' && updateData.subAssignment !== '' && updateData.subAssignment !== null;
      
      if (isActuallySubAssigned) {
        const isNewSubAssignment = updateData.subAssignment !== existingTicket.subAssignment;
        if (isNewSubAssignment || !existingTicket.subAssignmentAt) {
          updateData.subAssignmentAt = new Date();
        }
      } else {
        updateData.subAssignment = null;
        updateData.subAssignmentAt = null;
      }
    }

    // Automatically handle resolvedAt timestamp when status changes
    if (updateData.status !== undefined && updateData.status !== existingTicket.status) {
      const isNewResolved = ['closed', 'resolved', 'completed', 'done'].includes(updateData.status.toLowerCase());
      if (isNewResolved) {
        updateData.resolvedAt = new Date();
      } else {
        updateData.resolvedAt = null;
      }
    }

    const updatedTicket = await this.ticketModel
      .findOneAndUpdate({ ...baseQuery, companyId }, updateData, { new: true, runValidators: true })
      .exec();

    if (!updatedTicket) {
      throw new NotFoundException(`Ticket with ID ${id} could not be updated`);
    }

    this.ticketsGateway.emitTicketUpdated(updatedTicket);
    return updatedTicket;
  }

  async remove(id: string, companyId: string, userRole: string): Promise<Ticket> {
    this.authorize(userRole, ['Manager', 'Super Admin']);

    const baseQuery = id.startsWith('INC-') ? { ticketId: id } : { _id: id };
    const deletedTicket = await this.ticketModel
      .findOneAndDelete({ ...baseQuery, companyId })
      .exec();

    if (!deletedTicket) throw new NotFoundException(`Ticket not found`);
    return deletedTicket;
  }

  async updateSla(id: string, hours: number, companyId: string, userRole: string): Promise<SlaConfig> {
    this.authorize(userRole, ['Manager']);

    const updatedSla = await this.slaConfigModel
      .findOneAndUpdate({ _id: id, companyId }, { hours }, { new: true })
      .exec();

    if (!updatedSla) throw new NotFoundException(`SLA config not found`);
    return updatedSla;
  }

  async findAll(search: string | undefined, queue: string | undefined, companyId: string): Promise<Ticket[]> {
    const query: any = { companyId };
    if (queue === 'unassigned') {
      query.assignee = { $in: ['Unassigned', null, ''] };
    } else if (queue === 'open') {
      query.status = 'Open';
    }
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    
    const tickets = await this.ticketModel.find(query).sort({ createdAt: -1 }).exec();

    // Auto-patch legacy documents on the fly during retrieval to prevent null time anchors
    return tickets.map((t: any) => {
      const ticketObj = t.toObject ? t.toObject() : t;
      const hasSubAssignment = ticketObj.subAssignment && ticketObj.subAssignment !== 'Unassigned' && ticketObj.subAssignment !== '';
      
      if (hasSubAssignment && !ticketObj.subAssignmentAt) {
        ticketObj.subAssignmentAt = ticketObj.updatedAt || ticketObj.createdAt;
      }
      return ticketObj;
    });
  }

  async findOne(id: string, companyId: string): Promise<Ticket | null> {
    const baseQuery = id.startsWith('INC-') ? { ticketId: id } : { _id: id };
    const ticket = await this.ticketModel.findOne({ ...baseQuery, companyId }).exec();
    
    if (!ticket) return null;

    const ticketObj: any = ticket.toObject ? ticket.toObject() : ticket;
    const hasSubAssignment = ticketObj.subAssignment && ticketObj.subAssignment !== 'Unassigned' && ticketObj.subAssignment !== '';
    
    if (hasSubAssignment && !ticketObj.subAssignmentAt) {
      ticketObj.subAssignmentAt = ticketObj.updatedAt || ticketObj.createdAt;
    }
    
    return ticketObj;
  }

  async getStats(companyId: string) {
    const tickets = await this.ticketModel.find({ companyId }).exec();
    const categoryStats = tickets.reduce((acc: any, ticket) => {
      const cat = ticket.category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    return {
      total: tickets.length,
      open: tickets.filter((t) => t.status === 'Open').length,
      inProgress: tickets.filter((t) => t.status === 'In Progress').length,
      resolved: tickets.filter((t) => t.status === 'Resolved').length,
      critical: tickets.filter((t) => t.priority === 'Critical').length,
      byCategory: categoryStats,
    };
  }

  async findAllSla(companyId: string): Promise<SlaConfig[]> {
    return this.slaConfigModel.find({ companyId }).exec();
  }

  async removeSlaConfig(id: string, companyId: string) {
    return await this.slaConfigModel.findOneAndDelete({ _id: id, companyId }).exec();
  }
}