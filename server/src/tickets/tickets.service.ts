import {
  Injectable,
  NotFoundException,
  ForbiddenException,
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
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException(`You do not have permission to perform this action.`);
    }
  }

  async create(createTicketDto: CreateTicketDto, companyId: string, userRole: string): Promise<Ticket> {
    try {
      const category = createTicketDto.category || 'fleet-coordination';
      // Note: If your SLA lookup now requires priority, update this line to: 
      // await this.slaConfigModel.findOne({ category, priority: createTicketDto.priority, companyId }).exec();
      const slaConfig = await this.slaConfigModel.findOne({ category, companyId }).exec();
      const hoursAllowed = slaConfig ? slaConfig.hours : 24;
      const deadline = new Date(Date.now() + hoursAllowed * 60 * 60 * 1000);
      const isAssigned = createTicketDto.assignee && createTicketDto.assignee !== 'Unassigned';

      const ticketData = {
        ...createTicketDto,
        category,
        status: 'Open',
        assignee: isAssigned ? createTicketDto.assignee : 'Unassigned',
        ticketId: `INC-${Math.floor(10000 + Math.random() * 90000)}`,
        slaDeadline: deadline,
        assignedAt: isAssigned ? new Date() : null,
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

  // UPDATED: Now accepts category and priority to match the Controller/DTO
  async createSlaCategory(
    companyId: string, 
    category: string, 
    priority: string, 
    hours: number
  ): Promise<SlaConfig> {
    const newSla = new this.slaConfigModel({
      companyId,
      category, 
      priority, // Added priority field
      hours,
    });
    return await newSla.save();
  }

  async update(id: string, updateTicketDto: UpdateTicketDto, companyId: string, userRole: string): Promise<Ticket> {
    if (userRole === 'Operator') {
      if (updateTicketDto.assignee !== undefined || updateTicketDto.category !== undefined) {
        throw new ForbiddenException('Operators are not allowed to update Assignee or Category.');
      }
    }

    const baseQuery = id.startsWith('INC-') ? { ticketId: id } : { _id: id };
    const existingTicket = await this.ticketModel.findOne({ ...baseQuery, companyId });
    if (!existingTicket) throw new NotFoundException(`Ticket with ID ${id} not found`);

    const updateData: any = { ...updateTicketDto };

    if (updateData.assignee !== undefined && updateData.assignee !== existingTicket.assignee) {
      const isActuallyAssigned = updateData.assignee !== 'Unassigned' && updateData.assignee !== '';
      updateData.assignedAt = isActuallyAssigned ? new Date() : null;
    }

    const updatedTicket = await this.ticketModel
      .findOneAndUpdate({ ...baseQuery, companyId }, updateData, { new: true })
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
    return this.ticketModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string, companyId: string): Promise<Ticket | null> {
    const baseQuery = id.startsWith('INC-') ? { ticketId: id } : { _id: id };
    return this.ticketModel.findOne({ ...baseQuery, companyId }).exec();
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
  // Ensure your logic filters by companyId to prevent unauthorized deletions
  return await this.slaConfigModel.findOneAndDelete({ _id: id, companyId }).exec();
}
}